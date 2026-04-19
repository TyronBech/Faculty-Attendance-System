<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Holiday;
use Carbon\Carbon;

class AttendanceToDtrService
{
    public function convertToDtr(int $facultyId, int $month, int $year): array
    {
        $attendance    = $this->buildConversionMap($facultyId, $month, $year);
        $holidaysByDay = $this->buildHolidaysMap($month, $year);
        $finalizedAttendance = $this->finalizeAttendanceMapping($attendance, $holidaysByDay, $month, $year);

        $summary = [
            'daysAbsent'                => 0,
            'timesLate'                 => 0,
            'totalLateMinutes'          => 0,
            'timesUndertime'            => 0,
            'totalUndertimeMinutes'     => 0,
            'timesNight'                => 0,
            'totalNightMinutes'         => 0,
            'timesOvertime'             => 0,
            'totalOvertimeMinutes'      => 0,
            'timesOvertimeNight'        => 0,
            'totalOvertimeNightMinutes' => 0,
            'totalHoursRendered'        => 0,
        ];

        foreach ($finalizedAttendance as $dayData) {
            if (($dayData['status'] ?? '') === 'absent') {
                $summary['daysAbsent']++;
            }

            $record = $dayData['record'] ?? null;
            if ($record === null) {
                continue;
            }

            // Use on-the-fly computed deltas when available (moved schedules),
            // otherwise fall back to whatever is stored in the DB.
            $lateMinutes          = (int) ($record->computed_late_minutes      ?? $record->late_minutes      ?? 0);
            $undertimeMinutes     = (int) ($record->computed_undertime_minutes ?? $record->undertime_minutes ?? 0);
            $nightMinutes         = (int) ($record->night_minutes              ?? 0);
            $overtimeMinutes      = (int) ($record->overtime_minutes           ?? 0);
            $overtimeNightMinutes = (int) ($record->overtime_night_minutes     ?? 0);
            $hasActualAttendance  = ! empty($record->actual_time_in) || ! empty($record->actual_time_out);

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
            if ($hasActualAttendance) {
                $summary['totalHoursRendered'] += (float) ($record->total_hours_rendered ?? 0);
            }
        }

        return [
            'attendance' => $finalizedAttendance,
            'summary'    => $summary,
        ];
    }

    private function buildConversionMap(int $facultyId, int $month, int $year): array
    {
        $monthlyAttendance = AttendanceRecord::where('faculty_id', $facultyId)
            ->whereYear('attendance_date', $year)
            ->whereMonth('attendance_date', $month)
            ->with('faculty:id,first_name,middle_name,last_name,department_id')
            ->get();

        $attendance = [];

        foreach ($monthlyAttendance as $mt) {
            // Preserve raw actual times so the "Actual" tab always shows
            // the real biometric clock times unmodified.
            $mt->raw_actual_time_in  = $mt->actual_time_in;
            $mt->raw_actual_time_out = $mt->actual_time_out;

            // Day bucket key = day of official_time_in (the original schedule day).
            $daySource = $mt->official_time_in ?? $mt->attendance_date;
            if (empty($daySource)) {
                continue;
            }

            $attendanceDay       = Carbon::parse($daySource)->day;
            $hasOfficialSchedule = ! empty($mt->official_time_in) && ! empty($mt->official_time_out);
            $hasActualAttendance = ! empty($mt->actual_time_in)   || ! empty($mt->actual_time_out);

            // ── Absent: scheduled but never attended ─────────────────────
            if ($hasOfficialSchedule && ! $hasActualAttendance) {
                $attendance[$attendanceDay] = [
                    'status'   => 'absent',
                    'record'   => $mt,
                    'holidays' => [],
                ];
                continue;
            }

            // ── Normal schedule: official == operational date ────────────
            if (! $this->isMovedSchedule($mt)) {
                $gracePeriodMinutes = 5;

                $officialIn = $mt->official_time_in ? Carbon::parse($mt->official_time_in) : null;
                $officialOut = $mt->official_time_out ? Carbon::parse($mt->official_time_out) : null;
                $actualIn = $mt->actual_time_in ? Carbon::parse($mt->actual_time_in) : null;
                $actualOut = $mt->actual_time_out ? Carbon::parse($mt->actual_time_out) : null;

                $lateMinutes = 0;
                $undertimeMinutes = 0;

                if ($actualIn && $officialIn) {
                    $lateMinutes = $actualIn->greaterThan($officialIn->copy()->addMinutes($gracePeriodMinutes))
                        ? (int) $officialIn->diffInMinutes($actualIn)
                        : 0;
                }

                if ($actualOut && $officialOut) {
                    $undertimeMinutes = $actualOut->lessThan($officialOut)
                        ? (int) $actualOut->diffInMinutes($officialOut)
                        : 0;
                }

                $mt->computed_late_minutes = $lateMinutes;
                $mt->computed_undertime_minutes = $undertimeMinutes;

                if ($actualIn) {
                    $mt->official_time_in = $actualIn;
                }
                if ($actualOut) {
                    $mt->official_time_out = $actualOut;
                }

                $attendance[$attendanceDay] = [
                    'status'   => 'present',
                    'record'   => $mt,
                    'holidays' => [],
                ];
                continue;
            }

            // ── Moved (change-request) schedule ──────────────────────────
            //
            // official_time_in/out  = original schedule day + original times
            // operational_time_in/out = moved day + moved times
            // actual_time_in/out    = raw biometric on the moved day
            //
            // Compute late/undertime by comparing actual vs operational,
            // then apply those deltas onto official for the DTR display.

            $gracePeriodMinutes = 5;

            $operationalIn  = $mt->operational_time_in  ? Carbon::parse($mt->operational_time_in)  : null;
            $operationalOut = $mt->operational_time_out ? Carbon::parse($mt->operational_time_out) : null;
            $actualIn       = $mt->actual_time_in       ? Carbon::parse($mt->actual_time_in)       : null;
            $actualOut      = $mt->actual_time_out      ? Carbon::parse($mt->actual_time_out)      : null;
            $officialIn     = $mt->official_time_in     ? Carbon::parse($mt->official_time_in)     : null;
            $officialOut    = $mt->official_time_out    ? Carbon::parse($mt->official_time_out)    : null;

            $lateMinutes      = 0;
            $undertimeMinutes = 0;

            if ($actualIn && $operationalIn) {
                $lateMinutes = $actualIn->greaterThan($operationalIn->copy()->addMinutes($gracePeriodMinutes))
                    ? (int) $operationalIn->diffInMinutes($actualIn)
                    : 0;
            }

            if ($actualOut && $operationalOut) {
                $undertimeMinutes = $actualOut->lessThan($operationalOut)
                    ? (int) $actualOut->diffInMinutes($operationalOut)
                    : 0;
            }

            // Attach computed deltas to the in-memory record for the summary loop
            $mt->computed_late_minutes      = $lateMinutes;
            $mt->computed_undertime_minutes = $undertimeMinutes;

            // Adjust official times by the computed deltas (in-memory only)
            if ($officialIn) {
                $mt->official_time_in = $officialIn->copy()->addMinutes($lateMinutes);
            }
            if ($officialOut) {
                $mt->official_time_out = $officialOut->copy()->subMinutes($undertimeMinutes);
            }

            $attendance[$attendanceDay] = [
                'status'   => 'present',
                'record'   => $mt,
                'holidays' => [],
            ];
        }

        return $attendance;
    }

    /**
     * A record is "moved" when official_time_in and operational_time_in
     * fall on different calendar dates — meaning the class was rendered
     * on a different day than originally scheduled.
     */
    private function isMovedSchedule(AttendanceRecord $record): bool
    {
        if (empty($record->official_time_in) || empty($record->operational_time_in)) {
            return false;
        }

        return Carbon::parse($record->official_time_in)->toDateString()
            !== Carbon::parse($record->operational_time_in)->toDateString();
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
            if (array_key_exists($day, $attendance)) {
                if (array_key_exists($day, $holidaysByDay)) {
                    $record              = $attendance[$day]['record'] ?? null;
                    $hasActualAttendance = ! empty($record?->actual_time_in) || ! empty($record?->actual_time_out);

                    $attendance[$day]['holidays'] = $holidaysByDay[$day];
                    $attendance[$day]['status']   = $hasActualAttendance ? 'holiday_present' : 'holiday';
                }
                continue;
            }

            $attendance[$day] = array_key_exists($day, $holidaysByDay)
                ? ['status' => 'holiday', 'record' => null, 'holidays' => $holidaysByDay[$day]]
                : ['status' => 'none',    'record' => null, 'holidays' => []];
        }

        ksort($attendance);

        return $attendance;
    }
}
