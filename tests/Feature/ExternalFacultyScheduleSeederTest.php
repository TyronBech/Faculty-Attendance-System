<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Database\Seeders\DepartmentSeeder;
use Database\Seeders\FacultySeeder;
use Database\Seeders\ScheduleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExternalFacultyScheduleSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeders_map_nested_api_schedule_payload_to_existing_database_columns(): void
    {
        $this->fakeFacultySchedulesApi();
        $this->seed(DepartmentSeeder::class);

        $this->createUser('admin', 'admin@example.com');
        $this->createUser('maria.delacruz', 'maria.delacruz@example.edu');
        $this->createUser('jose.santos', 'jose.santos@example.edu');

        $roomB201 = Room::create([
            'flss_room_id' => 201,
            'room_code' => 'B201',
            'building_name' => 'Academic Building B',
        ]);

        Room::create([
            'flss_room_id' => 204,
            'room_code' => 'B204',
            'building_name' => 'Academic Building B',
        ]);

        $this->seed([FacultySeeder::class, ScheduleSeeder::class]);

        $faculty = Faculty::where('faculty_code', 'FA101TG2026')->firstOrFail();

        $this->assertSame(101, $faculty->external_faculty_id);
        $this->assertSame('Part-Time', $faculty->faculty_type);
        $this->assertSame(12, $faculty->assigned_units);
        $this->assertSame('BSIT', $faculty->department?->code);

        $schedule = Schedule::where('faculty_id', $faculty->id)->firstOrFail();
        $this->assertSame(101, $schedule->external_faculty_id);

        $mondayDetail = ScheduleDetail::where('schedule_id', $schedule->id)
            ->where('day', 'Monday')
            ->firstOrFail();

        $this->assertSame('Web Systems and Technologies', $mondayDetail->course_title);
        $this->assertSame('IT 321', $mondayDetail->course_code);
        $this->assertSame('Web Systems and Technologies', $mondayDetail->subject_desc);
        $this->assertSame('B201', $mondayDetail->room_code);
        $this->assertSame($roomB201->id, $mondayDetail->room_id);
        $this->assertSame(3.0, (float) $mondayDetail->hours_required);

        $fridayDetail = ScheduleDetail::query()
            ->where('schedule_id', $schedule->id)
            ->where('day', 'Friday')
            ->firstOrFail();

        $this->assertSame('Introduction to Computing', $fridayDetail->course_title);
        $this->assertSame('CS 101', $fridayDetail->course_code);
        $this->assertSame('CLAB1', $fridayDetail->room_code);
        $this->assertNull($fridayDetail->room_id);
        $this->assertSame(3.0, (float) $fridayDetail->hours_required);
    }

    public function test_schedule_seeder_updates_existing_details_when_nested_course_details_are_present(): void
    {
        $this->fakeFacultySchedulesApi();

        $department = Department::factory()->create(['code' => 'BSBA']);
        $admin = $this->createUser('admin', 'admin@example.com');
        $facultyUser = $this->createUser('maria.delacruz', 'maria.delacruz@example.edu');

        Room::create([
            'flss_room_id' => 201,
            'room_code' => 'B201',
            'building_name' => 'Academic Building B',
        ]);

        $faculty = Faculty::create([
            'external_faculty_id' => 101,
            'user_id' => $facultyUser->id,
            'department_id' => $department->id,
            'faculty_code' => 'FA101TG2026',
            'biometric_id' => 'BIOAPI101',
            'first_name' => 'Maria',
            'last_name' => 'Dela Cruz',
            'is_active' => true,
        ]);

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'external_faculty_id' => 101,
            'schedule_code' => 'SCH-API-101-2026',
            'academic_year' => 2026,
            'semester' => 2,
            'effective_from' => '2026-01-01 00:00:00',
            'effective_until' => '2026-12-31 23:59:59',
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => '2026-01-01 08:00:00',
            'end_time' => '2026-01-01 11:00:00',
            'course_title' => null,
            'course_code' => null,
            'room_code' => null,
            'subject_desc' => null,
            'hours_required' => 1,
        ]);

        $this->seed(ScheduleSeeder::class);

        $detail = ScheduleDetail::where('schedule_id', $schedule->id)
            ->where('day', 'Monday')
            ->where('start_time', '2026-01-01 08:00:00')
            ->firstOrFail();

        $this->assertSame('Web Systems and Technologies', $detail->course_title);
        $this->assertSame('IT 321', $detail->course_code);
        $this->assertSame('Web Systems and Technologies', $detail->subject_desc);
        $this->assertSame('B201', $detail->room_code);
        $this->assertSame(3.0, (float) $detail->hours_required);
    }

    private function fakeFacultySchedulesApi(): void
    {
        config()->set('services.flss_backend.key', 'test-key');
        config()->set('services.flss_backend.faculty_schedules_url', 'https://example.test/api/v1/faculty-schedules');
        config()->set('services.flss_backend.skip_ssl_verification', true);

        $payload = json_decode(file_get_contents(base_path('api.example.json')), true, 512, JSON_THROW_ON_ERROR);

        Http::fake([
            'https://example.test/api/v1/faculty-schedules*' => Http::response($payload, 200),
        ]);
    }

    private function createUser(string $username, string $email): User
    {
        return User::create([
            'username' => $username,
            'email' => $email,
            'password' => 'password',
            'is_active' => true,
        ]);
    }
}
