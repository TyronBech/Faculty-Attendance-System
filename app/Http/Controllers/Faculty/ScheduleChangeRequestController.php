<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\RequestAttachment;
use App\Models\Room;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class ScheduleChangeRequestController extends Controller
{
    /**
     * Display the faculty's schedule change requests page.
     */
    public function index(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return Inertia::render('Faculty/ScheduleChangeRequests', [
                'requests' => ['data' => [], 'total' => 0, 'per_page' => 10, 'current_page' => 1, 'last_page' => 1],
                'scheduleDetails' => [],
                'rooms' => [],
                'filters' => ['status' => ''],
            ]);
        }

        return Inertia::render('Faculty/ScheduleChangeRequests', [
            'requests' => ScheduleChangeRequest::getForFaculty($faculty->id, $request),
            'scheduleDetails' => $faculty->getScheduleDetailsForChangeRequest(),
            'rooms' => Room::orderBy('room_code')->get(),
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
            ScheduleChangeRequest::getForFaculty($faculty->id, $request)
        );
    }

    /**
     * Store a new schedule change request.
     */
    public function store(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Faculty profile not found.']);
        }

        $validated = $request->validate([
            'schedule_detail_id' => 'required|exists:schedule_details,id',
            'requested_day_of_week' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'requested_time_in' => 'required|date_format:H:i',
            'requested_time_out' => 'required|date_format:H:i|after:requested_time_in',
            'requested_room' => 'required|string|max:100',
            'effective_date' => 'required|date|after_or_equal:today',
            'reason' => 'required|string|max:1000',
            'attachments' => 'nullable|array',
            'attachments.*.file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'attachments.*.label' => 'required|string|max:255',
        ]);

        $result = $faculty->createScheduleChangeRequest($validated);

        if (! $result['success']) {
            return back()->withErrors([$result['error_field'] => $result['error_message']]);
        }

        // Get the newly created request
        $scheduleChangeRequest = $faculty->scheduleChangeRequests()
            ->where('schedule_detail_id', $validated['schedule_detail_id'])
            ->latest()
            ->first();

        // Handle multiple file attachments
        if (! empty($validated['attachments']) && $scheduleChangeRequest) {
            $facultyDir = "attachments/faculty_{$faculty->id}/schedule_change_requests";

            foreach ($validated['attachments'] as $attachment) {
                try {
                    $file = $attachment['file'];
                    $label = $attachment['label'];
                    $path = $file->store("{$facultyDir}/request_{$scheduleChangeRequest->id}", 'public');

                    if ($path) {
                        RequestAttachment::create([
                            'attachmentable_id' => $scheduleChangeRequest->id,
                            'attachmentable_type' => ScheduleChangeRequest::class,
                            'file_path' => $path,
                            'custom_label' => $label,
                            'mime_type' => $file->getMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to save schedule change attachment: '.$e->getMessage());
                }
            }
        }

        return back()->with('success', 'Schedule change request submitted successfully.');
    }

    /**
     * Cancel (soft-delete) a pending schedule change request.
     */
    public function destroy(Request $request, ScheduleChangeRequest $scheduleChangeRequest)
    {
        $faculty = $request->user()->faculty;

        if (! $faculty) {
            return back()->withErrors(['error' => 'Unauthorized.']);
        }

        $result = $faculty->cancelScheduleChangeRequest($scheduleChangeRequest);

        if (! $result['success']) {
            return back()->withErrors(['error' => $result['error_message']]);
        }

        return back()->with('success', 'Schedule change request cancelled.');
    }

    /**
     * AJAX: Check for room & time conflicts before submitting.
     */
    public function checkConflict(Request $request)
    {
        $validated = $request->validate([
            'schedule_detail_id' => 'required|integer',
            'requested_day_of_week' => 'nullable|string',
            'requested_time_in' => 'nullable|date_format:H:i',
            'requested_time_out' => 'nullable|date_format:H:i|after:requested_time_in',
            'requested_room' => 'nullable|string|max:100',
        ]);

        $faculty = $request->user()->faculty;
        $conflicts = [];

        // 1. Check if a pending request already exists for this schedule
        $existingPending = $faculty->scheduleChangeRequests()
            ->where('schedule_detail_id', $validated['schedule_detail_id'])
            ->where('status', 'pending')
            ->exists();

        if ($existingPending) {
            $conflicts[] = [
                'type' => 'duplicate',
                'message' => 'You already have a pending request for this schedule.',
            ];
        }

        $reqDay = $validated['requested_day_of_week'] ?? null;
        $reqIn = $validated['requested_time_in'] ?? null;
        $reqOut = $validated['requested_time_out'] ?? null;
        $reqRoom = trim($validated['requested_room'] ?? '');

        // 2. Check room + time conflicts against ALL faculties' schedules (same room AND overlapping time)
        if ($reqDay && $reqIn && $reqOut && $reqRoom !== '') {
            $roomConflict = ScheduleDetail::whereHas('schedule', function ($q) {
                $q->where('status', 'active');
            })
                ->where('id', '!=', $validated['schedule_detail_id'])
                ->where('day', $reqDay)
                ->where('room_code', $reqRoom)
                ->where(function ($q) use ($reqIn, $reqOut) {
                    $q->whereRaw('TIME(start_time) < ?', [$reqOut])
                        ->whereRaw('TIME(end_time) > ?', [$reqIn]);
                })
                ->with('schedule.faculty')
                ->first();

            if ($roomConflict) {
                $occupant = $roomConflict->schedule?->faculty?->full_name ?? 'another faculty';
                $conflicts[] = [
                    'type' => 'room',
                    'message' => "Room {$reqRoom} is occupied by {$occupant} for {$roomConflict->course_code} ("
                        .Carbon::parse($roomConflict->start_time)->format('H:i').'–'
                        .Carbon::parse($roomConflict->end_time)->format('H:i').") on {$reqDay}.",
                ];
            }

            // Also check room in pending/approved change requests from other faculties
            $roomChangeConflict = ScheduleChangeRequest::where('faculty_id', '!=', $faculty->id)
                ->whereIn('status', ['pending', 'approved'])
                ->where('requested_day_of_week', $reqDay)
                ->where('requested_room', $reqRoom)
                ->where(function ($q) use ($reqIn, $reqOut) {
                    $q->where('requested_time_in', '<', $reqOut)
                        ->where('requested_time_out', '>', $reqIn);
                })
                ->with('faculty')
                ->first();

            if ($roomChangeConflict) {
                $changeOccupant = $roomChangeConflict->faculty?->full_name ?? 'another faculty';
                $conflicts[] = [
                    'type' => 'room_request',
                    'message' => "Room {$reqRoom} has a pending/approved request by {$changeOccupant} ("
                        .Carbon::parse($roomChangeConflict->requested_time_in)->format('H:i').'–'
                        .Carbon::parse($roomChangeConflict->requested_time_out)->format('H:i').") on {$reqDay}.",
                ];
            }

            // 3. Check if the faculty themselves has another class at this time (Faculty Schedule Conflict)
            $facultyConflict = ScheduleDetail::whereHas('schedule', function ($q) use ($faculty) {
                $q->where('faculty_id', $faculty->id)
                    ->where('status', 'active');
            })
                ->where('id', '!=', $validated['schedule_detail_id'])
                ->where('day', $reqDay)
                ->where(function ($q) use ($reqIn, $reqOut) {
                    $q->whereRaw('TIME(start_time) < ?', [$reqOut])
                        ->whereRaw('TIME(end_time) > ?', [$reqIn]);
                })
                ->first();

            if ($facultyConflict) {
                $conflicts[] = [
                    'type' => 'faculty',
                    'message' => "You already have another class ({$facultyConflict->course_code}) on {$reqDay} at this time ("
                        .Carbon::parse($facultyConflict->start_time)->format('H:i').'–'
                        .Carbon::parse($facultyConflict->end_time)->format('H:i').').',
                ];
            }

            // 4. Check if the faculty has another pending/approved request at this time
            $facultyRequestConflict = ScheduleChangeRequest::where('faculty_id', $faculty->id)
                ->where('id', '!=', $request->input('request_id')) // In case of editing
                ->where('schedule_detail_id', '!=', $validated['schedule_detail_id'])
                ->whereIn('status', ['pending', 'approved'])
                ->where('requested_day_of_week', $reqDay)
                ->where(function ($q) use ($reqIn, $reqOut) {
                    $q->where('requested_time_in', '<', $reqOut)
                        ->where('requested_time_out', '>', $reqIn);
                })
                ->first();

            if ($facultyRequestConflict) {
                $conflicts[] = [
                    'type' => 'faculty_request',
                    'message' => "You have another pending/approved request on {$reqDay} at this time ("
                        .Carbon::parse($facultyRequestConflict->requested_time_in)->format('H:i').'–'
                        .Carbon::parse($facultyRequestConflict->requested_time_out)->format('H:i').').',
                ];
            }
        }

        return response()->json([
            'has_conflict' => count($conflicts) > 0,
            'conflicts' => $conflicts,
        ]);
    }
}
