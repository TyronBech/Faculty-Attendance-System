<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\OnlineAttendanceRequest;
use App\Models\RequestAttachment;
use App\Services\ScreenshotTimestampDetector;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
    public function store(Request $request, ScreenshotTimestampDetector $screenshotTimestampDetector)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty || ! $faculty->id) {
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
            'screenshot_in_last_modified_at' => 'nullable|integer|min:1',
            'screenshot_out_last_modified_at' => 'nullable|integer|min:1',
            'attachments' => 'nullable|array',
            'attachments.*.file' => 'required|file|max:5120',
            'attachments.*.label' => 'nullable|string|max:255',
        ]);

        $screenshotInFile = $request->file('screenshot_in');
        $screenshotOutFile = $request->file('screenshot_out');

        if (! $screenshotInFile instanceof UploadedFile || ! $screenshotInFile->isValid()) {
            return back()->withErrors([
                'screenshot_in' => 'The Time In screenshot upload is invalid. Please upload the file again.',
            ])->withInput();
        }

        if ($screenshotOutFile && ! $screenshotOutFile->isValid()) {
            return back()->withErrors([
                'screenshot_out' => 'The Time Out screenshot upload is invalid. Please upload the file again.',
            ])->withInput();
        }

        $force = (bool) ($validated['force'] ?? false);
        $screenshotInDetection = $screenshotTimestampDetector->detect(
            $screenshotInFile,
            $validated['attendance_date'],
            $validated['time_in'],
            $validated['screenshot_in_last_modified_at'] ?? null,
        );
        $screenshotOutDetection = $screenshotOutFile
            ? $screenshotTimestampDetector->detect(
                $screenshotOutFile,
                $validated['attendance_date'],
                $validated['time_out'] ?? null,
                $validated['screenshot_out_last_modified_at'] ?? null,
            )
            : [];

        $timeInValidationError = $this->validateDetectedScreenshotTime(
            attendanceDate: $validated['attendance_date'],
            submittedTime: $validated['time_in'],
            detection: $screenshotInDetection,
            field: 'time_in',
            label: 'Time In',
        );

        if ($timeInValidationError) {
            return back()->withErrors($timeInValidationError)->withInput();
        }

        $timeOutValidationError = null;
        if ($screenshotOutFile) {
            $timeOutValidationError = $this->validateDetectedScreenshotTime(
                attendanceDate: $validated['attendance_date'],
                submittedTime: $validated['time_out'],
                detection: $screenshotOutDetection,
                field: 'time_out',
                label: 'Time Out',
            );

            if ($timeOutValidationError) {
                return back()->withErrors($timeOutValidationError)->withInput();
            }
        }

        try {
            // Construct storage path explicitly with proper Laravel path formatting
            $facultyId = (string) $faculty->id;
            if (! $facultyId || $facultyId === '' || $facultyId === '0') {
                throw new \RuntimeException('Faculty ID is invalid or empty.');
            }

            $storagePath = 'online-attendance/'.$facultyId;

            // Get the storage disk
            $disk = Storage::disk('public');

            // Generate random filenames
            $screenshotInFileName = Str::random(32).'.'.$screenshotInFile->extension();
            $screenshotInFullPath = $storagePath.'/'.$screenshotInFileName;

            // Store the Time In screenshot using put() with file contents
            $storedScreenshotPaths = [];

            try {
                $screenshotInContents = file_get_contents($screenshotInFile->getPathname());
                if ($screenshotInContents === false) {
                    throw new \RuntimeException('Failed to read the Time In screenshot.');
                }

                if (! $disk->put($screenshotInFullPath, $screenshotInContents)) {
                    throw new \RuntimeException('Failed to write the Time In screenshot to storage.');
                }
                $screenshotInPath = $screenshotInFullPath;
                $storedScreenshotPaths[] = $screenshotInPath;

                $screenshotOutPath = null;
                if ($screenshotOutFile) {
                    $screenshotOutFileName = Str::random(32).'.'.$screenshotOutFile->extension();
                    $screenshotOutFullPath = $storagePath.'/'.$screenshotOutFileName;

                    $screenshotOutContents = file_get_contents($screenshotOutFile->getPathname());
                    if ($screenshotOutContents === false) {
                        throw new \RuntimeException('Failed to read the Time Out screenshot.');
                    }

                    if (! $disk->put($screenshotOutFullPath, $screenshotOutContents)) {
                        throw new \RuntimeException('Failed to write the Time Out screenshot to storage.');
                    }
                    $screenshotOutPath = $screenshotOutFullPath;
                    $storedScreenshotPaths[] = $screenshotOutPath;
                }

                if (! is_string($screenshotInPath) || $screenshotInPath === '') {
                    throw new \RuntimeException('Failed to store the Time In screenshot.');
                }

                if ($screenshotOutFile && (! is_string($screenshotOutPath) || $screenshotOutPath === '')) {
                    throw new \RuntimeException('Failed to store the Time Out screenshot.');
                }

                $result = $faculty->createOnlineAttendanceRequest(
                    $validated,
                    $screenshotInPath,
                    $screenshotOutPath,
                    $screenshotInDetection,
                    $screenshotOutDetection,
                    $force,
                );

                $storedScreenshotPaths = [];
            } catch (\Throwable $e) {
                foreach ($storedScreenshotPaths as $storedScreenshotPath) {
                    if (! is_string($storedScreenshotPath) || $storedScreenshotPath === '') {
                        continue;
                    }

                    try {
                        $disk->delete($storedScreenshotPath);
                    } catch (\Throwable $cleanupException) {
                        Log::warning('Failed to rollback stored screenshot after attendance request error.', [
                            'path' => $storedScreenshotPath,
                            'error' => $cleanupException->getMessage(),
                        ]);
                    }
                }

                throw $e;
            }

            if (! $result['success']) {
                // Clean up uploaded files on failure
                Storage::disk('public')->delete(array_filter([$screenshotInPath, $screenshotOutPath]));

                return back()->withErrors([$result['error_field'] => $result['error_message']]);
            }

            // Get the created or updated request from the result
            $onlineRequest = $result['request'] ?? null;

            // Handle multiple file attachments
            if ($request->has('attachments') && is_array($request->attachments) && $onlineRequest) {
                $facultyDir = 'attachments/faculty_'.$facultyId.'/online_attendance';
                $disk = Storage::disk('public');

                foreach ($request->attachments as $attachment) {
                    try {
                        if (! isset($attachment['file'])) {
                            continue;
                        }

                        $file = $attachment['file'];
                        $label = $attachment['label'] ?? $file->getClientOriginalName();
                        $attachmentPath = $facultyDir.'/request_'.$onlineRequest->id;
                        $attachmentFileName = Str::random(32).'.'.$file->extension();
                        $attachmentFullPath = $attachmentPath.'/'.$attachmentFileName;

                        // Store attachment using put() with file contents
                        $fileContents = file_get_contents($file->getPathname());
                        if ($fileContents === false) {
                            Log::error('Failed to read attachment file: '.$file->getClientOriginalName());

                            continue;
                        }

                        if (! $disk->put($attachmentFullPath, $fileContents)) {
                            Log::error('Failed to write attachment file to storage: '.$file->getClientOriginalName());

                            continue;
                        }
                        $path = $attachmentFullPath;

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
                    } catch (\Throwable $e) {
                        Log::error('Failed to save online attendance attachment: '.$e->getMessage());
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('Failed to create online attendance request: '.$e->getMessage());

            return back()->withErrors(['error' => 'An unexpected error occurred. Please try again.']);
        }

        return back()->with('success', 'Online attendance request submitted successfully.');
    }

    /**
     * @param  array<string, mixed>  $detection
     * @return array<string, string>|null
     */
    private function validateDetectedScreenshotTime(
        string $attendanceDate,
        string $submittedTime,
        array $detection,
        string $field,
        string $label,
    ): ?array {
        $detectionSource = $detection['source'] ?? null;
        $detectedAt = $detection['detected_at'] ?? null;

        if (! in_array($detectionSource, ['metadata', 'client_file_modified_at', 'filename'], true) || ! $detectedAt instanceof Carbon) {
            return null;
        }

        $submittedDateTime = Carbon::createFromFormat('Y-m-d H:i', "{$attendanceDate} {$submittedTime}", config('app.timezone'));
        $detectedAtRoundedToMinute = $detectedAt->copy()->second(0);

        // Compare full datetimes to ensure we check across date boundaries correctly
        if ($submittedDateTime->lt($detectedAtRoundedToMinute)) {
            return [
                $field => "{$label} cannot be earlier than the detected screenshot time of {$detectedAtRoundedToMinute->format('M d, Y h:i A')}.",
            ];
        }

        return null;
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
