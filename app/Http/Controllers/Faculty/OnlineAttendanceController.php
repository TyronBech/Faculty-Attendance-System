<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\OnlineAttendanceRequest;
use App\Models\RequestAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OnlineAttendanceController extends Controller
{
    /**
     * Display the faculty's online attendance requests page.
     */
    public function index(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return Inertia::render('Faculty/OnlineAttendance', [
                'requests' => ['data' => [], 'total' => 0, 'per_page' => 10, 'current_page' => 1, 'last_page' => 1],
                'scheduleDetails' => [],
                'filters' => ['status' => ''],
            ]);
        }

        return Inertia::render('Faculty/OnlineAttendance', [
            'requests' => OnlineAttendanceRequest::getForFaculty($faculty->id, $request),
            'scheduleDetails' => $faculty->getScheduleDetailsForOnlineAttendance(),
            'filters' => [
                'status' => $request->query('status', ''),
            ],
        ]);
    }

    /**
     * AJAX endpoint: return filtered & paginated requests as JSON.
     */
    public function filter(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return response()->json([
                'data' => [],
                'total' => 0,
                'per_page' => 10,
                'current_page' => 1,
                'last_page' => 1,
            ]);
        }

        return response()->json(
            OnlineAttendanceRequest::getForFaculty($faculty->id, $request)
        );
    }

    /**
     * Store a new online attendance request.
     */
    public function store(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Faculty profile not found.']);
        }

        // Parse composite ID if provided (from the new dropdown logic)
        if ($request->has('schedule_detail_id') && is_string($request->schedule_detail_id) && str_contains($request->schedule_detail_id, '-')) {
            $parts = explode('-', $request->schedule_detail_id);
            $request->merge([
                'internal_schedule_id' => $parts[0] && $parts[0] !== '0' ? $parts[0] : null,
                'schedule_detail_id' => $parts[1] && $parts[1] !== '0' ? $parts[1] : null,
            ]);
        }

        // Final cleanup to ensure empty strings are null for validation
        if ($request->schedule_detail_id === '' || $request->schedule_detail_id === '0') {
            $request->merge(['schedule_detail_id' => null]);
        }
        if ($request->internal_schedule_id === '' || $request->internal_schedule_id === '0') {
            $request->merge(['internal_schedule_id' => null]);
        }
        if ($request->time_out === '') {
            $request->merge(['time_out' => null]);
        }

        $validated = $request->validate([
            'schedule_detail_id' => 'nullable|required_without:internal_schedule_id|exists:schedule_details,id',
            'internal_schedule_id' => 'nullable|required_without:schedule_detail_id|exists:internal_schedules,id',
            'class_type' => 'required|in:synchronous,asynchronous',
            'attendance_date' => 'required|date|before_or_equal:today',
            'time_in' => 'required|date_format:H:i',
            'time_out' => 'nullable|date_format:H:i|after:time_in',
            'screenshot_in' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
            'screenshot_out' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            'remarks' => 'nullable|string|max:1000',
            'force' => 'nullable|boolean',
            'attachments' => 'nullable|array',
            'attachments.*.file' => 'required|file|max:5120',
            'attachments.*.label' => 'nullable|string|max:255',
        ]);

        $force = (bool) ($validated['force'] ?? false);

        try {
            // Store screenshots
            $screenshotInPath = $request->file('screenshot_in')
                ->store("online-attendance/{$faculty->id}", 'public');
            $screenshotOutPath = $request->file('screenshot_out')
                ? $request->file('screenshot_out')->store("online-attendance/{$faculty->id}", 'public')
                : null;

            $result = $faculty->createOnlineAttendanceRequest($validated, $screenshotInPath, $screenshotOutPath, $force);

            if (! $result['success']) {
                // Clean up uploaded files on failure
                Storage::disk('public')->delete(array_filter([$screenshotInPath, $screenshotOutPath]));

                return back()->withErrors([$result['error_field'] => $result['error_message']]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to create online attendance request: '.$e->getMessage());

            return back()->withErrors(['error' => 'An unexpected error occurred. Please try again.']);
        }

        // Get the newly created request
        $onlineRequest = $faculty->onlineAttendanceRequests()->latest()->first();

        // Handle multiple file attachments
        if ($request->has('attachments') && is_array($request->attachments) && $onlineRequest) {
            $facultyDir = "attachments/faculty_{$faculty->id}/online_attendance";

            foreach ($request->attachments as $attachment) {
                try {
                    if (! isset($attachment['file'])) {
                        continue;
                    }

                    $file = $attachment['file'];
                    $label = $attachment['label'] ?? $file->getClientOriginalName();
                    $path = $file->store("{$facultyDir}/request_{$onlineRequest->id}", 'public');

                    if ($path) {
                        RequestAttachment::create([
                            'attachmentable_id' => $onlineRequest->id,
                            'attachmentable_type' => OnlineAttendanceRequest::class,
                            'file_path' => $path,
                            'custom_label' => $label,
                            'mime_type' => $file->getMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to save online attendance attachment: '.$e->getMessage());
                }
            }
        }

        return back()->with('success', 'Online attendance request submitted successfully.');
    }

    /**
     * Cancel (soft-delete) a pending online attendance request.
     */
    public function destroy(Request $request, OnlineAttendanceRequest $onlineAttendanceRequest)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Unauthorized.']);
        }

        $result = $faculty->cancelOnlineAttendanceRequest($onlineAttendanceRequest);

        if (! $result['success']) {
            return back()->withErrors(['error' => $result['error_message']]);
        }

        return back()->with('success', 'Online attendance request cancelled.');
    }

    /**
     * Check if attendance already exists for a given date.
     */
    public function checkAttendance(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return response()->json(['error' => 'Faculty profile not found.'], 404);
        }

        $date = $request->query('date');

        if (! $date) {
            return response()->json(['error' => 'Date is required.'], 400);
        }

        // Check for existing attendance record
        $hasAttendance = $faculty->attendanceRecords()
            ->where('attendance_date', $date)
            ->exists();

        // Check for pending online attendance request
        $hasPendingRequest = $faculty->onlineAttendanceRequests()
            ->where('attendance_date', $date)
            ->where('status', 'pending')
            ->exists();

        return response()->json([
            'has_attendance' => $hasAttendance,
            'has_pending_request' => $hasPendingRequest,
            'can_submit' => true, // We now allow submission with confirmation modal
        ]);
    }
}
