<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Holiday;
use App\Models\SystemSetting;
use Carbon\Carbon;

class AttendanceToDtrService
{
    public function __construct(
        private readonly AbsenceDetectionService $absenceDetectionService,
    ) {}

    public function convertToDtr(int $facultyId, int $month, int $year): array
    {
        $attendance = $this->buildConversionMap($facultyId, $month, $year);
        $holidaysByDay = $this->buildHolidaysMap($month, $year);
        $finalizedAttendance = $this->finalizeAttendanceMapping($attendance, $holidaysByDay, $month, $year);

        $summary = [
            'daysPresent' => 0,
            'daysAbsent' => 0,
            'totalHoursAbsent' => 0,
            'timesLate' => 0,
            'totalLateMinutes' => 0,
            'timesUndertime' => 0,
            'totalUndertimeMinutes' => 0,
            'timesNight' => 0,
            'totalNightMinutes' => 0,
            'timesOvertime' => 0,
            'totalOvertimeMinutes' => 0,
            'timesOvertimeNight' => 0,
            'totalOvertimeNightMinutes' => 0,
            'totalHoursRendered' => 0,
            'totalRequiredHours' => 0,
        ];

        foreach ($finalizedAttendance as $dayData) {
            $records = $dayData['records'] ?? [];
            $hasAnyActualAttendance = false;

            foreach ($records as $record) {
                // Use on-the-fly computed deltas when available (moved schedules),
                // otherwise fall back to whatever is stored in the DB.
                $lateMinutes = (int) ($record->computed_late_minutes ?? $record->late_minutes ?? 0);
                $undertimeMinutes = (int) ($record->computed_undertime_minutes ?? $record->undertime_minutes ?? 0);
                $nightMinutes = (int) ($record->night_minutes ?? 0);
                $overtimeMinutes = (int) ($record->computed_overtime_minutes ?? $record->overtime_minutes ?? 0);
                $overtimeNightMinutes = $overtimeMinutes > 0
                    ? (int) ($record->overtime_night_minutes ?? 0)
                    : 0;
                $hasActualAttendance = ! empty($record->actual_time_in) || ! empty($record->actual_time_out);

                $hasAnyActualAttendance = $hasAnyActualAttendance || $hasActualAttendance;

                if ($lateMinutes > 0) {
                    $summary['timesLate']++;
                    $summary['totalLateMinutes'] += $lateMinutes;
                }
                if ($undertimeMinutes > 0) {
                    $summary['timesUndertime']++;
                    $summary['totalUndertimeMinutes'] += $undertimeMinutes;
                }
                if ($nightMinutes > 0) {
                    $summary['timesNight']++;
                    $summary['totalNightMinutes'] += $nightMinutes;
                }
                if ($overtimeMinutes > 0) {
                    $summary['timesOvertime']++;
                    $summary['totalOvertimeMinutes'] += $overtimeMinutes;
                }
                if ($overtimeNightMinutes > 0) {
                    $summary['timesOvertimeNight']++;
                    $summary['totalOvertimeNightMinutes'] += $overtimeNightMinutes;
                }

                $summary['totalHoursRendered'] += (float) ($record->computed_total_hours_rendered ?? 0);
                $summary['totalRequiredHours'] += (float) ($record->required_hours ?? 0);
            }

            if (! empty($records) && ! $hasAnyActualAttendance && ($dayData['status'] ?? '') === 'absent') {
                $summary['daysAbsent']++;
            }
            if (($dayData['status'] ?? '') === 'present' || ($dayData['status'] ?? '') === 'holiday_present') {
                $summary['daysPresent']++;
            }

            if (($dayData['status'] ?? '') === 'absent') {
                $summary['totalHoursAbsent'] += (float) collect($records)->sum(fn ($record) => (float) ($record->required_hours ?? 0));
            }
        }

        return [
            'attendance' => $finalizedAttendance,
            'summary' => $summary,
        ];
    }

    private function buildConversionMap(int $facultyId, int $month, int $year): array
    {
        $monthlyAttendance = AttendanceRecord::where('faculty_id', $facultyId)
            ->whereYear('attendance_date', $year)
            ->whereMonth('attendance_date', $month)
            ->with([
                'faculty:id,first_name,middle_name,last_name,department_id',
                'internalSchedule:id,device_time_in,device_time_out',
            ])
            ->get();

        $monthlyAttendance = $this->absenceDetectionService->buildMergedRecords($facultyId, $month, $year, $monthlyAttendance);

        $attendance = [];
        $overtimeThresholdMinutes = (int) (SystemSetting::query()
            ->where('setting_key', 'overtime_threshold_minutes')
            ->value('setting_value') ?? 0);

        foreach ($monthlyAttendance as $mt) {
            // Preserve raw times before any in-memory adjustments.
            $mt->raw_actual_time_in = $mt->actual_time_in;
            $mt->raw_actual_time_out = $mt->actual_time_out;
            $mt->raw_official_time_in = $mt->official_time_in;
            $mt->raw_official_time_out = $mt->official_time_out;

            // Day bucket key = day of official_time_in (the original schedule day).
            $daySource = $mt->official_time_in ?? $mt->attendance_date;
            if (empty($daySource)) {
                continue;
            }

            $attendanceDay = Carbon::parse($daySource)->day;

            if (! array_key_exists($attendanceDay, $attendance)) {
                $attendance[$attendanceDay] = [
                    'records' => [],
                    'holidays' => [],
                ];
            }

            $gracePeriodMinutes = 5;

            $officialIn = $mt->official_time_in ? Carbon::parse($mt->official_time_in) : null;
            $officialOut = $mt->official_time_out ? Carbon::parse($mt->official_time_out) : null;
            $operationalIn = $mt->operational_time_in ? Carbon::parse($mt->operational_time_in) : null;
            $operationalOut = $mt->operational_time_out ? Carbon::parse($mt->operational_time_out) : null;
            $actualIn = $mt->actual_time_in ? Carbon::parse($mt->actual_time_in) : null;
            $actualOut = $mt->actual_time_out ? Carbon::parse($mt->actual_time_out) : null;
            $internalBaseIn = null;
            $internalBaseOut = null;

            if (! empty($mt->internal_schedule_id) && $mt->internalSchedule) {
                $attendanceDate = Carbon::parse($mt->attendance_date ?? $daySource);
                $internalTimeIn = $mt->internalSchedule->device_time_in
                    ? Carbon::parse($mt->internalSchedule->device_time_in)
                    : null;
                $internalTimeOut = $mt->internalSchedule->device_time_out
                    ? Carbon::parse($mt->internalSchedule->device_time_out)
                    : null;

                if ($internalTimeIn) {
                    $internalBaseIn = $attendanceDate->copy()->setTime(
                        $internalTimeIn->hour,
                        $internalTimeIn->minute,
                        $internalTimeIn->second
                    );
                }

                if ($internalTimeOut) {
                    $internalBaseOut = $attendanceDate->copy()->setTime(
                        $internalTimeOut->hour,
                        $internalTimeOut->minute,
                        $internalTimeOut->second
                    );
                }
            }

            $hasActualAttendance = ! empty($mt->actual_time_in) || ! empty($mt->actual_time_out);
            $baseIn = $internalBaseIn ?? $operationalIn ?? $officialIn;
            $baseOut = $internalBaseOut ?? $operationalOut ?? $officialOut;

            $lateMinutes = 0;
            $undertimeMinutes = 0;
            $overtimeMinutes = 0;

            if ($actualIn && $baseIn) {
                $lateMinutes = $actualIn->greaterThan($baseIn->copy()->addMinutes($gracePeriodMinutes))
                    ? (int) $baseIn->diffInMinutes($actualIn)
                    : 0;
            }

            if ($actualOut && $baseOut) {
                $undertimeMinutes = $actualOut->lessThan($baseOut)
                    ? (int) $actualOut->diffInMinutes($baseOut)
                    : 0;

                if ($actualOut->greaterThan($baseOut)) {
                    $rawOvertimeMinutes = (int) $baseOut->diffInMinutes($actualOut);
                    $overtimeMinutes = $rawOvertimeMinutes >= $overtimeThresholdMinutes
                        ? $rawOvertimeMinutes
                        : 0;
                }
            }

            $mt->computed_late_minutes = $lateMinutes;
            $mt->computed_undertime_minutes = $undertimeMinutes;
            $mt->computed_overtime_minutes = $overtimeMinutes;

            if ($officialIn) {
                $mt->official_time_in = $officialIn->copy()->addMinutes($lateMinutes);
            }
            if ($officialOut) {
                $mt->official_time_out = $officialOut->copy()->subMinutes($undertimeMinutes);
            }
            if ($operationalIn) {
                $mt->operational_time_in = $operationalIn->copy()->addMinutes($lateMinutes);
            }
            if ($operationalOut) {
                $mt->operational_time_out = $operationalOut->copy()->subMinutes($undertimeMinutes);
            }

            $mt->computed_total_hours_rendered = $this->calculateRenderedHours(
                $mt->official_time_in ? Carbon::parse($mt->official_time_in) : null,
                $mt->official_time_out ? Carbon::parse($mt->official_time_out) : null,
                $hasActualAttendance,
            );

            $attendance[$attendanceDay]['records'][] = $mt;
        }

        return $attendance;
    }

    private function buildHolidaysMap(int $month, int $year): array
    {
        $monthHolidays = Holiday::query()
            ->where(function ($query) use ($year, $month) {
                $query->where(function ($q) use ($year, $month) {
                    $q->whereYear('holiday_date', $year)
                        ->whereMonth('holiday_date', $month);
                })->orWhere(function ($q) use ($month) {
                    $q->where('is_recurring', true)
                        ->whereMonth('holiday_date', $month);
                });
            })
            ->get();

        $holidaysByDay = [];
        foreach ($monthHolidays as $holiday) {
            $holidayDay = Carbon::parse($holiday->holiday_date)->day;
            $holidaysByDay[$holidayDay][] = $holiday;
        }

        return $holidaysByDay;
    }

    private function finalizeAttendanceMapping(array $attendance, array $holidaysByDay, int $month, int $year): array
    {
        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;

        for ($day = 1; $day <= $daysInMonth; $day++) {
            $dayRecords = $attendance[$day]['records'] ?? [];
            $hasAnyActualAttendance = false;

            foreach ($dayRecords as $record) {
                if (! empty($record?->actual_time_in) || ! empty($record?->actual_time_out)) {
                    $hasAnyActualAttendance = true;
                    break;
                }
            }

            $status = 'none';

            if (! empty($dayRecords)) {
                $status = $hasAnyActualAttendance ? 'present' : 'absent';
            }

            if (array_key_exists($day, $holidaysByDay)) {
                $status = $hasAnyActualAttendance ? 'holiday_present' : 'holiday';
            }

            $attendance[$day] = [
                'status' => $status,
                'records' => $dayRecords,
                'holidays' => $holidaysByDay[$day] ?? [],
            ];
        }

        ksort($attendance);

        return $attendance;
    }

    private function calculateRenderedHours(?Carbon $dtrIn, ?Carbon $dtrOut, bool $hasActualAttendance): float
    {
        if (! $hasActualAttendance || ! $dtrIn || ! $dtrOut) {
            return 0.0;
        }

        $totalMinutes = max(0, $dtrIn->diffInMinutes($dtrOut, false));
        $breakMinutes = $totalMinutes >= 480 ? 60 : 0;

        return round(max(0, $totalMinutes - $breakMinutes) / 60, 2);
    }
}
