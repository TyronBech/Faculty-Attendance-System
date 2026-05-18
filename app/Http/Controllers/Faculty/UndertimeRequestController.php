<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\RequestAttachment;
use App\Models\UndertimeRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class UndertimeRequestController extends Controller
{
    /**
     * Display the faculty's undertime requests page.
     */
    public function index(Request $request)
    {
        $faculty = $request->user()->faculty;
        $isTemporarySubstituteFaculty = $this->isTemporarySubstituteFaculty($faculty);

        if (! $faculty) {
            return Inertia::render('Faculty/UndertimeRequests', [
                'requests' => ['data' => [], 'total' => 0, 'per_page' => 10, 'current_page' => 1, 'last_page' => 1],
                'filters' => ['status' => ''],
            ]);
        }

        $status = $request->query('status', '');
        $query = $faculty->undertimeRequests()->where('type', 'undertime');

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $query->where('status', $status);
        }

        $requests = $query->with(['attendanceRecord.scheduleDetail', 'attendanceRecord.internalSchedule', 'reviewedBy', 'attachments'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        // Add attachment URLs and course info to each request
        $requests->through(function ($req) use ($isTemporarySubstituteFaculty) {
            $req->attachment_url = $req->getAttachmentUrl();
            $req->attachments_data = $req->getAttachmentsData();

            // Add course information for display
            if ($req->attendanceRecord) {
                if ($req->attendanceRecord->scheduleDetail) {
                    $baseCourseName = $req->attendanceRecord->scheduleDetail->course_title
                        ?? $req->attendanceRecord->scheduleDetail->course_code
                        ?? 'Unknown Course';
                    $req->course_name = $isTemporarySubstituteFaculty
                        ? $baseCourseName.' (Temporary Substitute)'
                        : $baseCourseName;
                } elseif ($req->attendanceRecord->internalSchedule) {
                    $req->course_name = 'Operational Duty';
                } else {
                    $req->course_name = 'Unknown Course';
                }
            } else {
                $req->course_name = 'Unknown Course';
            }

            return $req;
        });

        // Get schedules with undertime for the request form
        $schedulesWithUndertime = AttendanceRecord::query()
            ->where('faculty_id', $faculty->id)
            ->where('undertime_minutes', '>', 0)
            ->with(['scheduleDetail', 'internalSchedule'])
            ->orderBy('attendance_date', 'desc')
            ->get()
            ->map(function ($record) use ($faculty, $isTemporarySubstituteFaculty) {
                $hasRequest = $faculty->undertimeRequests()
                    ->where('type', 'undertime')
                    ->where('attendance_record_id', $record->id)
                    ->whereIn('status', ['pending', 'approved'])
                    ->exists();

                $scheduleType = 'official';
                $subject = 'Operational Duty';
                $code = '';
                $room = '';
                $time_in = '';
                $time_out = '';
                $required_hours = 0;
                $year_level = '';
                $section_name = '';
                $program_code = '';

                if ($record->scheduleDetail) {
                    $scheduleType = $isTemporarySubstituteFaculty ? 'temporary_substitute' : 'official';
                    $baseSubject = $record->scheduleDetail->course_title ?? $record->scheduleDetail->course_code ?? 'Unknown Course';
                    $subject = $isTemporarySubstituteFaculty
                        ? $baseSubject.' (Temporary Substitute)'
                        : $baseSubject;
                    $code = $record->scheduleDetail->course_code ?? '';
                    $room = $record->scheduleDetail->room_code ?? 'TBA';
                    $time_in = $record->official_time_in ? $record->official_time_in->format('h:i A') : '';
                    $time_out = $record->official_time_out ? $record->official_time_out->format('h:i A') : '';
                    $required_hours = $record->scheduleDetail->hours_required ?? $record->required_hours ?? 0;
                    $year_level = $record->scheduleDetail->year_level ?? '';
                    $section_name = $record->scheduleDetail->section_name ?? '';
                    $program_code = $record->scheduleDetail->program_code ?? '';
                } elseif ($record->internalSchedule) {
                    $scheduleType = 'internal';
                    $subject = 'Operational Duty';
                    $code = '';
                    $room = 'TBA';
                    $time_in = $record->operational_time_in ? $record->operational_time_in->format('h:i A') : '';
                    $time_out = $record->operational_time_out ? $record->operational_time_out->format('h:i A') : '';
                    $required_hours = $record->internalSchedule->required_hours ?? $record->required_hours ?? 0;
                }

                return [
                    'id' => $record->id,
                    'subject' => $subject,
                    'code' => $code,
                    'room' => $room,
                    'year_level' => $year_level,
                    'section_name' => $section_name,
                    'program_code' => $program_code,
                    'course_title' => $subject,
                    'attendance_date' => $record->attendance_date ? $record->attendance_date->format('M d, Y') : '',
                    'day_of_week' => $record->day_of_week,
                    'scheduled_time_in' => $time_in,
                    'scheduled_time_out' => $time_out,
                    'actual_time_in' => $record->actual_time_in ? $record->actual_time_in->format('h:i A') : 'N/A',
                    'actual_time_out' => $record->actual_time_out ? $record->actual_time_out->format('h:i A') : 'N/A',
                    'required_hours' => $required_hours,
                    'total_hours_rendered' => $record->total_hours_rendered ?? 0,
                    'undertime_minutes' => $record->undertime_minutes,
                    'schedule_type' => $scheduleType,
                    'has_request' => $hasRequest,
                ];
            });

        return Inertia::render('Faculty/UndertimeRequests', [
            'requests' => $requests,
            'filters' => [
                'status' => $status,
            ],
            'schedulesWithUndertime' => $schedulesWithUndertime->values(),
            'commonReasons' => [
                'Medical concerns or health issues',
                'Family emergency',
                'Vehicle or transportation issues',
                'System/biometric machine error',
                'Urgent administrative matter',
                'Weather-related incident',
                'Authorized early leave approval',
                'Class dismissal by instructor',
            ],
        ]);
    }

    /**
     * Store a new undertime request.
     */
    public function store(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Faculty profile not found.']);
        }

        $validated = $request->validate([
            'attendance_record_id' => 'nullable|exists:attendance_records,id',
            'reason' => 'required|string|max:1000',
            'attachments' => 'nullable|array',
            'attachments.*.file' => 'required|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120',
            'attachments.*.label' => 'required|string|max:255',
        ]);

        // If attendance_record_id is provided, verify it belongs to this faculty
        if ($validated['attendance_record_id']) {
            $attendanceRecord = AttendanceRecord::findOrFail($validated['attendance_record_id']);
            if ($attendanceRecord->faculty_id !== $faculty->id) {
                return back()->withErrors(['error' => 'Unauthorized.']);
            }
        }

        $undertimeRequest = new UndertimeRequest([
            'faculty_id' => $faculty->id,
            'attendance_record_id' => $validated['attendance_record_id'] ?? null,
            'type' => 'undertime',
            'justification' => $validated['reason'],
            'status' => 'pending',
        ]);

        $undertimeRequest->save();

        // Handle multiple file attachments
        if (! empty($validated['attachments'])) {
            $facultyDir = "attachments/faculty_{$faculty->id}/undertime_requests";

            foreach ($validated['attachments'] as $attachment) {
                try {
                    $file = $attachment['file'];
                    $label = $attachment['label'];
                    $path = $file->store("{$facultyDir}/request_{$undertimeRequest->id}", 'public');

                    if ($path) {
                        RequestAttachment::create([
                            'attachmentable_id' => $undertimeRequest->id,
                            'attachmentable_type' => UndertimeRequest::class,
                            'file_path' => $path,
                            'custom_label' => $label,
                            'mime_type' => $file->getMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to save undertime attachment: '.$e->getMessage());
                }
            }
        }

        return redirect(route('faculty.undertime-requests.index'))->with('success', 'Undertime request submitted successfully.');
    }

    /**
     * Cancel (soft-delete) a pending undertime request.
     */
    public function destroy(Request $request, UndertimeRequest $undertimeRequest)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty || $undertimeRequest->faculty_id !== $faculty->id) {
            return back()->withErrors(['error' => 'Unauthorized.']);
        }

        if ($undertimeRequest->status !== 'pending') {
            return back()->withErrors(['error' => 'Can only cancel pending requests.']);
        }

        // Delete associated attachments
        foreach ($undertimeRequest->attachments as $attachment) {
            $attachment->deleteFile();
            $attachment->delete();
        }

        // Keep legacy support for old attachment_path field
        if ($undertimeRequest->attachment_path && Storage::disk('public')->exists($undertimeRequest->attachment_path)) {
            Storage::disk('public')->delete($undertimeRequest->attachment_path);
        }

        $undertimeRequest->delete();

        return back()->with('success', 'Undertime request cancelled.');
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

        $status = $request->query('status', '');
        $query = $faculty->undertimeRequests()->where('type', 'undertime');

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $query->where('status', $status);
        }

        $requests = $query->with(['attendanceRecord.scheduleDetail', 'attendanceRecord.internalSchedule', 'reviewedBy', 'attachments'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        // Add attachment URLs and course info to each request
        $requests->through(function ($req) use ($faculty) {
            $isTemporarySubstituteFaculty = $this->isTemporarySubstituteFaculty($faculty);
            $req->attachment_url = $req->getAttachmentUrl();
            $req->attachments_data = $req->getAttachmentsData();

            // Add course information for display
            if ($req->attendanceRecord) {
                if ($req->attendanceRecord->scheduleDetail) {
                    $baseCourseName = $req->attendanceRecord->scheduleDetail->course_title
                        ?? $req->attendanceRecord->scheduleDetail->course_code
                        ?? 'Unknown Course';
                    $req->course_name = $isTemporarySubstituteFaculty
                        ? $baseCourseName.' (Temporary Substitute)'
                        : $baseCourseName;
                } elseif ($req->attendanceRecord->internalSchedule) {
                    $req->course_name = 'Operational Duty';
                } else {
                    $req->course_name = 'Unknown Course';
                }
            } else {
                $req->course_name = 'Unknown Course';
            }

            return $req;
        });

        return response()->json($requests);
    }

    private function isTemporarySubstituteFaculty(mixed $faculty): bool
    {
        if (! $faculty) {
            return false;
        }

        return strcasecmp((string) ($faculty->employment_type ?? ''), 'substitute') === 0
            || strcasecmp((string) ($faculty->faculty_type ?? ''), 'substitute') === 0;
    }
}
