<?php

namespace Tests\Feature;

use App\Jobs\GenerateDtrBatchZipJob;
use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Holiday;
use App\Models\InternalSchedule;
use App\Models\Schedule;
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
}
