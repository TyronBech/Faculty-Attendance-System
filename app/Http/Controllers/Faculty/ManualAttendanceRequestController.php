<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\AttendanceJustification;
use App\Models\AttendanceRecord;
use App\Models\RequestAttachment;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class ManualAttendanceRequestController extends Controller
{
    /**
     * Display faculty's manual attendance requests
     */
    public function index(Request $request)
    {
        $faculty = $request->user()->faculty;
        $manualRequestLimit = SystemSetting::manualAttendanceRequestLimit();

        if (! $faculty) {
            return Inertia::render('Faculty/ManualAttendanceRequests', [
                'requests' => ['data' => [], 'total' => 0, 'per_page' => 10, 'current_page' => 1, 'last_page' => 1],
                'filters' => ['status' => ''],
                'availableDates' => [],
                'approvedCountingRequestsCount' => 0,
                'manualRequestLimit' => $manualRequestLimit,
            ]);
        }

        $temporarySchedulesByDay = $faculty->temporaryFacultySchedules()
            ->get()
            ->groupBy(fn ($schedule) => $schedule->day ?: 'Monday');
        $isTemporarySubstituteFaculty = $faculty->isTemporarySubstitute();

        $status = $request->query('status', '');
        $query = AttendanceJustification::query()
            ->where('faculty_id', $faculty->id)
            ->where('type', 'manual_time');

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $query->where('status', $status);
        }

        $requests = $query->with(['attendanceRecord.scheduleDetail', 'attendanceRecord.internalSchedule', 'reviewer', 'attachments'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        // Add formatted data
        $requests->through(function ($req) use ($faculty, $temporarySchedulesByDay, $isTemporarySubstituteFaculty) {
            $req->attachment_url = $req->getAttachmentUrl();
            $req->attachments_data = $req->getAttachmentsData();
            if ($req->attendanceRecord) {
                $isTemporarySubstituteRecord = $isTemporarySubstituteFaculty
                    && $faculty->hasTemporarySubstituteAttendanceRecord(
                        $req->attendanceRecord,
                        $temporarySchedulesByDay
                    );
                $baseCourseName = $req->attendanceRecord->scheduleDetail?->course_title
                    ?? $req->attendanceRecord->internalSchedule?->name
                    ?? 'Unknown Course';
                $req->course_name = $isTemporarySubstituteRecord
                    ? $baseCourseName.' (Temporary Substitute)'
                    : $baseCourseName;
                $req->attendance_date = $req->attendanceRecord->attendance_date->format('Y-m-d');
            }

            return $req;
        });

        // Count all requests that count toward the configured limit (exclude pending requests)
        $approvedCountingRequests = AttendanceJustification::query()
            ->where('faculty_id', $faculty->id)
            ->where('type', 'manual_time')
            ->where('counts_as_manual_log', true)
            ->whereNot('status', 'pending')
            ->count();

        // Get dates with missing time entries for form
        $availableDates = AttendanceRecord::query()
            ->where('faculty_id', $faculty->id)
            ->where(function ($q) {
                $q->whereNull('actual_time_in')
                    ->orWhereNull('actual_time_out');
            })
            ->with(['scheduleDetail', 'internalSchedule'])
            ->orderBy('attendance_date', 'desc')
            ->get()
            ->map(function ($record) use ($faculty, $temporarySchedulesByDay, $isTemporarySubstituteFaculty) {
                $hasPendingRequest = AttendanceJustification::query()
                    ->where('faculty_id', $faculty->id)
                    ->where('type', 'manual_time')
                    ->where('attendance_record_id', $record->id)
                    ->where('status', 'pending')
                    ->exists();

                $baseCourseName = $record->scheduleDetail?->course_title ?? $record->internalSchedule?->name ?? 'Unknown';
                $isTemporarySubstituteRecord = $isTemporarySubstituteFaculty
                    && $faculty->hasTemporarySubstituteAttendanceRecord(
                        $record,
                        $temporarySchedulesByDay
                    );

                return [
                    'id' => $record->id,
                    'attendance_date' => $record->attendance_date->format('Y-m-d'),
                    'course_name' => $isTemporarySubstituteRecord
                        ? $baseCourseName.' (Temporary Substitute)'
                        : $baseCourseName,
                    'schedule_type' => $record->scheduleDetail
                        ? ($isTemporarySubstituteRecord ? 'temporary_substitute' : 'official')
                        : 'operational',
                    'has_pending_request' => $hasPendingRequest,
                    'actual_time_in' => $record->actual_time_in?->format('H:i'),
                    'actual_time_out' => $record->actual_time_out?->format('H:i'),
                ];
            });

        return Inertia::render('Faculty/ManualAttendanceRequests', [
            'requests' => $requests,
            'filters' => ['status' => $status],
            'availableDates' => $availableDates,
            'approvedCountingRequestsCount' => $approvedCountingRequests,
            'manualRequestLimit' => $manualRequestLimit,
        ]);
    }

    /**
     * Store a new manual attendance request
     */
    public function store(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Faculty profile not found.']);
        }

        $validated = $request->validate([
            'attendance_record_id' => 'required|exists:attendance_records,id',
            'requested_time_in' => 'required|date_format:H:i',
            'requested_time_out' => 'required|date_format:H:i|after:requested_time_in',
            'justification' => 'required|string|max:1000',
            'attachments' => 'nullable|array',
            'attachments.*.file' => 'required|file|max:5120|mimes:pdf,doc,docx,jpg,jpeg,png',
            'attachments.*.label' => 'required|string|max:255',
        ]);

        $attendanceRecord = AttendanceRecord::find($validated['attendance_record_id']);

        // Check if attendance record belongs to faculty
        if ($attendanceRecord->faculty_id !== $faculty->id) {
            return back()->withErrors(['error' => 'Unauthorized']);
        }

        // Combine date with time (store as datetime without timezone conversion)
        $attendanceDate = $attendanceRecord->attendance_date->toDateString();
        $requestedTimeIn = Carbon::createFromFormat('Y-m-d H:i', "{$attendanceDate} {$validated['requested_time_in']}", 'Asia/Manila');
        $requestedTimeOut = Carbon::createFromFormat('Y-m-d H:i', "{$attendanceDate} {$validated['requested_time_out']}", 'Asia/Manila');

        $justification = AttendanceJustification::create([
            'faculty_id' => $faculty->id,
            'attendance_record_id' => $attendanceRecord->id,
            'type' => 'manual_time',
            'requested_time_in' => $requestedTimeIn,
            'requested_time_out' => $requestedTimeOut,
            'justification' => $validated['justification'],
            'status' => 'pending',
            'counts_as_manual_log' => false,
        ]);

        // Handle multiple file attachments
        if (! empty($validated['attachments'])) {
            $facultyDir = "attachments/faculty_{$faculty->id}/manual_attendance_requests";

            foreach ($validated['attachments'] as $attachment) {
                try {
                    $file = $attachment['file'];
                    $label = $attachment['label'];
                    $path = $file->store("{$facultyDir}/request_{$justification->id}", 'public');

                    if ($path) {
                        RequestAttachment::create([
                            'attachmentable_id' => $justification->id,
                            'attachmentable_type' => AttendanceJustification::class,
                            'file_path' => $path,
                            'custom_label' => $label,
                            'mime_type' => $file->getMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to save manual attendance attachment: '.$e->getMessage());
                }
            }
        }

        return back()->with('success', 'Manual attendance request submitted successfully');
    }

    /**
     * Delete a manual attendance request
     */
    public function destroy(AttendanceJustification $attendanceJustification, Request $request)
    {
        $faculty = $request->user()->faculty;

        if ($attendanceJustification->faculty_id !== $faculty->id || $attendanceJustification->type !== 'manual_time') {
            return back()->withErrors(['error' => 'Unauthorized']);
        }

        if ($attendanceJustification->status !== 'pending') {
            return back()->withErrors(['error' => 'Can only delete pending requests']);
        }

        $attendanceJustification->delete();

        return back()->with('success', 'Request deleted successfully');
    }

    /**
     * Filter requests (AJAX)
     */
    public function filter(Request $request)
    {
        $faculty = $request->user()->faculty;
        $manualRequestLimit = SystemSetting::manualAttendanceRequestLimit();

        if (! $faculty) {
            return response()->json([
                'data' => [],
                'total' => 0,
                'per_page' => 10,
                'current_page' => 1,
                'last_page' => 1,
                'approvedCountingRequestsCount' => 0,
                'manualRequestLimit' => $manualRequestLimit,
            ]);
        }

        $temporarySchedulesByDay = $faculty->temporaryFacultySchedules()
            ->get()
            ->groupBy(fn ($schedule) => $schedule->day ?: 'Monday');
        $isTemporarySubstituteFaculty = $faculty->isTemporarySubstitute();

        $status = $request->query('status', '');
        $query = AttendanceJustification::query()
            ->where('faculty_id', $faculty->id)
            ->where('type', 'manual_time');

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $query->where('status', $status);
        }

        $requests = $query->with(['attendanceRecord.scheduleDetail', 'attendanceRecord.internalSchedule', 'reviewer', 'attachments'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        $requests->through(function ($req) use ($faculty, $temporarySchedulesByDay, $isTemporarySubstituteFaculty) {
            $req->attachment_url = $req->getAttachmentUrl();
            $req->attachments_data = $req->getAttachmentsData();
            if ($req->attendanceRecord) {
                $isTemporarySubstituteRecord = $isTemporarySubstituteFaculty
                    && $faculty->hasTemporarySubstituteAttendanceRecord(
                        $req->attendanceRecord,
                        $temporarySchedulesByDay
                    );
                $baseCourseName = $req->attendanceRecord->scheduleDetail?->course_title
                    ?? $req->attendanceRecord->internalSchedule?->name
                    ?? 'N/A';
                $req->course_name = $isTemporarySubstituteRecord
                    ? $baseCourseName.' (Temporary Substitute)'
                    : $baseCourseName;
            }

            return $req;
        });

        // Count all requests that count toward the 5-limit (exclude pending requests)
        $approvedCountingRequests = AttendanceJustification::query()
            ->where('faculty_id', $faculty->id)
            ->where('type', 'manual_time')
            ->where('counts_as_manual_log', true)
            ->whereNot('status', 'pending')
            ->count();

        $responseData = $requests->toArray();
        $responseData['approvedCountingRequestsCount'] = $approvedCountingRequests;
        $responseData['manualRequestLimit'] = $manualRequestLimit;

        return response()->json($responseData);
    }
}
