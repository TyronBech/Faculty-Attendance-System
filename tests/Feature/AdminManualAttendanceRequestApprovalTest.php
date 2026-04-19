<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AttendanceJustification;
use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\InternalSchedule;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManualAttendanceRequestApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_approve_manual_request_and_record_requested_times(): void
    {
        $admin = $this->createAdminUser();
        $context = $this->createManualRequestContext();

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance-requests.index'))
            ->patch(route('admin.manual-attendance-requests.approve', $context['request']->id), [
                'review_remarks' => 'Approved after schedule verification.',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $context['request']->refresh();
        $context['attendanceRecord']->refresh();

        $this->assertSame('approved', $context['request']->status);
        $this->assertTrue((bool) $context['request']->counts_as_manual_log);
        $this->assertSame('Approved after schedule verification.', $context['request']->review_remarks);

        $this->assertSame(
            $context['request']->requested_time_in->format('Y-m-d H:i:s'),
            $context['attendanceRecord']->actual_time_in?->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $context['request']->requested_time_out->format('Y-m-d H:i:s'),
            $context['attendanceRecord']->actual_time_out?->format('Y-m-d H:i:s')
        );
        $this->assertSame(15, (int) $context['attendanceRecord']->late_minutes);
        $this->assertSame(15, (int) $context['attendanceRecord']->undertime_minutes);
        $this->assertSame('late', $context['attendanceRecord']->status);
        $this->assertTrue((bool) $context['attendanceRecord']->is_manual_entry);

        $this->assertSame('09:00:00', $context['attendanceRecord']->operational_time_in?->format('H:i:s'));
        $this->assertSame('12:00:00', $context['attendanceRecord']->operational_time_out?->format('H:i:s'));
    }

    public function test_admin_rejection_requires_reason(): void
    {
        $admin = $this->createAdminUser();
        $context = $this->createManualRequestContext();

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance-requests.index'))
            ->patch(route('admin.manual-attendance-requests.reject', $context['request']->id), [
                'review_remarks' => '',
            ]);

        $response->assertSessionHasErrors(['review_remarks']);
        $context['request']->refresh();
        $this->assertSame('pending', $context['request']->status);
    }

    public function test_admin_cannot_approve_counted_manual_log_after_five_in_semester(): void
    {
        $admin = $this->createAdminUser();
        $context = $this->createManualRequestContext();
        $faculty = $context['faculty'];
        $scheduleDetail = $context['scheduleDetail'];
        $internalSchedule = $context['internalSchedule'];

        $baseDate = Carbon::create(2026, 4, 1, 0, 0, 0);
        for ($index = 0; $index < 5; $index++) {
            $date = $baseDate->copy()->addDays($index);
            $attendanceRecord = $this->createAttendanceRecord(
                faculty: $faculty,
                scheduleDetail: $scheduleDetail,
                internalSchedule: $internalSchedule,
                attendanceDate: $date,
            );

            AttendanceJustification::create([
                'attendance_record_id' => $attendanceRecord->id,
                'faculty_id' => $faculty->id,
                'type' => 'manual_time',
                'requested_time_in' => $date->copy()->setTime(9, 5),
                'requested_time_out' => $date->copy()->setTime(11, 55),
                'justification' => 'Approved historical manual request',
                'status' => 'approved',
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'review_remarks' => 'Counted.',
                'counts_as_manual_log' => true,
            ]);
        }

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance-requests.index'))
            ->patch(route('admin.manual-attendance-requests.approve', $context['request']->id), [
                'review_remarks' => 'Attempt beyond cap.',
                'count_manual_log' => true,
            ]);

        $response->assertSessionHas('error');
        $context['request']->refresh();
        $this->assertSame('pending', $context['request']->status);
    }

    public function test_admin_can_approve_without_counting_when_limit_is_reached(): void
    {
        $admin = $this->createAdminUser();
        $context = $this->createManualRequestContext();
        $faculty = $context['faculty'];
        $scheduleDetail = $context['scheduleDetail'];
        $internalSchedule = $context['internalSchedule'];

        $baseDate = Carbon::create(2026, 4, 1, 0, 0, 0);
        for ($index = 0; $index < 5; $index++) {
            $date = $baseDate->copy()->addDays($index);
            $attendanceRecord = $this->createAttendanceRecord(
                faculty: $faculty,
                scheduleDetail: $scheduleDetail,
                internalSchedule: $internalSchedule,
                attendanceDate: $date,
            );

            AttendanceJustification::create([
                'attendance_record_id' => $attendanceRecord->id,
                'faculty_id' => $faculty->id,
                'type' => 'manual_time',
                'requested_time_in' => $date->copy()->setTime(9, 5),
                'requested_time_out' => $date->copy()->setTime(11, 55),
                'justification' => 'Approved historical manual request',
                'status' => 'approved',
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'review_remarks' => 'Counted.',
                'counts_as_manual_log' => true,
            ]);
        }

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.manual-attendance-requests.index'))
            ->patch(route('admin.manual-attendance-requests.approve', $context['request']->id), [
                'review_remarks' => 'Approved but exempted from counting.',
                'count_manual_log' => false,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $context['request']->refresh();
        $this->assertSame('approved', $context['request']->status);
        $this->assertFalse((bool) $context['request']->counts_as_manual_log);

        $countedApprovals = AttendanceJustification::query()
            ->where('faculty_id', $faculty->id)
            ->where('type', 'manual_time')
            ->where('status', 'approved')
            ->where('counts_as_manual_log', true)
            ->count();

        $this->assertSame(5, $countedApprovals);
    }

    public function test_filter_returns_reviewer_full_name_for_reviewed_requests(): void
    {
        $admin = $this->createAdminUser();
        Admin::factory()->for($admin)->create([
            'first_name' => 'Ada',
            'middle_name' => null,
            'last_name' => 'Lovelace',
            'suffix_name' => null,
        ]);

        $context = $this->createManualRequestContext();
        $context['request']->update([
            'status' => 'approved',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'review_remarks' => 'Reviewed by admin profile.',
        ]);

        $response = $this->actingAs($admin, 'admin')
            ->getJson(route('admin.manual-attendance-requests.filter'));

        $response->assertOk();
        $response->assertJsonPath('data.0.reviewer_name', 'Ada Lovelace');
    }

    /**
     * @return array<string, mixed>
     */
    private function createManualRequestContext(): array
    {
        $faculty = $this->createFaculty('BIO-MANUAL-1001');
        $attendanceDate = Carbon::create(2026, 4, 13, 0, 0, 0);
        $dayOfWeek = $attendanceDate->format('l');

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-MAN-001',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 1, 1, 0, 0, 0),
            'effective_until' => Carbon::create(2026, 12, 31, 23, 59, 59),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'notes' => 'Manual request approval test schedule',
        ]);

        $scheduleDetail = ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => $dayOfWeek,
            'start_time' => Carbon::create(2026, 1, 1, 8, 0, 0),
            'end_time' => Carbon::create(2026, 1, 1, 11, 0, 0),
            'course_code' => 'MTH-301',
            'subject_desc' => 'Applied Mathematics',
            'room_code' => 'R-110',
            'hours_required' => 3,
        ]);

        $internalSchedule = InternalSchedule::create([
            'schedule_id' => $schedule->id,
            'faculty_id' => $faculty->id,
            'day_of_week' => $dayOfWeek,
            'device_time_in' => Carbon::create(2026, 1, 1, 9, 0, 0),
            'device_time_out' => Carbon::create(2026, 1, 1, 12, 0, 0),
            'is_operational' => true,
            'required_hours' => 3,
            'sync_status' => 'synced',
            'synced_at' => now(),
        ]);

        $attendanceRecord = $this->createAttendanceRecord(
            faculty: $faculty,
            scheduleDetail: $scheduleDetail,
            internalSchedule: $internalSchedule,
            attendanceDate: $attendanceDate,
        );

        $request = AttendanceJustification::create([
            'attendance_record_id' => $attendanceRecord->id,
            'faculty_id' => $faculty->id,
            'type' => 'manual_time',
            'requested_time_in' => $attendanceDate->copy()->setTime(9, 15),
            'requested_time_out' => $attendanceDate->copy()->setTime(11, 45),
            'justification' => 'Biometric terminal was offline during class hours.',
            'status' => 'pending',
            'counts_as_manual_log' => true,
        ]);

        return [
            'faculty' => $faculty,
            'schedule' => $schedule,
            'scheduleDetail' => $scheduleDetail,
            'internalSchedule' => $internalSchedule,
            'attendanceRecord' => $attendanceRecord,
            'request' => $request,
        ];
    }

    private function createAttendanceRecord(
        Faculty $faculty,
        ScheduleDetail $scheduleDetail,
        InternalSchedule $internalSchedule,
        Carbon $attendanceDate,
    ): AttendanceRecord {
        $officialIn = $attendanceDate->copy()->setTime(8, 0, 0);
        $officialOut = $attendanceDate->copy()->setTime(11, 0, 0);
        $operationalIn = $attendanceDate->copy()->setTime(9, 0, 0);
        $operationalOut = $attendanceDate->copy()->setTime(12, 0, 0);

        return AttendanceRecord::create([
            'faculty_id' => $faculty->id,
            'schedule_detail_id' => $scheduleDetail->id,
            'internal_schedule_id' => $internalSchedule->id,
            'attendance_date' => $attendanceDate->toDateString(),
            'day_of_week' => $attendanceDate->format('l'),
            'official_time_in' => $officialIn,
            'official_time_out' => $officialOut,
            'operational_day_of_week' => $attendanceDate->format('l'),
            'operational_time_in' => $operationalIn,
            'operational_time_out' => $operationalOut,
            'actual_time_in' => null,
            'actual_time_out' => null,
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'overtime_minutes' => 0,
            'night_minutes' => 0,
            'overtime_night_minutes' => 0,
            'total_hours_rendered' => 0,
            'required_hours' => 3,
            'status' => 'absent',
            'remarks' => 'Pending manual attendance request',
            'is_manual_entry' => false,
            'processed_at' => now(),
        ]);
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
}
