<?php

namespace Tests\Unit;

use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Services\AbsenceDetectionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AbsenceDetectionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_absent_record_only_when_exact_date_missing(): void
    {
        $faculty = Faculty::factory()->create();

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-2026-01',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::parse('2026-01-01 00:00:00'),
            'effective_until' => Carbon::parse('2026-01-31 23:59:59'),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => null,
            'notes' => null,
        ]);

        $detail = ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('2026-01-05 08:00:00'),
            'end_time' => Carbon::parse('2026-01-05 10:00:00'),
            'subject_desc' => 'Algebra',
            'course_code' => 'MATH-101',
            'room_code' => 'R-1',
            'hours_required' => 2,
        ]);

        $attendanceRecords = collect([
            $this->makeAttendanceRecord($faculty->id, $detail->id, '2026-01-12'),
            $this->makeAttendanceRecord($faculty->id, $detail->id, '2026-01-19'),
            $this->makeAttendanceRecord($faculty->id, $detail->id, '2026-01-26'),
        ]);

        $service = new AbsenceDetectionService;
        $result = $service->buildMergedRecords($faculty->id, 1, 2026, $attendanceRecords);

        $this->assertCount(4, $result);

        $virtualAbsent = $result->first(function (AttendanceRecord $record): bool {
            $attendanceDate = $record->attendance_date?->toDateString();

            return $record->schedule_detail_id !== null
                && $attendanceDate === '2026-01-05'
                && ($record->is_virtual_absent ?? false) === true;
        });

        $this->assertNotNull($virtualAbsent);
        $this->assertSame('absent', $virtualAbsent->status);
    }

    private function makeAttendanceRecord(int $facultyId, int $detailId, string $date): AttendanceRecord
    {
        $baseDate = Carbon::parse($date);
        $officialIn = $baseDate->copy()->setTime(8, 0, 0);
        $officialOut = $baseDate->copy()->setTime(10, 0, 0);

        return AttendanceRecord::factory()->create([
            'faculty_id' => $facultyId,
            'schedule_detail_id' => $detailId,
            'attendance_date' => $baseDate->toDateString(),
            'day_of_week' => $baseDate->format('l'),
            'official_time_in' => $officialIn,
            'official_time_out' => $officialOut,
            'operational_day_of_week' => $baseDate->format('l'),
            'operational_time_in' => $officialIn,
            'operational_time_out' => $officialOut,
            'actual_time_in' => $officialIn,
            'actual_time_out' => $officialOut,
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'overtime_minutes' => 0,
            'total_hours_rendered' => 2,
            'required_hours' => 2,
            'status' => 'present',
            'remarks' => 'Auto',
            'is_manual_entry' => false,
        ]);
    }
}
