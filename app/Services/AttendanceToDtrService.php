<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Holiday;
use Carbon\Carbon;

// Converts each biometric log to a DTR record
class AttendanceToDtrService
{
    // Start at attendance records
    public function convertToDtr(int $facultyId, int $month, int $year): array
    {
        $attendance = $this->buildConversionMap($facultyId, $month, $year);
        $holidaysByDay = $this->buildHolidaysMap($month, $year);
        $finalizedAttendance = $this->finalizeAttendanceMapping($attendance, $holidaysByDay, $month, $year);

        $summary = [
            'daysAbsent' => 0,
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
        ];

        foreach ($finalizedAttendance as $dayData) {
            if (($dayData['status'] ?? '') === 'absent') {
                $summary['daysAbsent']++;
            }

            $record = $dayData['record'] ?? null;
            if ($record === null) {
                continue;
            }

            $lateMinutes = (int) ($record->late_minutes ?? 0);
            $undertimeMinutes = (int) ($record->undertime_minutes ?? 0);
            $nightMinutes = (int) ($record->night_minutes ?? 0);
            $overtimeMinutes = (int) ($record->overtime_minutes ?? 0);
            $overtimeNightMinutes = (int) ($record->overtime_night_minutes ?? 0);
            $hasActualAttendance = ! empty($record->actual_time_in) || ! empty($record->actual_time_out);

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
            'summary' => $summary,
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
            $mt->raw_actual_time_in = $mt->actual_time_in;
            $mt->raw_actual_time_out = $mt->actual_time_out;

            $daySource = $mt->official_time_in ?? $mt->attendance_date;
            if (empty($daySource)) {
                continue;
            }

            $attendanceDay = Carbon::parse($daySource)->day;
            $hasOfficialSchedule = ! empty($mt->official_time_in) && ! empty($mt->official_time_out);
            $hasActualAttendance = ! empty($mt->actual_time_in) || ! empty($mt->actual_time_out);

            if ($hasOfficialSchedule && ! $hasActualAttendance) {
                $attendance[$attendanceDay] = [
                    'status' => 'absent',
                    'record' => $mt,
                    'holidays' => [],
                ];

                continue;
            }

            $sameOfficialIn = ! empty($mt->official_time_in) && ! empty($mt->operational_time_in)
                ? Carbon::parse($mt->official_time_in)->equalTo(Carbon::parse($mt->operational_time_in))
                : false;
            $sameOfficialOut = ! empty($mt->official_time_out) && ! empty($mt->operational_time_out)
                ? Carbon::parse($mt->official_time_out)->equalTo(Carbon::parse($mt->operational_time_out))
                : false;

            $canConvert = ! empty($mt->official_time_in)
                && ! empty($mt->official_time_out)
                && ! empty($mt->operational_time_in)
                && ! empty($mt->actual_time_in);

            if (
                ($sameOfficialIn && $sameOfficialOut) ||
                ! $canConvert
            ) {
                $attendance[$attendanceDay] = [
                    'status' => 'present',
                    'record' => $mt,
                    'holidays' => [],
                ];
            } else {
                $operational = Carbon::parse($mt->operational_time_in);
                $actual = Carbon::parse($mt->actual_time_in);
                $officialIn = Carbon::parse($mt->official_time_in);
                $officialOut = Carbon::parse($mt->official_time_out);

                $offsetMinutes = $operational->diffInMinutes($actual, false);
                $hoursRendered = (float) $mt->total_hours_rendered;

                $convertedIn = $officialIn->copy()->addMinutes($offsetMinutes);
                $convertedOut = $officialOut->copy()->addSeconds((int) round($hoursRendered * 3600));

                $mt->actual_time_in = $convertedIn->setDate(
                    $officialIn->year, $officialIn->month, $officialIn->day
                );

                $mt->actual_time_out = $convertedOut->setDate(
                    $officialOut->year, $officialOut->month, $officialOut->day
                );

                $attendance[$attendanceDay] = [
                    'status' => 'present',
                    'record' => $mt,
                    'holidays' => [],
                ];
            }
        }

        return $attendance;
    }

    private function buildHolidaysMap(int $month, int $year): array
    {
        $monthHolidays = Holiday::query()
            ->where(function ($query) use ($year, $month) {
                $query->where(function ($monthlyQuery) use ($year, $month) {
                    $monthlyQuery->whereYear('holiday_date', $year)
                        ->whereMonth('holiday_date', $month);
                })->orWhere(function ($recurringQuery) use ($month) {
                    $recurringQuery->where('is_recurring', true)
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
                    $record = $attendance[$day]['record'] ?? null;
                    $hasActualAttendance = ! empty($record?->actual_time_in) || ! empty($record?->actual_time_out);

                    $attendance[$day]['holidays'] = $holidaysByDay[$day];
                    $attendance[$day]['status'] = $hasActualAttendance ? 'holiday_present' : 'holiday';
                }

                continue;
            }

            if (array_key_exists($day, $holidaysByDay)) {
                $attendance[$day] = [
                    'status' => 'holiday',
                    'record' => null,
                    'holidays' => $holidaysByDay[$day],
                ];
            } else {
                $attendance[$day] = [
                    'status' => 'none',
                    'record' => null,
                    'holidays' => [],
                ];
            }
        }

        ksort($attendance);

        return $attendance;
    }
}
