<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ManualAttendanceService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function getCandidatesForDate(string|Carbon $date): array
    {
        $targetDate = $this->parseDate($date);
        $candidates = $this->buildCandidateCollection($targetDate);

        return $candidates
            ->map(function (array $candidate): array {
                $entries = collect($candidate['entries']);
                $sortedByIn = $entries->sortBy(fn(array $entry): int => $entry['operational_time_in']->getTimestamp())->values();
                $sortedByOut = $entries->sortByDesc(fn(array $entry): int => $entry['operational_time_out']->getTimestamp())->values();

                return [
                    'faculty_id' => $candidate['faculty']->id,
                    'faculty_name' => $candidate['faculty']->full_name,
                    'operational_time_in' => $sortedByIn->first()['operational_time_in']->format('h:i A'),
                    'operational_time_out' => $sortedByOut->first()['operational_time_out']->format('h:i A'),
                    'entry_count' => $entries->count(),
                    'sources' => $entries->pluck('source')->unique()->values()->all(),
                    'schedule_details' => $entries->map(function (array $entry): array {
                        return [
                            'source' => $entry['source'],
                            'schedule_code' => $entry['schedule_code'],
                            'course_code' => $entry['course_code'],
                            'subject_desc' => $entry['subject_desc'] ?? 'Operational Duty',
                            'room_code' => $entry['room_code'] ?? 'TBA',
                            'time_in' => $entry['operational_time_in']->format('h:i A'),
                            'time_out' => $entry['operational_time_out']->format('h:i A'),
                            'effective_from' => $entry['effective_from'],
                            'effective_until' => $entry['effective_until'],
                        ];
                    })->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<int, int|string>  $facultyIds
     * @return array<string, mixed>
     */
    public function storeManualAttendance(string|Carbon $date, array $facultyIds, string $remarks): array
    {
        $targetDate = $this->parseDate($date);
        $dayOfWeek = $targetDate->format('l');
        $selectedFacultyIds = collect($facultyIds)
            ->map(fn(int|string $facultyId): int => (int) $facultyId)
            ->unique()
            ->values();

        $candidates = $this->buildCandidateCollection($targetDate);
        $recordsSaved = 0;
        $processedFaculties = 0;
        $skippedFacultyIds = [];

        DB::transaction(function () use (
            $selectedFacultyIds,
            $candidates,
            $targetDate,
            $dayOfWeek,
            $remarks,
            &$recordsSaved,
            &$processedFaculties,
            &$skippedFacultyIds
        ): void {
            foreach ($selectedFacultyIds as $facultyId) {
                $candidate = $candidates->get($facultyId);

                if (! $candidate) {
                    $skippedFacultyIds[] = $facultyId;

                    continue;
                }

                $processedFaculties++;

                foreach ($candidate['entries'] as $entry) {
                    $attendanceRecord = $this->upsertAttendanceRecord(
                        facultyId: $facultyId,
                        attendanceDate: $targetDate,
                        dayOfWeek: $dayOfWeek,
                        entry: $entry,
                        remarks: $remarks,
                    );

                    if ($attendanceRecord->wasRecentlyCreated || $attendanceRecord->wasChanged()) {
                        $recordsSaved++;
                    }
                }
            }
        });

        return [
            'selected_faculties' => $selectedFacultyIds->count(),
            'processed_faculties' => $processedFaculties,
            'records_saved' => $recordsSaved,
            'skipped_faculty_ids' => $skippedFacultyIds,
        ];
    }

    private function parseDate(string|Carbon $date): Carbon
    {
        return ($date instanceof Carbon ? $date->copy() : Carbon::parse($date))->startOfDay();
    }

    /**
     * @return Collection<int, array{faculty: Faculty, entries: array<int, array<string, mixed>>}>
     */
    private function buildCandidateCollection(Carbon $targetDate): Collection
    {
        $dayOfWeek = $targetDate->format('l');

        $faculties = Faculty::query()
            ->where('is_active', true)
            ->with([
                'schedules' => function ($query) use ($targetDate): void {
                    $query->where('status', 'active')
                        ->whereDate('effective_from', '<=', $targetDate->toDateString())
                        ->whereDate('effective_until', '>=', $targetDate->toDateString())
                        ->orderBy('effective_from');
                },
                'schedules.scheduleDetails' => function ($query) use ($dayOfWeek): void {
                    $query->where('day', $dayOfWeek)
                        ->orderBy('start_time');
                },
                'schedules.internalSchedules' => function ($query) use ($dayOfWeek): void {
                    $query->where('day_of_week', $dayOfWeek)
                        ->where('is_operational', true)
                        ->orderBy('device_time_in');
                },
            ])
            ->get();

        return $faculties->mapWithKeys(function (Faculty $faculty) use ($targetDate, $dayOfWeek): array {
            $entries = [];

            foreach ($faculty->schedules as $schedule) {
                $scheduleEntries = $this->resolveScheduleEntries(
                    schedule: $schedule,
                    targetDate: $targetDate,
                    dayOfWeek: $dayOfWeek,
                );

                if (! empty($scheduleEntries)) {
                    array_push($entries, ...$scheduleEntries);
                }
            }

            if (empty($entries)) {
                return [];
            }

            return [
                $faculty->id => [
                    'faculty' => $faculty,
                    'entries' => $entries,
                ],
            ];
        })->sortKeys();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function resolveScheduleEntries(Schedule $schedule, Carbon $targetDate, string $dayOfWeek): array
    {
        $entries = [];
        $internalSchedules = $schedule->internalSchedules;

        if ($internalSchedules->isNotEmpty()) {
            foreach ($internalSchedules as $internalSchedule) {
                $matchingDetail = $schedule->scheduleDetails->first(
                    function (ScheduleDetail $scheduleDetail) use ($targetDate, $internalSchedule): bool {
                        $detailStart = $this->combineDateAndTime($targetDate, $scheduleDetail->start_time);
                        $internalStart = $this->combineDateAndTime($targetDate, $internalSchedule->device_time_in);

                        return abs($detailStart->diffInMinutes($internalStart, false)) <= 30;
                    }
                );

                $operationalTimeIn = $this->combineDateAndTime($targetDate, $internalSchedule->device_time_in);
                $operationalTimeOut = $internalSchedule->device_time_out
                    ? $this->combineDateAndTime($targetDate, $internalSchedule->device_time_out)
                    : $operationalTimeIn->copy()->addHours(3);

                $officialTimeIn = $matchingDetail
                    ? $this->combineDateAndTime($targetDate, $matchingDetail->start_time)
                    : $operationalTimeIn->copy();

                $officialTimeOut = $matchingDetail
                    ? $this->resolveOfficialTimeOut($matchingDetail, $targetDate)
                    : $operationalTimeOut->copy();

                $durationHours = round(max(0, $operationalTimeIn->diffInMinutes($operationalTimeOut, false)) / 60, 2);

                $entries[] = [
                    'schedule_id' => $schedule->id,
                    'schedule_code' => $schedule->schedule_code,
                    'schedule_detail_id' => $matchingDetail?->id,
                    'internal_schedule_id' => $internalSchedule->id,
                    'day_of_week' => $dayOfWeek,
                    'official_time_in' => $officialTimeIn,
                    'official_time_out' => $officialTimeOut,
                    'operational_time_in' => $operationalTimeIn,
                    'operational_time_out' => $operationalTimeOut,
                    'required_hours' => (float) ($internalSchedule->required_hours ?: $durationHours),
                    'source' => 'internal',
                    'course_code' => $matchingDetail?->course_code,
                    'subject_desc' => $matchingDetail?->subject_desc,
                    'room_code' => $matchingDetail?->room_code,
                    'effective_from' => $schedule->effective_from?->format('Y-m-d'),
                    'effective_until' => $schedule->effective_until?->format('Y-m-d'),
                ];
            }

            return $entries;
        }

        foreach ($schedule->scheduleDetails as $scheduleDetail) {
            $officialTimeIn = $this->combineDateAndTime($targetDate, $scheduleDetail->start_time);
            $officialTimeOut = $this->resolveOfficialTimeOut($scheduleDetail, $targetDate);
            $durationHours = round(max(0, $officialTimeIn->diffInMinutes($officialTimeOut, false)) / 60, 2);

            $entries[] = [
                'schedule_id' => $schedule->id,
                'schedule_code' => $schedule->schedule_code,
                'schedule_detail_id' => $scheduleDetail->id,
                'internal_schedule_id' => null,
                'day_of_week' => $dayOfWeek,
                'official_time_in' => $officialTimeIn,
                'official_time_out' => $officialTimeOut,
                'operational_time_in' => $officialTimeIn->copy(),
                'operational_time_out' => $officialTimeOut->copy(),
                'required_hours' => (float) ($scheduleDetail->hours_required ?: $durationHours),
                'source' => 'official',
                'course_code' => $scheduleDetail->course_code,
                'subject_desc' => $scheduleDetail->subject_desc,
                'room_code' => $scheduleDetail->room_code,
                'effective_from' => $schedule->effective_from?->format('Y-m-d'),
                'effective_until' => $schedule->effective_until?->format('Y-m-d'),
            ];
        }

        return $entries;
    }

    private function resolveOfficialTimeOut(ScheduleDetail $scheduleDetail, Carbon $targetDate): Carbon
    {
        if ($scheduleDetail->end_time) {
            return $this->combineDateAndTime($targetDate, $scheduleDetail->end_time);
        }

        $start = $this->combineDateAndTime($targetDate, $scheduleDetail->start_time);

        return $start->copy()->addMinutes(max(60, (int) round(((float) ($scheduleDetail->hours_required ?? 1)) * 60)));
    }

    private function combineDateAndTime(Carbon $targetDate, string|Carbon $timeValue): Carbon
    {
        $time = $timeValue instanceof Carbon ? $timeValue : Carbon::parse($timeValue);

        return $targetDate->copy()->setTime($time->hour, $time->minute, $time->second);
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private function upsertAttendanceRecord(
        int $facultyId,
        Carbon $attendanceDate,
        string $dayOfWeek,
        array $entry,
        string $remarks,
    ): AttendanceRecord {
        $totalHoursRendered = round(max(0, $entry['operational_time_in']->diffInMinutes($entry['operational_time_out'], false)) / 60, 2);

        $payload = [
            'faculty_id' => $facultyId,
            'schedule_detail_id' => $entry['schedule_detail_id'],
            'internal_schedule_id' => $entry['internal_schedule_id'],
            'attendance_date' => $attendanceDate->toDateString(),
            'day_of_week' => $dayOfWeek,
            'official_time_in' => $entry['official_time_in'],
            'official_time_out' => $entry['official_time_out'],
            'operational_day_of_week' => $dayOfWeek,
            'operational_time_in' => $entry['operational_time_in'],
            'operational_time_out' => $entry['operational_time_out'],
            'actual_time_in' => $entry['operational_time_in'],
            'actual_time_out' => $entry['operational_time_out'],
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'overtime_minutes' => 0,
            'night_minutes' => 0,
            'overtime_night_minutes' => 0,
            'total_hours_rendered' => $totalHoursRendered,
            'required_hours' => (float) ($entry['required_hours'] ?: $totalHoursRendered),
            'status' => 'present',
            'remarks' => $remarks,
            'is_manual_entry' => true,
            'processed_at' => now(),
        ];

        if ($entry['schedule_detail_id']) {
            return AttendanceRecord::updateOrCreate(
                [
                    'faculty_id' => $facultyId,
                    'attendance_date' => $attendanceDate->toDateString(),
                    'schedule_detail_id' => $entry['schedule_detail_id'],
                ],
                $payload,
            );
        }

        $query = AttendanceRecord::query()
            ->where('faculty_id', $facultyId)
            ->whereDate('attendance_date', $attendanceDate->toDateString())
            ->whereNull('schedule_detail_id');

        if ($entry['internal_schedule_id']) {
            $query->where('internal_schedule_id', $entry['internal_schedule_id']);
        } else {
            $query->whereNull('internal_schedule_id');
        }

        $record = $query->first();

        if (! $record) {
            $record = new AttendanceRecord;
        }

        $record->fill($payload);
        $record->save();

        return $record;
    }
}
