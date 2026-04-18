<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\InternalSchedule;
use App\Models\Schedule;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FacultySchedulePageTest extends TestCase
{
    use RefreshDatabase;

    public function test_schedule_page_returns_mirrored_official_and_internal_data_for_comparison_rows(): void
    {
        $faculty = $this->createFaculty();

        $schedule = $this->createActiveSchedule($faculty);
        $officialDetail = $this->createScheduleDetail($schedule);

        InternalSchedule::create([
            'schedule_id' => $schedule->id,
            'faculty_id' => $faculty->id,
            'day_of_week' => 'Wednesday',
            'device_time_in' => Carbon::create(2026, 1, 1, 10, 0, 0),
            'device_time_out' => Carbon::create(2026, 1, 1, 12, 0, 0),
            'is_operational' => true,
            'required_hours' => 2,
            'sync_status' => 'synced',
            'synced_at' => now(),
        ]);

        ScheduleChangeRequest::create([
            'faculty_id' => $faculty->id,
            'schedule_detail_id' => $officialDetail->id,
            'requested_day_of_week' => 'Wednesday',
            'requested_time_in' => '10:00:00',
            'requested_time_out' => '12:00:00',
            'requested_room' => 'LAB-2',
            'effective_date' => Carbon::create(2026, 4, 18),
            'reason' => 'Move class to the internal Wednesday block.',
            'status' => 'approved',
        ]);

        $response = $this
            ->actingAs($faculty->user)
            ->get(route('faculty.schedule'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Faculty/Schedule')
            ->where('facultyName', $faculty->full_name)
            ->has('weeklySchedule', 1)
            ->where('weeklySchedule.0.day', 'Monday')
            ->where('weeklySchedule.0.classes.0.id', $officialDetail->id)
            ->where('weeklySchedule.0.classes.0.subject', 'National Service Training Program 2')
            ->where('weeklySchedule.0.classes.0.startTime', '08:00 AM')
            ->has('internalSchedule', 1)
            ->where('internalSchedule.0.day', 'Wednesday')
            ->where('internalSchedule.0.entries.0.subject', 'National Service Training Program 2')
            ->where('internalSchedule.0.entries.0.startTime', '10:00 AM')
            ->where('internalSchedule.0.entries.0.isChanged', true)
            ->where('internalSchedule.0.entries.0.originalScheduleDetailId', $officialDetail->id)
            ->where('internalSchedule.0.entries.0.comparison.day', 'Monday')
            ->where('internalSchedule.0.entries.0.comparison.startTime', '08:00 AM')
            ->where('internalSchedule.0.entries.0.room', 'LAB-2')
        );
    }

    private function createActiveSchedule(Faculty $faculty): Schedule
    {
        return Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-FAC-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 4, 1)->startOfDay(),
            'effective_until' => Carbon::create(2026, 6, 30)->endOfDay(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'notes' => 'Faculty schedule test data',
        ]);
    }

    private function createScheduleDetail(Schedule $schedule): ScheduleDetail
    {
        $startTime = Carbon::create(2026, 1, 1, 8, 0, 0);
        $endTime = Carbon::create(2026, 1, 1, 10, 0, 0);

        return ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => $startTime,
            'end_time' => $endTime,
            'course_code' => 'NSTP-2A',
            'subject_desc' => 'National Service Training Program 2',
            'room_code' => 'RM-101',
            'hours_required' => 2,
            'program_code' => 'BSIT',
            'year_level' => '2',
            'section_name' => 'A',
        ]);
    }

    private function createFaculty(): Faculty
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.schedule.test',
            'email' => 'faculty.schedule.test@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        return Faculty::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'faculty_code' => 'FC-1001',
            'biometric_id' => 'BIO-1001',
            'first_name' => 'Nelson',
            'last_name' => 'Angeles',
            'employment_type' => 'full-time',
            'is_active' => true,
        ]);
    }
}
