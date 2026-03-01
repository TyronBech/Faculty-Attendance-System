<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AdminScheduleChangeRequestController extends Controller
{
    /**
     * Display the admin schedule change requests management page.
     */
    public function index(Request $request)
    {
        return Inertia::render('Admin/ScheduleChangeRequests', [
            'requests' => ScheduleChangeRequest::getForAdmin($request),
            'filters'  => [
                'status' => $request->query('status', ''),
                'search' => $request->query('search', ''),
            ],
            'pendingCount' => ScheduleChangeRequest::pending()->count(),
        ]);
    }

    /**
     * AJAX endpoint: return filtered & paginated requests as JSON.
     */
    public function filter(Request $request)
    {
        return response()->json(
            ScheduleChangeRequest::getForAdmin($request)
        );
    }

    /**
     * Approve a schedule change request and apply the change to schedule_details.
     */
    public function approve(Request $request, ScheduleChangeRequest $scheduleChangeRequest)
    {
        if ($scheduleChangeRequest->status !== 'pending') {
            return back()->with('error', 'This request has already been reviewed.');
        }

        $validated = $request->validate([
            'review_remarks' => 'nullable|string|max:1000',
        ]);

        try {
            DB::transaction(function () use ($scheduleChangeRequest, $validated) {
                // Re-fetch and lock the request row to prevent concurrent/double review.
                $locked = ScheduleChangeRequest::whereKey($scheduleChangeRequest->id)
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending') {
                    throw new \RuntimeException('This request has already been reviewed.');
                }

                // ── Apply the requested changes to the schedule detail ──────────
                $detail = ScheduleDetail::findOrFail($locked->schedule_detail_id);

                // Preserve the existing date part from the stored timestamps and apply the requested times
                $existingTimeIn  = Carbon::parse($detail->time_in);
                $existingTimeOut = Carbon::parse($detail->time_out);

                $timeIn  = (clone $existingTimeIn)->setTimeFromTimeString($locked->requested_time_in);
                $timeOut = (clone $existingTimeOut)->setTimeFromTimeString($locked->requested_time_out);

                // Ensure the requested time out is after time in before proceeding
                if ($timeOut->lessThanOrEqualTo($timeIn)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'requested_time_out' => ['The requested time out must be after the requested time in.'],
                    ]);
                }

                // Recalculate hours_required from the new times (whole hours)
                $hoursRequired = max(0, intval(round($timeOut->diffInMinutes($timeIn) / 60)));

                $detail->update([
                    'day_of_week'    => $locked->requested_day_of_week,
                    'time_in'        => $timeIn->toDateTimeString(),
                    'time_out'       => $timeOut->toDateTimeString(),
                    'room'           => $locked->requested_room ?? $detail->room,
                    'hours_required' => $hoursRequired,
                ]);

                // ── Mark the request as approved ────────────────────────────────
                $locked->update([
                    'status'         => 'approved',
                    'reviewed_by'    => Auth::id(),
                    'reviewed_at'    => now(),
                    'review_remarks' => $validated['review_remarks'] ?? null,
                ]);
            });
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Schedule change request approved. The schedule has been updated.');
    }

    /**
     * Reject a schedule change request. Remarks are required.
     */
    public function reject(Request $request, ScheduleChangeRequest $scheduleChangeRequest)
    {
        if ($scheduleChangeRequest->status !== 'pending') {
            return back()->with('error', 'This request has already been reviewed.');
        }

        $validated = $request->validate([
            'review_remarks' => 'required|string|min:5|max:1000',
        ]);

        try {
            DB::transaction(function () use ($scheduleChangeRequest, $validated) {
                // Re-fetch and lock the request row to prevent concurrent/double review.
                $locked = ScheduleChangeRequest::whereKey($scheduleChangeRequest->id)
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending') {
                    throw new \RuntimeException('This request has already been reviewed.');
                }

                $locked->update([
                    'status'         => 'rejected',
                    'reviewed_by'    => Auth::id(),
                    'reviewed_at'    => now(),
                    'review_remarks' => $validated['review_remarks'],
                ]);
            });
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Schedule change request has been rejected.');
    }
}
