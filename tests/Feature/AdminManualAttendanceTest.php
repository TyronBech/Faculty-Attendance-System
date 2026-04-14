<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\InternalSchedule;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use App\Services\ManualAttendanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManualAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_service_lists_only_faculties_with_active_and_effective_schedule(): void
    {
        $targetDate = Carbon::create(2026, 4, 13, 0, 0, 0);
        $targetDay = $targetDate->format('l');

        $internalFaculty = $this->createFaculty('BIO-9101');
        $officialFaculty = $this->createFaculty('BIO-9102');
        $noDayMatchFaculty = $this->createFaculty('BIO-9103');
        $inactiveRangeFaculty = $this->createFaculty('BIO-9104');

        $internalSchedule = $this->createActiveSchedule($internalFaculty, 'SCH-INT-001', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());
        $officialSchedule = $this->createActiveSchedule($officialFaculty, 'SCH-OFC-001', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());
        $noDayMatchSchedule = $this->createActiveSchedule($noDayMatchFaculty, 'SCH-NODAY-001', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());
        $inactiveRangeSchedule = $this->createActiveSchedule($inactiveRangeFaculty, 'SCH-OLD-001', $targetDate->copy()->subWeeks(2), $targetDate->copy()->subWeek());

        $this->createScheduleDetail($internalSchedule, $targetDay, '08:00:00', '11:00:00', 'INT100', 'Internal Priority Subject');
        $this->createScheduleDetail($officialSchedule, $targetDay, '10:00:00', '12:00:00', 'OFF200', 'Official Fallback Subject');
        $this->createScheduleDetail($noDayMatchSchedule, 'Tuesday', '09:00:00', '10:00:00', 'NOD300', 'No Day Match');
        $this->createScheduleDetail($inactiveRangeSchedule, $targetDay, '13:00:00', '15:00:00', 'OLD400', 'Inactive Range Subject');

        InternalSchedule::create([
            'schedule_id' => $internalSchedule->id,
            'faculty_id' => $internalFaculty->id,
            'day_of_week' => $targetDay,
            'device_time_in' => Carbon::create(2026, 1, 1, 9, 0, 0),
            'device_time_out' => Carbon::create(2026, 1, 1, 17, 0, 0),
            'is_operational' => true,
            'required_hours' => 8,
            'sync_status' => 'synced',
            'synced_at' => now(),
        ]);

        $candidateRows = collect(
            app(ManualAttendanceService::class)->getCandidatesForDate($targetDate)
        );
        $candidateFacultyIds = $candidateRows->pluck('faculty_id')->all();

        $this->assertContains($internalFaculty->id, $candidateFacultyIds);
        $this->assertContains($officialFaculty->id, $candidateFacultyIds);
        $this->assertNotContains($noDayMatchFaculty->id, $candidateFacultyIds);
        $this->assertNotContains($inactiveRangeFaculty->id, $candidateFacultyIds);

        $internalRow = $candidateRows->firstWhere('faculty_id', $internalFaculty->id);
        $officialRow = $candidateRows->firstWhere('faculty_id', $officialFaculty->id);

        $this->assertNotNull($internalRow);
        $this->assertNotNull($officialRow);
        $this->assertSame('09:00 AM', $internalRow['operational_time_in']);
        $this->assertContains('internal', $internalRow['sources']);
        $this->assertContains('official', $officialRow['sources']);
    }

    public function test_store_creates_manual_attendance_records_with_remarks(): void
    {
        $admin = $this->createAdminUser();
        $targetDate = Carbon::create(2026, 4, 13, 0, 0, 0);
        $targetDay = $targetDate->format('l');

        $internalFaculty = $this->createFaculty('BIO-9201');
        $officialFaculty = $this->createFaculty('BIO-9202');

        $internalSchedule = $this->createActiveSchedule($internalFaculty, 'SCH-INT-002', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());
        $officialSchedule = $this->createActiveSchedule($officialFaculty, 'SCH-OFC-002', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());

        $internalDetail = $this->createScheduleDetail($internalSchedule, $targetDay, '09:00:00', '12:00:00', 'MTH101', 'Mathematics 101');
        $officialDetail = $this->createScheduleDetail($officialSchedule, $targetDay, '13:00:00', '16:00:00', 'SCI201', 'Science 201');

        InternalSchedule::create([
            'schedule_id' => $internalSchedule->id,
            'faculty_id' => $internalFaculty->id,
            'day_of_week' => $targetDay,
            'device_time_in' => Carbon::create(2026, 1, 1, 9, 0, 0),
            'device_time_out' => Carbon::create(2026, 1, 1, 12, 0, 0),
            'is_operational' => true,
            'required_hours' => 3,
            'sync_status' => 'synced',
            'synced_at' => now(),
        ]);

        $remarks = 'Classes suspended due to weather disturbance. Manual attendance encoded by admin.';

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance.index', ['date' => $targetDate->toDateString()]))
            ->post(route('admin.manual-attendance.store'), [
                'attendance_date' => $targetDate->toDateString(),
                'faculty_ids' => [$internalFaculty->id, $officialFaculty->id],
                'remarks' => $remarks,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $internalRecord = AttendanceRecord::query()
            ->where('faculty_id', $internalFaculty->id)
            ->where('schedule_detail_id', $internalDetail->id)
            ->first();

        $officialRecord = AttendanceRecord::query()
            ->where('faculty_id', $officialFaculty->id)
            ->where('schedule_detail_id', $officialDetail->id)
            ->first();

        $this->assertNotNull($internalRecord);
        $this->assertNotNull($officialRecord);
        $this->assertSame($targetDate->toDateString(), Carbon::parse($internalRecord->attendance_date)->toDateString());
        $this->assertSame($targetDate->toDateString(), Carbon::parse($officialRecord->attendance_date)->toDateString());
        $this->assertSame('present', $internalRecord->status);
        $this->assertSame('present', $officialRecord->status);
        $this->assertSame($remarks, $internalRecord->remarks);
        $this->assertSame($remarks, $officialRecord->remarks);
        $this->assertTrue((bool) $internalRecord->is_manual_entry);
        $this->assertTrue((bool) $officialRecord->is_manual_entry);

        $this->assertSame(2, AttendanceRecord::count());
    }

    public function test_store_requires_remarks_before_saving(): void
    {
        $admin = $this->createAdminUser();
        $targetDate = Carbon::create(2026, 4, 13, 0, 0, 0);

        $faculty = $this->createFaculty('BIO-9301');
        $schedule = $this->createActiveSchedule($faculty, 'SCH-VAL-001', $targetDate->copy()->subDay(), $targetDate->copy()->addDay());
        $this->createScheduleDetail($schedule, $targetDate->format('l'), '08:00:00', '10:00:00', 'VAL100', 'Validation Subject');

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance.index', ['date' => $targetDate->toDateString()]))
            ->post(route('admin.manual-attendance.store'), [
                'attendance_date' => $targetDate->toDateString(),
                'faculty_ids' => [$faculty->id],
                'remarks' => '',
            ]);

        $response->assertSessionHasErrors(['remarks']);
        $this->assertSame(0, AttendanceRecord::count());
    }

    private function createFaculty(string $biometricId): Faculty
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.' . strtolower(str_replace('-', '', $biometricId)),
            'email' => strtolower($biometricId) . '@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        return Faculty::factory()
            ->for($user)
            ->for($department)
            ->create([
                'biometric_id' => $biometricId,
                'faculty_code' => 'FC-' . substr($biometricId, -4),
                'is_active' => true,
            ]);
    }

    private function createAdminUser(): User
    {
        return User::create([
            'username' => 'admin.' . fake()->unique()->numerify('###'),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'is_active' => true,
        ]);
    }

    private function createActiveSchedule(Faculty $faculty, string $scheduleCode, Carbon $effectiveFrom, Carbon $effectiveUntil): Schedule
    {
        return Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => $scheduleCode,
            'academic_year' => (int) $effectiveFrom->format('Y'),
            'semester' => 1,
            'effective_from' => $effectiveFrom->copy()->startOfDay(),
            'effective_until' => $effectiveUntil->copy()->endOfDay(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'notes' => 'Test schedule',
        ]);
    }

    private function createScheduleDetail(
        Schedule $schedule,
        string $day,
        string $startTime,
        string $endTime,
        string $courseCode,
        string $subjectDesc
    ): ScheduleDetail {
        $start = Carbon::create(2026, 1, 1)->setTimeFromTimeString($startTime);
        $end = Carbon::create(2026, 1, 1)->setTimeFromTimeString($endTime);

        return ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => $day,
            'start_time' => $start,
            'end_time' => $end,
            'course_code' => $courseCode,
            'subject_desc' => $subjectDesc,
            'room_code' => 'R-201',
            'hours_required' => round($start->diffInMinutes($end) / 60, 2),
        ]);
    }
}
