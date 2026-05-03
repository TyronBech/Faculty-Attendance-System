<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttendanceJustification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use RuntimeException;

class AdminUndertimeJustificationController extends Controller
{
    /**
     * Display the admin undertime justification approval page
     */
    public function index(Request $request)
    {
        $query = AttendanceJustification::where('type', 'undertime')
            ->with([
                'faculty:id,first_name,last_name,user_id',
                'faculty.user:id,email',
                'attendanceRecord:id,attendance_date,actual_time_in,actual_time_out,operational_time_in,operational_time_out,undertime_minutes',
                'reviewer:id,email',
                'attachments',
            ])
            ->orderBy('created_at', 'desc');

        // ── Search Filter ──────────────────────────────────────────────────
        if ($request->has('search') && $request->search) {
            $search = '%'.$request->search.'%';
            $query->whereHas('faculty', function ($q) use ($search) {
                $q->where('first_name', 'like', $search)
                    ->orWhere('last_name', 'like', $search);
            })->orWhere('justification', 'like', $search);
        }

        // ── Status Filter ──────────────────────────────────────────────────
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        $justifications = $query->paginate(15);

        // ── Format response ────────────────────────────────────────────────
        $formatted = $justifications->map(function ($j) {
            return [
                'id' => $j->id,
                'faculty_name' => $j->faculty ? "{$j->faculty->first_name} {$j->faculty->last_name}" : 'Unknown',
                'faculty_email' => $j->faculty?->user?->email,
                'attendance_date' => $j->attendanceRecord?->attendance_date?->format('M d, Y'),
                'undertime_minutes' => $j->attendanceRecord?->undertime_minutes ?? 0,
                'actual_time_in' => $j->attendanceRecord?->actual_time_in?->format('H:i'),
                'actual_time_out' => $j->attendanceRecord?->actual_time_out?->format('H:i'),
                'operational_time_out' => $j->attendanceRecord?->operational_time_out?->format('H:i'),
                'justification' => $j->justification,
                'status' => $j->status,
                'reviewed_at' => $j->reviewed_at?->format('M d, Y h:i A'),
                'review_remarks' => $j->review_remarks,
                'reviewer_email' => $j->reviewer?->email,
                'created_at' => $j->created_at->format('M d, Y h:i A'),
                'updated_at' => $j->updated_at->format('M d, Y h:i A'),
                'attachments_data' => $j->getAttachmentsData(),
            ];
        });

        return Inertia::render('Admin/UndertimeJustificationApproval', [
            'justifications' => $formatted,
            'paginator' => [
                'current_page' => $justifications->currentPage(),
                'last_page' => $justifications->lastPage(),
                'total' => $justifications->total(),
                'per_page' => $justifications->perPage(),
                'path' => $justifications->path(),
            ],
            'filters' => [
                'search' => $request->search ?? '',
                'status' => $request->status ?? '',
            ],
            'pendingCount' => AttendanceJustification::where('type', 'undertime')
                ->where('status', 'pending')
                ->count(),
        ]);
    }

    /**
     * AJAX endpoint for filtered data
     */
    public function filter(Request $request)
    {
        $query = AttendanceJustification::where('type', 'undertime')
            ->with([
                'faculty:id,first_name,last_name,user_id',
                'faculty.user:id,email',
                'attendanceRecord:id,attendance_date,actual_time_in,actual_time_out,operational_time_in,operational_time_out,undertime_minutes',
                'reviewer:id,email',
                'attachments',
            ])
            ->orderBy('created_at', 'desc');

        // ── Search ─────────────────────────────────────────────────────────
        if ($request->has('search') && $request->search) {
            $search = '%'.$request->search.'%';
            $query->whereHas('faculty', function ($q) use ($search) {
                $q->where('first_name', 'like', $search)
                    ->orWhere('last_name', 'like', $search);
            })->orWhere('justification', 'like', $search);
        }

        // ── Status Filter ──────────────────────────────────────────────────
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        $justifications = $query->paginate(15);

        return response()->json([
            'data' => $justifications->map(function ($j) {
                return [
                    'id' => $j->id,
                    'faculty_name' => $j->faculty ? "{$j->faculty->first_name} {$j->faculty->last_name}" : 'Unknown',
                    'faculty_email' => $j->faculty?->user?->email,
                    'attendance_date' => $j->attendanceRecord?->attendance_date?->format('M d, Y'),
                    'undertime_minutes' => $j->attendanceRecord?->undertime_minutes ?? 0,
                    'actual_time_in' => $j->attendanceRecord?->actual_time_in?->format('H:i'),
                    'actual_time_out' => $j->attendanceRecord?->actual_time_out?->format('H:i'),
                    'operational_time_out' => $j->attendanceRecord?->operational_time_out?->format('H:i'),
                    'justification' => $j->justification,
                    'status' => $j->status,
                    'reviewed_at' => $j->reviewed_at?->format('M d, Y h:i A'),
                    'review_remarks' => $j->review_remarks,
                    'reviewer_email' => $j->reviewer?->email,
                    'created_at' => $j->created_at->format('M d, Y h:i A'),
                    'updated_at' => $j->updated_at->format('M d, Y h:i A'),
                    'attachments_data' => $j->getAttachmentsData(),
                ];
            }),
            'pagination' => [
                'current_page' => $justifications->currentPage(),
                'last_page' => $justifications->lastPage(),
                'total' => $justifications->total(),
                'per_page' => $justifications->perPage(),
                'path' => $justifications->path(),
            ],
        ]);
    }

    /**
     * Approve an undertime justification
     */
    public function approve(Request $request, AttendanceJustification $justification)
    {
        if ($justification->type !== 'undertime') {
            return back()->with('error', 'Invalid justification type.');
        }

        if ($justification->status !== 'pending') {
            return back()->with('error', 'This justification has already been reviewed.');
        }

        $validated = $request->validate([
            'review_remarks' => 'nullable|string|max:1000',
        ]);

        try {
            DB::transaction(function () use ($justification, $validated) {
                // Re-fetch and lock the justification row to prevent concurrent/double review
                $locked = AttendanceJustification::whereKey($justification->id)
                    ->with('attendanceRecord')
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending') {
                    throw new RuntimeException('This justification has already been reviewed.');
                }

                // When approved, adjust the actual_time_out to operational_time_out
                if ($locked->attendanceRecord) {
                    $attendanceRecord = $locked->attendanceRecord;

                    // Update the actual timeout to expected timeout
                    $attendanceRecord->actual_time_out = $attendanceRecord->operational_time_out;

                    // Recalculate undertime (should be 0 after adjustment)
                    $attendanceRecord->undertime_minutes = 0;

                    // Update status based on other minutes
                    if ($attendanceRecord->late_minutes > 0 && $attendanceRecord->overtime_minutes === 0) {
                        $attendanceRecord->status = 'late';
                    } elseif ($attendanceRecord->late_minutes === 0 && $attendanceRecord->overtime_minutes > 0) {
                        $attendanceRecord->status = 'overtime';
                    } elseif ($attendanceRecord->late_minutes > 0 && $attendanceRecord->overtime_minutes > 0) {
                        $attendanceRecord->status = 'late_overtime';
                    } else {
                        $attendanceRecord->status = 'present';
                    }

                    $attendanceRecord->save();
                }

                $locked->update([
                    'status' => 'approved',
                    'reviewed_by' => Auth::id(),
                    'reviewed_at' => now(),
                    'review_remarks' => $validated['review_remarks'] ?? null,
                ]);
            });
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back();
    }

    /**
     * Reject an undertime justification (remarks required)
     */
    public function reject(Request $request, AttendanceJustification $justification)
    {
        if ($justification->type !== 'undertime') {
            return back()->with('error', 'Invalid justification type.');
        }

        if ($justification->status !== 'pending') {
            return back()->with('error', 'This justification has already been reviewed.');
        }

        $validated = $request->validate([
            'review_remarks' => 'required|string|min:5|max:1000',
        ]);

        try {
            DB::transaction(function () use ($justification, $validated) {
                // Re-fetch and lock the justification row to prevent concurrent/double review
                $locked = AttendanceJustification::whereKey($justification->id)
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending') {
                    throw new RuntimeException('This justification has already been reviewed.');
                }

                $locked->update([
                    'status' => 'rejected',
                    'reviewed_by' => Auth::id(),
                    'reviewed_at' => now(),
                    'review_remarks' => $validated['review_remarks'],
                ]);
            });
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back();
    }
}
