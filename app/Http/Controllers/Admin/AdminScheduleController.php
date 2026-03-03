<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AdminScheduleController extends Controller
{
    /**
     * Display the schedule management page with server-side pagination & filtering.
     */
    public function index(Request $request)
    {
        $schedules = Schedule::getFilteredSchedules($request);
        $faculties  = Faculty::getActiveFacultyList();
        $departments = Department::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Admin/Schedules', [
            'schedules'   => $schedules,
            'faculties'   => $faculties,
            'departments' => $departments,
            'filters'     => [
                'search'    => $request->query('search', ''),
                'status'    => $request->query('status', ''),
                'type'      => $request->query('type', ''),
                'semester'  => $request->query('semester', ''),
                'academic_year' => $request->query('academic_year', ''),
                'department'    => $request->query('department', ''),
                'per_page'  => (int) $request->query('per_page', 10),
            ],
        ]);
    }

    /**
     * Store a new schedule with its details.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'faculty_id'      => 'required|exists:faculties,id',
            'schedule_code'   => 'required|string|max:100|unique:schedules,schedule_code',
            'academic_year'   => 'required|integer|min:2020|max:2100',
            'semester'        => 'required|integer|in:1,2,3',
            'effective_from'  => 'required|date',
            'effective_until' => 'required|date|after:effective_from',
            'status'          => 'required|in:draft,active,archived',
            'schedule_type'   => 'required|in:fixed,flexible',
            'notes'           => 'nullable|string|max:1000',
            'details'         => 'required|array|min:1',
            'details.*.day_of_week'   => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'details.*.time_in'       => 'required|date_format:H:i',
            'details.*.time_out'      => 'required|date_format:H:i',
            'details.*.subject_code'  => 'required|string|max:50|regex:/\S/',
            'details.*.subject_desc'  => 'nullable|string|max:255',
            'details.*.room'          => 'required|string|max:100|regex:/\S/',
            'details.*.hours_required' => 'required|integer|min:1|max:12',
        ]);

        $minAllowedTime = Carbon::createFromFormat('H:i', '07:00');
        $maxAllowedTime = Carbon::createFromFormat('H:i', '21:00');

        foreach ($validated['details'] as $index => $detail) {
            $timeIn = Carbon::createFromFormat('H:i', $detail['time_in']);
            $timeOut = Carbon::createFromFormat('H:i', $detail['time_out']);

            if ($timeIn->lessThan($minAllowedTime) || $timeIn->greaterThan($maxAllowedTime)) {
                return back()
                    ->withErrors([
                        "details.$index.time_in" => 'The time in must be between 07:00 AM and 09:00 PM.',
                    ])
                    ->withInput();
            }

            if ($timeOut->lessThan($minAllowedTime) || $timeOut->greaterThan($maxAllowedTime)) {
                return back()
                    ->withErrors([
                        "details.$index.time_out" => 'The time out must be between 07:00 AM and 09:00 PM.',
                    ])
                    ->withInput();
            }

            if ($timeOut->lessThanOrEqualTo($timeIn)) {
                return back()
                    ->withErrors([
                        "details.$index.time_out" => 'The time out must be after the time in.',
                    ])
                    ->withInput();
            }
        }

        $businessRuleErrors = $this->validateScheduleBusinessRules($validated);
        if (! empty($businessRuleErrors)) {
            return back()
                ->withErrors($businessRuleErrors)
                ->withInput();
        }

        try {
            DB::transaction(function () use ($validated, $request) {
                $schedule = Schedule::create([
                    'faculty_id'      => $validated['faculty_id'],
                    'schedule_code'   => $validated['schedule_code'],
                    'academic_year'   => $validated['academic_year'],
                    'semester'        => $validated['semester'],
                    'effective_from'  => $validated['effective_from'],
                    'effective_until' => $validated['effective_until'],
                    'status'          => $validated['status'],
                    'schedule_type'   => $validated['schedule_type'],
                    'notes'           => $validated['notes'] ?? null,
                    'created_by'      => Auth::id(),
                ]);

                foreach ($validated['details'] as $detail) {
                    $schedule->scheduleDetails()->create([
                        'day_of_week'    => $detail['day_of_week'],
                        'time_in'        => Carbon::createFromFormat('H:i', $detail['time_in'])->format('Y-m-d H:i:s'),
                        'time_out'       => Carbon::createFromFormat('H:i', $detail['time_out'])->format('Y-m-d H:i:s'),
                        'subject_code'   => $detail['subject_code'] ?? null,
                        'subject_desc'   => $detail['subject_desc'] ?? null,
                        'room'           => $detail['room'] ?? null,
                        'hours_required' => $detail['hours_required'],
                    ]);
                }
            });
        } catch (\Throwable $e) {
            return redirect()->route('admin.schedules.index')
                ->with('error', 'Failed to create schedule. Please try again.');
        }

        return redirect()->route('admin.schedules.index')
            ->with('success', 'Schedule created successfully.');
    }

    /**
     * Update an existing schedule.
     */
    public function update(Request $request, Schedule $schedule)
    {
        $validated = $request->validate([
            'faculty_id'      => 'required|exists:faculties,id',
            'schedule_code'   => 'required|string|max:100|unique:schedules,schedule_code,' . $schedule->id,
            'academic_year'   => 'required|integer|min:2020|max:2100',
            'semester'        => 'required|integer|in:1,2,3',
            'effective_from'  => 'required|date',
            'effective_until' => 'required|date|after:effective_from',
            'status'          => 'required|in:draft,active,archived',
            'schedule_type'   => 'required|in:fixed,flexible',
            'notes'           => 'nullable|string|max:1000',
            'details'         => 'required|array|min:1',
            'details.*.id'            => 'nullable|integer|min:1',
            'details.*.day_of_week'   => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'details.*.time_in'       => 'required|date_format:H:i',
            'details.*.time_out'      => 'required|date_format:H:i',
            'details.*.subject_code'  => 'required|string|max:50|regex:/\S/',
            'details.*.subject_desc'  => 'nullable|string|max:255',
            'details.*.room'          => 'required|string|max:100|regex:/\S/',
            'details.*.hours_required' => 'required|integer|min:1|max:12',
        ]);

        $minAllowedTime = Carbon::createFromFormat('H:i', '07:00');
        $maxAllowedTime = Carbon::createFromFormat('H:i', '21:00');

        foreach ($validated['details'] as $index => $detail) {
            $timeIn = Carbon::createFromFormat('H:i', $detail['time_in']);
            $timeOut = Carbon::createFromFormat('H:i', $detail['time_out']);

            if ($timeIn->lessThan($minAllowedTime) || $timeIn->greaterThan($maxAllowedTime)) {
                return back()
                    ->withErrors([
                        "details.$index.time_in" => 'The time in must be between 07:00 AM and 09:00 PM.',
                    ])
                    ->withInput();
            }

            if ($timeOut->lessThan($minAllowedTime) || $timeOut->greaterThan($maxAllowedTime)) {
                return back()
                    ->withErrors([
                        "details.$index.time_out" => 'The time out must be between 07:00 AM and 09:00 PM.',
                    ])
                    ->withInput();
            }

            if ($timeOut->lessThanOrEqualTo($timeIn)) {
                return back()
                    ->withErrors([
                        "details.$index.time_out" => 'The time out must be after the time in.',
                    ])
                    ->withInput();
            }
        }

        $businessRuleErrors = $this->validateScheduleBusinessRules($validated, $schedule);
        if (! empty($businessRuleErrors)) {
            return back()
                ->withErrors($businessRuleErrors)
                ->withInput();
        }

        try {
            DB::transaction(function () use ($schedule, $validated) {
                $schedule->update([
                    'faculty_id'      => $validated['faculty_id'],
                    'schedule_code'   => $validated['schedule_code'],
                    'academic_year'   => $validated['academic_year'],
                    'semester'        => $validated['semester'],
                    'effective_from'  => $validated['effective_from'],
                    'effective_until' => $validated['effective_until'],
                    'status'          => $validated['status'],
                    'schedule_type'   => $validated['schedule_type'],
                    'notes'           => $validated['notes'] ?? null,
                ]);

                $existingDetails = $schedule->scheduleDetails()->get()->keyBy('id');

                $submittedDetailIds = collect($validated['details'])
                    ->pluck('id')
                    ->filter(fn ($id) => ! empty($id))
                    ->map(fn ($id) => (int) $id)
                    ->values();

                // Soft-delete removed schedule_details so related history/attendance data
                // remains intact. Unique-key collisions for previously soft-deleted rows
                // are handled below via withTrashed restore when re-adding the same entry.
                $toRemove = $existingDetails->keys()->diff($submittedDetailIds);
                if ($toRemove->isNotEmpty()) {
                    ScheduleDetail::whereIn('id', $toRemove->all())->delete();
                }

                foreach ($validated['details'] as $detail) {
                    $payload = [
                        'day_of_week'    => $detail['day_of_week'],
                        'time_in'        => Carbon::createFromFormat('H:i', $detail['time_in'])->format('Y-m-d H:i:s'),
                        'time_out'       => Carbon::createFromFormat('H:i', $detail['time_out'])->format('Y-m-d H:i:s'),
                        'subject_code'   => $detail['subject_code'],
                        'subject_desc'   => $detail['subject_desc'] ?? null,
                        'room'           => $detail['room'],
                        'hours_required' => $detail['hours_required'],
                    ];

                    $detailId = isset($detail['id']) ? (int) $detail['id'] : null;

                    if ($detailId && ! $existingDetails->has($detailId)) {
                        throw ValidationException::withMessages([
                            'details' => 'One or more schedule details are invalid for this schedule.',
                        ]);
                    }

                    if ($detailId && $existingDetails->has($detailId)) {
                        $existingDetails->get($detailId)->update($payload);
                        continue;
                    }

                    // When creating a new detail, check for a soft-deleted row with the
                    // same schedule/day/time so we restore+update it instead of inserting
                    // a new row that would violate the unique_schedule_detail constraint.
                    $timeIn  = Carbon::createFromFormat('H:i', $detail['time_in'])->format('H:i:s');
                    $timeOut = Carbon::createFromFormat('H:i', $detail['time_out'])->format('H:i:s');

                    $softDeleted = ScheduleDetail::onlyTrashed()
                        ->where('schedule_id', $schedule->id)
                        ->where('day_of_week', $payload['day_of_week'])
                        ->whereRaw('TIME(time_in) = ?', [$timeIn])
                        ->whereRaw('TIME(time_out) = ?', [$timeOut])
                        ->first();

                    if ($softDeleted) {
                        $softDeleted->restore();
                        $softDeleted->update($payload);
                    } else {
                        $schedule->scheduleDetails()->create($payload);
                    }
                }
            });
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors())->withInput();
        } catch (\Throwable $e) {
            return redirect()->route('admin.schedules.index')
                ->with('error', 'Failed to update schedule. Please try again.');
        }

        return redirect()->route('admin.schedules.index')
            ->with('success', 'Schedule updated successfully.');
    }

    /**
     * Remove a schedule (soft delete).
     */
    public function destroy(Schedule $schedule)
    {
        try {
            $schedule->scheduleDetails()->delete();
            $schedule->delete();
        } catch (\Throwable $e) {
            return redirect()->route('admin.schedules.index')
                ->with('error', 'Failed to delete schedule. Please try again.');
        }

        return redirect()->route('admin.schedules.index')
            ->with('success', 'Schedule deleted successfully.');
    }

    /**
     * AJAX endpoint for search suggestions.
     */
    public function searchSuggestions(Request $request)
    {
        $query = $request->query('q', '');

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        $suggestions = Schedule::getSearchSuggestions($query);

        return response()->json($suggestions);
    }

    private function validateScheduleBusinessRules(array $validated, ?Schedule $currentSchedule = null): array
    {
        $errors = [];

        $duplicateScheduleQuery = Schedule::query()
            ->where('faculty_id', $validated['faculty_id'])
            ->where('academic_year', $validated['academic_year'])
            ->where('semester', $validated['semester']);

        if ($currentSchedule) {
            $duplicateScheduleQuery->where('id', '!=', $currentSchedule->id);
        }

        if ($duplicateScheduleQuery->exists()) {
            $errors['faculty_id'] = 'A schedule already exists for this faculty member in the selected academic year and semester.';
        }

        $detailCount = count($validated['details']);

        for ($i = 0; $i < $detailCount; $i++) {
            $currentDetail = $validated['details'][$i];
            $currentRoom = trim((string) ($currentDetail['room'] ?? ''));

            if ($currentRoom === '') {
                continue;
            }

            $currentStart = Carbon::createFromFormat('H:i', $currentDetail['time_in'])->format('H:i:s');
            $currentEnd = Carbon::createFromFormat('H:i', $currentDetail['time_out'])->format('H:i:s');

            for ($j = $i + 1; $j < $detailCount; $j++) {
                $compareDetail = $validated['details'][$j];
                $compareRoom = trim((string) ($compareDetail['room'] ?? ''));

                if ($compareRoom === '' || strcasecmp($currentRoom, $compareRoom) !== 0) {
                    continue;
                }

                if ($currentDetail['day_of_week'] !== $compareDetail['day_of_week']) {
                    continue;
                }

                $compareStart = Carbon::createFromFormat('H:i', $compareDetail['time_in'])->format('H:i:s');
                $compareEnd = Carbon::createFromFormat('H:i', $compareDetail['time_out'])->format('H:i:s');

                if ($currentStart < $compareEnd && $currentEnd > $compareStart) {
                    $errors["details.$i.room"] = "Room {$currentRoom} has a conflict with entry #" . ($j + 1) . ' on ' . $currentDetail['day_of_week'] . '.';
                    $errors["details.$j.room"] = "Room {$compareRoom} has a conflict with entry #" . ($i + 1) . ' on ' . $compareDetail['day_of_week'] . '.';
                }
            }

            if (isset($errors["details.$i.room"])) {
                continue;
            }

            $roomConflictQuery = ScheduleDetail::query()
                ->where('day_of_week', $currentDetail['day_of_week'])
                ->whereNotNull('room')
                ->whereRaw('LOWER(TRIM(room)) = ?', [mb_strtolower($currentRoom)])
                ->whereRaw('TIME(time_in) < ? AND TIME(time_out) > ?', [$currentEnd, $currentStart])
                ->whereHas('schedule', function ($query) use ($validated, $currentSchedule) {
                    $query->whereDate('effective_from', '<=', $validated['effective_until'])
                        ->whereDate('effective_until', '>=', $validated['effective_from']);

                    if ($currentSchedule) {
                        $query->where('id', '!=', $currentSchedule->id);
                    }
                })
                ->with('schedule')
                ->first();

            if ($roomConflictQuery) {
                $conflictingScheduleCode = $roomConflictQuery->schedule?->schedule_code ?? 'another schedule';
                $errors["details.$i.room"] = "Room {$currentRoom} is already occupied on {$currentDetail['day_of_week']} for the selected time range (conflict with {$conflictingScheduleCode}).";
            }
        }

        return $errors;
    }
}
