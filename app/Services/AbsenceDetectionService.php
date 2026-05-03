<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Holiday;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class AbsenceDetectionService
{
    public function buildMergedRecords(int $facultyId, int $month, int $year, Collection $attendanceRecords): Collection
    {
        $periodStart = Carbon::create($year, $month, 1)->startOfDay();
        $periodEnd = $periodStart->copy()->endOfMonth()->endOfDay();

        $recordsByDateAndDetail = $attendanceRecords
            ->filter(fn (AttendanceRecord $record) => ! empty($record->schedule_detail_id))
            ->keyBy(function (AttendanceRecord $record): string {
                return $this->buildSlotKey((int) $record->schedule_detail_id, Carbon::parse($record->attendance_date)->toDateString());
            });

        $holidayDates = $this->buildHolidayDatesSet($month, $year);

        $activeSchedules = Schedule::query()
            ->where('faculty_id', $facultyId)
            ->where('status', 'active')
            ->where('effective_from', '<=', $periodEnd)
            ->where('effective_until', '>=', $periodStart)
            ->with(['scheduleDetails' => function ($query): void {
                $query->orderBy('day')->orderBy('start_time');
            }])
            ->get();

        $allDetails = $activeSchedules->flatMap(fn (Schedule $schedule) => $schedule->scheduleDetails);

        Log::error('AbsenceDetection', [
            'faculty_id' => $facultyId,
            'month' => $month,
            'year' => $year,
            'attendance_records_count' => $attendanceRecords->count(),
            'schedules_found' => $activeSchedules->count(),
            'details_found' => $allDetails->count(),
        ]);

        $virtualAbsents = collect();

        foreach ($activeSchedules as $schedule) {
            if (($schedule->schedule_type ?? '') === 'flexible') {
                continue;
            }

            $scheduleStart = Carbon::parse($schedule->effective_from)->startOfDay();
            $scheduleEnd = Carbon::parse($schedule->effective_until)->endOfDay();
            $effectiveStart = $scheduleStart->greaterThan($periodStart) ? $scheduleStart : $periodStart;
            $effectiveEnd = $scheduleEnd->lessThan($periodEnd) ? $scheduleEnd : $periodEnd;

            if ($effectiveStart->greaterThan($effectiveEnd)) {
                continue;
            }

            foreach ($schedule->scheduleDetails as $detail) {
                $expectedDates = $this->expandExpectedDatesForDetail($detail, $effectiveStart, $effectiveEnd);

                Log::error('AbsenceDetectionDetail', [
                    'faculty_id' => $facultyId,
                    'schedule_id' => $schedule->id,
                    'schedule_detail_id' => $detail->id,
                    'day' => $detail->day,
                    'start_time' => $this->extractTimeOnly($detail->start_time),
                    'end_time' => $this->extractTimeOnly($detail->end_time),
                    'expected_dates' => $expectedDates->map(fn (Carbon $date) => $date->toDateString())->values()->all(),
                ]);

                foreach ($expectedDates as $expectedDate) {
                    $dateString = $expectedDate->toDateString();
                    $slotKey = $this->buildSlotKey((int) $detail->id, $dateString);
                    $lookupState = 'missing';

                    if ($holidayDates->contains($dateString)) {
                        $lookupState = 'holiday_skip';
                        Log::error('AbsenceDetectionLookup', [
                            'faculty_id' => $facultyId,
                            'schedule_id' => $schedule->id,
                            'schedule_detail_id' => $detail->id,
                            'attendance_date' => $dateString,
                            'slot_key' => $slotKey,
                            'lookup' => $lookupState,
                        ]);

                        continue;
                    }

                    $exactRecord = $recordsByDateAndDetail->get($slotKey);
                    if ($exactRecord instanceof AttendanceRecord) {
                        $lookupState = 'exact_record_found';
                        Log::error('AbsenceDetectionLookup', [
                            'faculty_id' => $facultyId,
                            'schedule_id' => $schedule->id,
                            'schedule_detail_id' => $detail->id,
                            'attendance_date' => $dateString,
                            'slot_key' => $slotKey,
                            'lookup' => $lookupState,
                        ]);

                        continue;
                    }

                    $virtualAbsents->push($this->makeVirtualAbsentRecord($facultyId, $detail, $expectedDate));
                    Log::error('AbsenceDetectionLookup', [
                        'faculty_id' => $facultyId,
                        'schedule_id' => $schedule->id,
                        'schedule_detail_id' => $detail->id,
                        'attendance_date' => $dateString,
                        'slot_key' => $slotKey,
                        'lookup' => $lookupState,
                        'action' => 'virtual_absent_created',
                    ]);
                }
            }
        }

        Log::error('AbsenceDetectionSummary', [
            'faculty_id' => $facultyId,
            'month' => $month,
            'year' => $year,
            'absent_generated' => $virtualAbsents->count(),
        ]);

        return $attendanceRecords->concat($virtualAbsents);
    }

    private function buildHolidayDatesSet(int $month, int $year): Collection
    {
        return Holiday::query()
            ->where(function ($query) use ($month, $year): void {
                $query->where(function ($q) use ($month, $year): void {
                    $q->whereYear('holiday_date', $year)
                        ->whereMonth('holiday_date', $month);
                })->orWhere(function ($q) use ($month): void {
                    $q->where('is_recurring', true)
                        ->whereMonth('holiday_date', $month);
                });
            })
            ->get()
            ->map(function (Holiday $holiday) use ($year): string {
                $date = Carbon::parse($holiday->holiday_date);
                if ((bool) $holiday->is_recurring) {
                    return Carbon::create($year, $date->month, $date->day)->toDateString();
                }

                return $date->toDateString();
            })
            ->unique()
            ->values();
    }

    private function expandExpectedDatesForDetail(ScheduleDetail $detail, Carbon $start, Carbon $end): Collection
    {
        $targetWeekday = $this->resolveWeekdayFromName((string) $detail->day);
        if ($targetWeekday === null) {
            return collect();
        }

        $dates = collect();
        $cursor = $start->copy();

        while ($cursor->lessThanOrEqualTo($end)) {
            if ($cursor->dayOfWeek === $targetWeekday) {
                $dates->push($cursor->copy());
            }

            $cursor->addDay();
        }

        return $dates;
    }

    private function makeVirtualAbsentRecord(int $facultyId, ScheduleDetail $detail, Carbon $expectedDate): AttendanceRecord
    {
        $officialInTime = $this->extractTimeOnly($detail->start_time);
        if ($officialInTime === null) {
            $officialInTime = '08:00:00';
        }

        $officialIn = $this->combineDateAndTime($expectedDate, $officialInTime);
        $officialOutTime = $this->extractTimeOnly($detail->end_time);
        $officialOut = $detail->end_time
            ? $this->combineDateAndTime($expectedDate, $officialOutTime ?? $officialInTime)
            : $officialIn->copy()->addMinutes(max(60, (int) round(((float) ($detail->hours_required ?? 1)) * 60)));

        $record = new AttendanceRecord([
            'faculty_id' => $facultyId,
            'schedule_detail_id' => $detail->id,
            'attendance_date' => $expectedDate->toDateString(),
            'day_of_week' => $detail->day,
            'official_time_in' => $officialIn,
            'official_time_out' => $officialOut,
            'actual_time_in' => null,
            'actual_time_out' => null,
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'overtime_minutes' => 0,
            'night_minutes' => 0,
            'overtime_night_minutes' => 0,
            'total_hours_rendered' => 0,
            'required_hours' => (float) ($detail->hours_required ?? 0),
            'status' => 'absent',
            'remarks' => 'No attendance log found',
            'is_manual_entry' => false,
        ]);

        $record->computed_late_minutes = 0;
        $record->computed_undertime_minutes = 0;
        $record->computed_total_hours_rendered = 0.0;
        $record->is_virtual_absent = true;

        return $record;
    }

    private function combineDateAndTime(Carbon $date, string $time): Carbon
    {
        [$hour, $minute, $second] = explode(':', $time);

        return $date->copy()->setTime((int) $hour, (int) $minute, (int) $second);
    }

    private function buildSlotKey(int $scheduleDetailId, string $attendanceDate): string
    {
        return $scheduleDetailId.'|'.$attendanceDate;
    }

    private function extractTimeOnly(mixed $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->format('H:i:s');
        }

        return Carbon::parse((string) $value)->format('H:i:s');
    }

    private function resolveWeekdayFromName(string $day): ?int
    {
        return match (strtolower(trim($day))) {
            'sunday' => Carbon::SUNDAY,
            'monday' => Carbon::MONDAY,
            'tuesday' => Carbon::TUESDAY,
            'wednesday' => Carbon::WEDNESDAY,
            'thursday' => Carbon::THURSDAY,
            'friday' => Carbon::FRIDAY,
            'saturday' => Carbon::SATURDAY,
            default => null,
        };
    }
}
