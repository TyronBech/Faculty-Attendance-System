<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\OnlineAttendanceRequest;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OnlineAttendanceTimestampDetectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_online_attendance_uses_filename_when_no_image_metadata_or_client_timestamp_is_available(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-20 12:00:00'));

        try {
            $this->configurePublicDisk('filename-case');

            $faculty = $this->createFaculty('BIO-ONLINE-1001');
            $scheduleDetail = $this->createScheduleDetail($faculty, 'Monday');

            $response = $this->actingAs($faculty->user)
                ->from(route('faculty.online-attendance.index'))
                ->post(route('faculty.online-attendance.store'), [
                    'schedule_detail_id' => (string) $scheduleDetail->id,
                    'class_type' => 'synchronous',
                    'attendance_date' => '2026-05-18',
                    'time_in' => '09:15',
                    'time_out' => '11:45',
                    'screenshot_in' => UploadedFile::fake()->image('Screenshot_2026-05-18_09-14-33.png'),
                    'remarks' => 'Testing filename timestamp detection.',
                ]);

            $response->assertSessionHasNoErrors();
            $response->assertSessionHas('success');

            $request = OnlineAttendanceRequest::query()->sole();

            $this->assertSame('Screenshot_2026-05-18_09-14-33.png', $request->screenshot_in_original_name);
            $this->assertSame('2026-05-18 09:14:33', $request->screenshot_in_detected_at?->format('Y-m-d H:i:s'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_online_attendance_falls_back_to_manual_time_when_detection_is_not_available(): void
    {
        $this->configurePublicDisk('manual-case');

        $faculty = $this->createFaculty('BIO-ONLINE-1002');
        $scheduleDetail = $this->createScheduleDetail($faculty, 'Tuesday');

        $response = $this->actingAs($faculty->user)
            ->from(route('faculty.online-attendance.index'))
            ->post(route('faculty.online-attendance.store'), [
                'schedule_detail_id' => (string) $scheduleDetail->id,
                'class_type' => 'synchronous',
                'attendance_date' => '2026-05-19',
                'time_in' => '08:30',
                'time_out' => '10:30',
                'screenshot_in' => UploadedFile::fake()->image('proof.png'),
                'remarks' => 'Testing manual fallback detection.',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $request = OnlineAttendanceRequest::query()->sole();

        $this->assertSame('proof.png', $request->screenshot_in_original_name);
        $this->assertSame('2026-05-19 08:30:00', $request->screenshot_in_detected_at?->format('Y-m-d H:i:s'));
    }

    public function test_online_attendance_rejects_time_in_that_is_earlier_than_detected_screenshot_time(): void
    {
        $this->configurePublicDisk('time-validation-case');

        $faculty = $this->createFaculty('BIO-ONLINE-1003');
        $scheduleDetail = $this->createScheduleDetail($faculty, 'Wednesday');

        $response = $this->actingAs($faculty->user)
            ->from(route('faculty.online-attendance.index'))
            ->post(route('faculty.online-attendance.store'), [
                'schedule_detail_id' => (string) $scheduleDetail->id,
                'class_type' => 'synchronous',
                'attendance_date' => '2026-05-20',
                'time_in' => '09:10',
                'time_out' => '11:45',
                'screenshot_in' => UploadedFile::fake()->image('Screenshot_2026-05-20_09-14-33.png'),
                'remarks' => 'Testing validation against earlier manual time.',
            ]);

        $response->assertSessionHasErrors(['time_in']);
        $this->assertDatabaseCount('online_attendance', 0);
    }

    public function test_online_attendance_allows_time_in_when_it_matches_detected_screenshot_minute(): void
    {
        $this->configurePublicDisk('time-minute-match-case');

        $faculty = $this->createFaculty('BIO-ONLINE-1004');
        $scheduleDetail = $this->createScheduleDetail($faculty, 'Thursday');

        $response = $this->actingAs($faculty->user)
            ->from(route('faculty.online-attendance.index'))
            ->post(route('faculty.online-attendance.store'), [
                'schedule_detail_id' => (string) $scheduleDetail->id,
                'class_type' => 'synchronous',
                'attendance_date' => '2026-05-20',
                'time_in' => '09:14',
                'time_out' => '11:45',
                'screenshot_in' => UploadedFile::fake()->image('Screenshot_2026-05-20_09-14-33.png'),
                'remarks' => 'Testing minute-level comparison against screenshot detection.',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');
        $this->assertDatabaseCount('online_attendance', 1);
    }

    private function createFaculty(string $biometricId): Faculty
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.'.strtolower(str_replace('-', '', $biometricId)),
            'email' => strtolower($biometricId).'@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        return Faculty::factory()
            ->for($user)
            ->for($department)
            ->create([
                'biometric_id' => $biometricId,
                'faculty_code' => 'FC-'.substr($biometricId, -4),
                'is_active' => true,
            ]);
    }

    private function createScheduleDetail(Faculty $faculty, string $dayOfWeek): ScheduleDetail
    {
        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-ONL-'.fake()->unique()->numerify('###'),
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => Carbon::create(2026, 1, 1, 0, 0, 0),
            'effective_until' => Carbon::create(2026, 12, 31, 23, 59, 59),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'notes' => 'Online attendance timestamp detection test schedule',
        ]);

        return ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => $dayOfWeek,
            'start_time' => Carbon::create(2026, 1, 1, 8, 0, 0),
            'end_time' => Carbon::create(2026, 1, 1, 11, 0, 0),
            'course_code' => 'CSC-101',
            'subject_desc' => 'Introduction to Computing',
            'room_code' => 'ONLINE',
            'hours_required' => 3,
        ]);
    }

    private function configurePublicDisk(string $directory): void
    {
        $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'faculty-attendance-system-tests'.DIRECTORY_SEPARATOR.$directory;

        config(['filesystems.disks.public.root' => $root]);
        Storage::forgetDisk('public');

        if (! is_dir($root)) {
            mkdir($root, 0777, true);
        }
    }
}
