<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Execution order respects foreign-key dependencies:
     *
     *  1. RolePermissionSeeder   – Spatie roles & permissions
     *  2. DepartmentSeeder       – 5 departments
     *  3. UserSeeder             – 2 admin/HR users + 15 faculty users (roles assigned)
     *  4. FacultySeeder          – 15 faculty records (3 per department)
     *  5. ScheduleSeeder         – 15 schedules · 45 schedule_details · 45 internal_schedules
     *  6. HolidaySeeder          – Philippine public holidays 2026
     *  7. SystemSettingSeeder    – 10 application settings
     *  8. ImportBatchSeeder      – 3 biometric import batches
     *  9. BiometricLogSeeder     – 540 raw biometric entries (18 weeks × 15 faculty × 2 logs)
     * 10. AttendanceSeeder       – 270 attendance records + 75 DTR summaries
     * 11. ManualAttendanceEntrySeeder – Attendance records with NULL times for manual entry testing
     * 12. AttendanceJustificationSeeder – General attendance justifications (leave, undertime)
     * 13. ManualAttendanceRequestSeeder – Manual attendance requests for angelesnelson@example.com
     * 14. LeaveApplicationSeeder – 15 leave applications
     * 15. ScheduleChangeRequestSeeder – ~37 schedule change requests (2-3 per faculty)
     * 16. OnlineAttendanceSeeder – ~37 online attendance requests (2-3 per faculty)
     * 17. AttendanceAdjustmentSeeder – 5 attendance adjustments
     * 18. AuditLogSeeder – 7 audit log entries
     */
    public function run(): void
    {
        DB::transaction(function () {
            $this->call([
                RolePermissionSeeder::class,
                DepartmentSeeder::class,
                UserSeeder::class,
                HrAdminSeeder::class,
                FacultySeeder::class,
                RoomSeeder::class,
                ScheduleSeeder::class,
                HolidaySeeder::class,
                SystemSettingSeeder::class,
                ImportBatchSeeder::class,
                BiometricLogSeeder::class,
                AttendanceSeeder::class,
                ManualAttendanceEntrySeeder::class,
                AttendanceJustificationSeeder::class,
                ManualAttendanceRequestSeeder::class,
                LeaveApplicationSeeder::class,
                ScheduleChangeRequestSeeder::class,
                OnlineAttendanceSeeder::class,
                AttendanceAdjustmentSeeder::class,
                AuditLogSeeder::class,
            ]);
        });
    }
}
