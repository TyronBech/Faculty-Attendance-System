<?php

namespace Tests\Feature;

use App\Jobs\GenerateDtrBatchZipJob;
use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Holiday;
use App\Models\InternalSchedule;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class AdminDtrExportPreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_preview_marks_holiday_with_attendance_and_totals_hours(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();
        $date = Carbon::create(2026, 3, 5, 8, 0, 0);

        Holiday::factory()->create([
            'holiday_date' => $date->toDateString(),
            'name' => 'Founders Day',
            'is_recurring' => false,
        ]);

        AttendanceRecord::factory()->create([
            'faculty_id' => $faculty->id,
            'attendance_date' => $date->toDateString(),
            'day_of_week' => $date->format('l'),
            'official_time_in' => $date->copy()->setTime(8, 0, 0),
            'official_time_out' => $date->copy()->setTime(17, 0, 0),
            'operational_day_of_week' => $date->format('l'),
            'operational_time_in' => $date->copy()->setTime(8, 0, 0),
            'operational_time_out' => $date->copy()->setTime(17, 0, 0),
            'actual_time_in' => $date->copy()->setTime(8, 0, 0),
            'actual_time_out' => $date->copy()->setTime(17, 0, 0),
            'total_hours_rendered' => 8,
            'required_hours' => 8,
            'status' => 'present',
            'remarks' => '',
            'is_manual_entry' => false,
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 5);

        $this->assertNotNull($dayRow);
        $this->assertTrue($dayRow['is_holiday']);
        $this->assertStringContainsString('Founders Day', $dayRow['holiday_label']);
        $this->assertSame('8:00AM', $dayRow['morning_in']);
        $this->assertEquals(8, $payload['summary']['totalHoursRendered']);
    }

    public function test_preview_assigns_slots_by_official_time_and_maps_internal_schedule(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();
        $date = Carbon::create(2026, 3, 6, 8, 0, 0);

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-TEST-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => $date->copy()->startOfMonth(),
            'effective_until' => $date->copy()->endOfMonth(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        $internalSchedule = InternalSchedule::create([
            'schedule_id' => $schedule->id,
            'faculty_id' => $faculty->id,
            'day_of_week' => 'Wednesday',
            'device_time_in' => $date->copy()->addDays(2)->setTime(10, 0, 0),
            'device_time_out' => $date->copy()->addDays(2)->setTime(12, 0, 0),
            'is_operational' => true,
            'required_hours' => 2,
            'sync_status' => 'synced',
        ]);

        AttendanceRecord::factory()->create([
            'faculty_id' => $faculty->id,
            'attendance_date' => $date->toDateString(),
            'day_of_week' => $date->format('l'),
            'official_time_in' => $date->copy()->setTime(8, 0, 0),
            'official_time_out' => $date->copy()->setTime(10, 0, 0),
            'operational_day_of_week' => 'Wednesday',
            'operational_time_in' => $date->copy()->addDays(2)->setTime(10, 0, 0),
            'operational_time_out' => $date->copy()->addDays(2)->setTime(12, 0, 0),
            'actual_time_in' => $date->copy()->addDays(2)->setTime(10, 30, 0),
            'actual_time_out' => $date->copy()->addDays(2)->setTime(11, 30, 0),
            'internal_schedule_id' => $internalSchedule->id,
            'required_hours' => 2,
            'total_hours_rendered' => 2,
        ]);

        AttendanceRecord::factory()->create([
            'faculty_id' => $faculty->id,
            'attendance_date' => $date->toDateString(),
            'day_of_week' => $date->format('l'),
            'official_time_in' => $date->copy()->setTime(13, 0, 0),
            'official_time_out' => $date->copy()->setTime(15, 0, 0),
            'operational_day_of_week' => $date->format('l'),
            'operational_time_in' => $date->copy()->setTime(13, 0, 0),
            'operational_time_out' => $date->copy()->setTime(15, 0, 0),
            'actual_time_in' => $date->copy()->setTime(13, 0, 0),
            'actual_time_out' => $date->copy()->setTime(15, 0, 0),
            'internal_schedule_id' => null,
            'required_hours' => 2,
            'total_hours_rendered' => 2,
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 6);

        $this->assertNotNull($dayRow);
        $this->assertSame('8:30AM', $dayRow['official_morning_in']);
        $this->assertSame('9:30AM', $dayRow['official_morning_out']);
        $this->assertSame('1:00PM', $dayRow['official_afternoon_in']);
        $this->assertSame('3:00PM', $dayRow['official_afternoon_out']);
        $this->assertSame(30, $dayRow['tardy_minutes']);
        $this->assertSame(30, $dayRow['undertime_minutes']);
        $this->assertEquals(3.0, $dayRow['total_hours_rendered']);
        $this->assertEquals(4.0, $dayRow['required_hours']);
    }

    public function test_dispatch_batch_queues_job(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculties = Faculty::factory()->count(2)->create();

        Bus::fake();

        $response = $this->postJson(route('admin.dtr-export.dispatch-batch'), [
            'faculty_ids' => $faculties->pluck('id')->all(),
            'month' => 3,
            'year' => 2026,
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'fileName',
                'message',
            ]);

        Bus::assertDispatched(GenerateDtrBatchZipJob::class, function (GenerateDtrBatchZipJob $job) use ($faculties) {
            return $job->facultyIds === $faculties->pluck('id')->all()
                && $job->month === 3
                && $job->year === 2026;
        });
    }

    public function test_preview_batch_returns_multiple_faculty_previews(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculties = Faculty::factory()->count(2)->create();

        $response = $this->postJson(route('admin.dtr-export.preview-batch'), [
            'faculty_ids' => $faculties->pluck('id')->all(),
            'month' => 3,
            'year' => 2026,
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'periodLabel',
                'previews' => [
                    ['faculty', 'rows', 'summary'],
                ],
            ]);

        $payload = $response->json();
        $this->assertCount(2, $payload['previews']);
    }

    public function test_preview_generates_absent_slots_from_active_schedule_without_attendance_records(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-ABS-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 3, 1, 0, 0, 0),
            'effective_until' => Carbon::create(2026, 3, 31, 23, 59, 59),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('08:00:00'),
            'end_time' => Carbon::parse('10:00:00'),
            'subject_desc' => 'Algebra',
            'course_code' => 'MATH101',
            'room_code' => 'R101',
            'hours_required' => 2,
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 2);

        $this->assertNotNull($dayRow);
        $this->assertSame('8:00AM', $dayRow['official_morning_in']);
        $this->assertSame('10:00AM', $dayRow['official_morning_out']);
        $this->assertTrue($dayRow['official_morning_absent']);
        $this->assertSame('absent', $dayRow['status']);
        $this->assertEquals(0.0, $dayRow['total_hours_rendered']);
        $this->assertEquals(2.0, $dayRow['required_hours']);
        $this->assertEquals(5, $payload['summary']['daysAbsent']);
        $this->assertEquals(10.0, $payload['summary']['totalHoursAbsent']);
    }

    public function test_preview_keeps_day_present_when_one_subject_is_attended_and_another_is_absent(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();
        $date = Carbon::create(2026, 3, 2, 8, 0, 0);

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-PARTIAL-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => $date->copy()->startOfMonth(),
            'effective_until' => $date->copy()->endOfMonth(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        $attendedSubject = ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('08:00:00'),
            'end_time' => Carbon::parse('10:00:00'),
            'subject_desc' => 'Algebra',
            'course_code' => 'MATH101',
            'room_code' => 'R101',
            'hours_required' => 2,
        ]);

        ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('13:00:00'),
            'end_time' => Carbon::parse('15:00:00'),
            'subject_desc' => 'Statistics',
            'course_code' => 'STAT101',
            'room_code' => 'R102',
            'hours_required' => 2,
        ]);

        AttendanceRecord::factory()->create([
            'faculty_id' => $faculty->id,
            'schedule_detail_id' => $attendedSubject->id,
            'attendance_date' => $date->toDateString(),
            'day_of_week' => $date->format('l'),
            'official_time_in' => $date->copy()->setTime(8, 0, 0),
            'official_time_out' => $date->copy()->setTime(10, 0, 0),
            'operational_day_of_week' => $date->format('l'),
            'operational_time_in' => $date->copy()->setTime(8, 0, 0),
            'operational_time_out' => $date->copy()->setTime(10, 0, 0),
            'actual_time_in' => $date->copy()->setTime(8, 0, 0),
            'actual_time_out' => $date->copy()->setTime(10, 0, 0),
            'total_hours_rendered' => 2,
            'required_hours' => 2,
            'status' => 'present',
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 2);

        $this->assertNotNull($dayRow);
        $this->assertSame('present', $dayRow['status']);
        $this->assertFalse($dayRow['official_morning_absent']);
        $this->assertTrue($dayRow['official_afternoon_absent']);
        $this->assertSame('1:00PM', $dayRow['official_afternoon_in']);
        $this->assertSame('3:00PM', $dayRow['official_afternoon_out']);
        $this->assertEquals(2.0, $dayRow['total_hours_rendered']);
        $this->assertEquals(4.0, $dayRow['required_hours']);
        $this->assertEquals(1, $payload['summary']['daysPresent']);
        $this->assertEquals(4, $payload['summary']['daysAbsent']);
        $this->assertEquals(16.0, $payload['summary']['totalHoursAbsent']);
    }

    public function test_preview_shows_attended_slot_when_day_has_more_than_three_subjects(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();
        $date = Carbon::create(2026, 3, 2, 8, 0, 0);

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-MANY-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => $date->copy()->startOfMonth(),
            'effective_until' => $date->copy()->endOfMonth(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        $slots = [
            ['07:00:00', '08:00:00', false],
            ['08:00:00', '09:00:00', false],
            ['09:00:00', '10:00:00', false],
            ['10:00:00', '11:00:00', true],
        ];

        foreach ($slots as $index => [$startTime, $endTime, $attended]) {
            $detail = ScheduleDetail::create([
                'schedule_id' => $schedule->id,
                'day' => 'Monday',
                'start_time' => Carbon::parse($startTime),
                'end_time' => Carbon::parse($endTime),
                'subject_desc' => 'Subject '.$index,
                'course_code' => 'SUBJ'.$index,
                'room_code' => 'R10'.$index,
                'hours_required' => 1,
            ]);

            if (! $attended) {
                continue;
            }

            $officialIn = Carbon::parse($date->toDateString().' '.$startTime);
            $officialOut = Carbon::parse($date->toDateString().' '.$endTime);

            AttendanceRecord::factory()->create([
                'faculty_id' => $faculty->id,
                'schedule_detail_id' => $detail->id,
                'attendance_date' => $date->toDateString(),
                'day_of_week' => $date->format('l'),
                'official_time_in' => $officialIn,
                'official_time_out' => $officialOut,
                'operational_day_of_week' => $date->format('l'),
                'operational_time_in' => $officialIn,
                'operational_time_out' => $officialOut,
                'actual_time_in' => $officialIn,
                'actual_time_out' => $officialOut,
                'total_hours_rendered' => 1,
                'required_hours' => 1,
                'status' => 'present',
            ]);
        }

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 2);

        $this->assertNotNull($dayRow);
        $this->assertSame('present', $dayRow['status']);
        $this->assertContains('10:00AM', [
            $dayRow['official_morning_in'],
            $dayRow['official_afternoon_in'],
            $dayRow['official_night_in'],
        ]);
        $this->assertEquals(1.0, $dayRow['total_hours_rendered']);
        $this->assertEquals(4.0, $dayRow['required_hours']);
    }

    public function test_preview_does_not_mark_absent_for_holiday_expected_slot(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-ABS-002',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 3, 1, 0, 0, 0),
            'effective_until' => Carbon::create(2026, 3, 31, 23, 59, 59),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('08:00:00'),
            'end_time' => Carbon::parse('10:00:00'),
            'subject_desc' => 'Algebra',
            'course_code' => 'MATH101',
            'room_code' => 'R101',
            'hours_required' => 2,
        ]);

        Holiday::factory()->create([
            'holiday_date' => '2026-03-02',
            'name' => 'Special Day',
            'is_recurring' => false,
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $dayRow = collect($payload['rows'])->firstWhere('day', 2);
        $this->assertNotNull($dayRow);
        $this->assertSame('holiday', $dayRow['status']);
        $this->assertFalse($dayRow['official_morning_absent']);
        $this->assertEquals(4, $payload['summary']['daysAbsent']);
    }

    public function test_preview_skips_absence_detection_for_flexible_schedules(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'admin');

        $faculty = Faculty::factory()->create();

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-FLEX-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 3, 1, 0, 0, 0),
            'effective_until' => Carbon::create(2026, 3, 31, 23, 59, 59),
            'status' => 'active',
            'schedule_type' => 'flexible',
            'created_by' => $admin->id,
        ]);

        ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => Carbon::parse('08:00:00'),
            'end_time' => Carbon::parse('10:00:00'),
            'subject_desc' => 'Algebra',
            'course_code' => 'MATH101',
            'room_code' => 'R101',
            'hours_required' => 2,
        ]);

        $response = $this->getJson(route('admin.dtr-export.preview', [
            'faculty_id' => $faculty->id,
            'month' => 3,
            'year' => 2026,
        ]));

        $response->assertOk();

        $payload = $response->json();
        $this->assertEquals(0, $payload['summary']['daysAbsent']);
        $this->assertEquals(0.0, $payload['summary']['totalHoursAbsent']);
    }
}
