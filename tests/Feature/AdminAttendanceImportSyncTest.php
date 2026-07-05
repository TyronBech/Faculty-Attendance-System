<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\AdminAttendanceImportController;
use App\Models\AttendanceRecord;
use App\Models\BiometricLog;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\ImportBatch;
use App\Models\InternalSchedule;
use App\Models\Schedule;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminAttendanceImportSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_compares_actual_logs_against_approved_internal_schedule(): void
    {
        $admin = User::factory()->create();
        $faculty = Faculty::factory()->create([
            'biometric_id' => 'BIO-1001',
        ]);
        $date = Carbon::parse('2026-03-02 08:00:00');

        $schedule = Schedule::create([
            'faculty_id' => $faculty->id,
            'schedule_code' => 'SCH-INTERNAL-COMPARE',
            'academic_year' => 2026,
            'semester' => 1,
            'effective_from' => $date->copy()->startOfMonth(),
            'effective_until' => $date->copy()->endOfMonth(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'created_by' => $admin->id,
        ]);

        $detail = ScheduleDetail::create([
            'schedule_id' => $schedule->id,
            'day' => 'Monday',
            'start_time' => $date->copy()->setTime(8, 0, 0),
            'end_time' => $date->copy()->setTime(10, 0, 0),
            'subject_desc' => 'Internal Compare',
            'course_code' => 'IC101',
            'room_code' => 'R101',
            'hours_required' => 2,
        ]);

        ScheduleChangeRequest::create([
            'faculty_id' => $faculty->id,
            'schedule_detail_id' => $detail->id,
            'requested_day_of_week' => 'Monday',
            'requested_time_in' => '10:00:00',
            'requested_time_out' => '12:00:00',
            'effective_date' => $date->copy()->subDay()->toDateString(),
            'reason' => 'Internal schedule adjustment',
            'status' => 'approved',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        $internalSchedule = InternalSchedule::create([
            'schedule_id' => $schedule->id,
            'faculty_id' => $faculty->id,
            'day_of_week' => 'Monday',
            'device_time_in' => $date->copy()->setTime(10, 0, 0),
            'device_time_out' => $date->copy()->setTime(12, 0, 0),
            'is_operational' => true,
            'required_hours' => 2,
            'sync_status' => 'synced',
        ]);

        $batch = ImportBatch::create([
            'file_name' => 'internal-compare.csv',
            'file_path' => 'imports/biometric-logs/internal-compare.csv',
            'status' => 'pending',
            'started_at' => now(),
        ]);

        BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $date->copy()->setTime(10, 30, 0),
            'log_type' => 'IN',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $batch->id,
            'is_processed' => false,
        ]);

        BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $date->copy()->setTime(11, 30, 0),
            'log_type' => 'OUT',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $batch->id,
            'is_processed' => false,
        ]);

        $response = app(AdminAttendanceImportController::class)->sync($batch->fresh());
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $payload['synced_count']);
        $this->assertSame(1, $payload['attendance_records_count']);

        $attendanceRecord = AttendanceRecord::query()
            ->where('faculty_id', $faculty->id)
            ->where('schedule_detail_id', $detail->id)
            ->first();

        $this->assertNotNull($attendanceRecord);
        $this->assertSame($internalSchedule->id, $attendanceRecord->internal_schedule_id);
        $this->assertSame('2026-03-02 08:00:00', $attendanceRecord->official_time_in?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-02 10:00:00', $attendanceRecord->official_time_out?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-02 10:00:00', $attendanceRecord->operational_time_in?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-02 12:00:00', $attendanceRecord->operational_time_out?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-02 10:30:00', $attendanceRecord->actual_time_in?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-02 11:30:00', $attendanceRecord->actual_time_out?->format('Y-m-d H:i:s'));
        $this->assertSame(30, $attendanceRecord->late_minutes);
        $this->assertSame(30, $attendanceRecord->undertime_minutes);
    }

    public function test_sync_rebuilds_attendance_when_logs_are_already_processed_but_attendance_was_deleted(): void
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.resync',
            'email' => 'faculty.resync@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        $faculty = Faculty::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'faculty_code' => 'FC9101',
            'biometric_id' => 'BIO-9101',
            'first_name' => 'Resync',
            'last_name' => 'Faculty',
            'is_active' => true,
        ]);

        $filePath = 'imports/biometric-logs/rebuild-after-delete.csv';
        Storage::put($filePath, implode(PHP_EOL, [
            'biometric_id,log_datetime,log_type,device_id',
            'BIO-9101,2026-03-19 08:00:00,IN,DEVICE-01',
            'BIO-9101,2026-03-19 17:00:00,OUT,DEVICE-01',
        ]));

        $batch = ImportBatch::create([
            'file_name' => 'rebuild.csv',
            'file_path' => $filePath,
            'status' => 'completed',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        $timeIn = Carbon::parse('2026-03-19 08:00:00');
        $timeOut = Carbon::parse('2026-03-19 17:00:00');

        $processedInLog = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $timeIn,
            'log_type' => 'IN',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $batch->id,
            'is_processed' => true,
        ]);

        $processedOutLog = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $timeOut,
            'log_type' => 'OUT',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $batch->id,
            'is_processed' => true,
        ]);

        $existingAttendance = AttendanceRecord::create([
            'faculty_id' => $faculty->id,
            'schedule_detail_id' => null,
            'internal_schedule_id' => null,
            'attendance_date' => '2026-03-19',
            'day_of_week' => 'Thursday',
            'official_time_in' => $timeIn,
            'official_time_out' => $timeOut,
            'operational_day_of_week' => 'Thursday',
            'operational_time_in' => $timeIn,
            'operational_time_out' => $timeOut,
            'actual_time_in' => $timeIn,
            'actual_time_out' => $timeOut,
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'overtime_minutes' => 0,
            'total_hours_rendered' => 9.00,
            'required_hours' => 8.00,
            'status' => 'Present',
            'remarks' => 'Synced from biometric import',
            'is_manual_entry' => false,
            'processed_at' => now(),
        ]);

        $existingAttendance->delete();
        $this->assertSoftDeleted('attendance_records', ['id' => $existingAttendance->id]);

        $response = app(AdminAttendanceImportController::class)->sync($batch->fresh());
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $payload['synced_count']);
        $this->assertSame(1, $payload['attendance_records_count']);
        $this->assertTrue($processedInLog->fresh()->is_processed);
        $this->assertTrue($processedOutLog->fresh()->is_processed);

        $recreatedAttendance = AttendanceRecord::query()
            ->where('faculty_id', $faculty->id)
            ->whereDate('attendance_date', '2026-03-19')
            ->latest('id')
            ->first();

        $this->assertNotNull($recreatedAttendance);
        $this->assertSame('2026-03-19 08:00:00', $recreatedAttendance->actual_time_in?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-19 17:00:00', $recreatedAttendance->actual_time_out?->format('Y-m-d H:i:s'));
        $this->assertSame('completed', $batch->fresh()->status);
    }

    public function test_sync_reuses_unprocessed_matching_logs_from_other_batches(): void
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.sync',
            'email' => 'faculty.sync@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        $faculty = Faculty::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'faculty_code' => 'FC9001',
            'biometric_id' => 'BIO-9001',
            'first_name' => 'Sync',
            'last_name' => 'Faculty',
            'is_active' => true,
        ]);

        $filePath = 'imports/biometric-logs/corrected-sync-scope.csv';
        Storage::put($filePath, implode(PHP_EOL, [
            'biometric_id,log_datetime,log_type,device_id',
            'BIO-9001,2026-03-18 08:00:00,IN,DEVICE-01',
            'BIO-9001,2026-03-18 17:00:00,OUT,DEVICE-01',
        ]));

        $oldBatch = ImportBatch::create([
            'file_name' => 'initial.csv',
            'file_path' => $filePath,
            'status' => 'pending',
            'started_at' => now(),
        ]);

        $correctedBatch = ImportBatch::create([
            'file_name' => 'corrected.csv',
            'file_path' => $filePath,
            'duplicate_records' => 1,
            'status' => 'pending',
            'started_at' => now(),
        ]);

        $timeIn = Carbon::parse('2026-03-18 08:00:00');
        $timeOut = Carbon::parse('2026-03-18 17:00:00');

        $existingUnprocessedLog = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $timeIn,
            'log_type' => 'IN',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $oldBatch->id,
            'is_processed' => false,
        ]);

        $newlyImportedLog = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => $timeOut,
            'log_type' => 'OUT',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $correctedBatch->id,
            'is_processed' => false,
        ]);

        $response = app(AdminAttendanceImportController::class)->sync($correctedBatch->fresh());
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $payload['synced_count']);
        $this->assertSame(1, $payload['attendance_records_count']);
        $this->assertTrue($existingUnprocessedLog->fresh()->is_processed);
        $this->assertTrue($newlyImportedLog->fresh()->is_processed);

        $attendanceRecord = AttendanceRecord::query()
            ->where('faculty_id', $faculty->id)
            ->whereDate('attendance_date', '2026-03-18')
            ->first();

        $this->assertNotNull($attendanceRecord);
        $this->assertSame('2026-03-18 08:00:00', $attendanceRecord->actual_time_in?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-18 17:00:00', $attendanceRecord->actual_time_out?->format('Y-m-d H:i:s'));
        $this->assertSame('completed', $correctedBatch->fresh()->status);
        $this->assertSame('completed', $oldBatch->fresh()->status);
    }
}
