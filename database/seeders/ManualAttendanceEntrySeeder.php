<?php

namespace Database\Seeders;

use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ManualAttendanceEntrySeeder extends Seeder
{
    /**
     * Creates attendance records with missing time entries for testing manual time requests.
     * These records will appear as "available for manual entry" in the faculty dashboard.
     */
    public function run(): void
    {
        $user = User::where('email', 'angelesnelson@example.com')->first();
        if (!$user) {
            $this->command->warn('User angelesnelson@example.com not found. Skipping manual attendance entry seeding.');
            return;
        }

        $faculty = Faculty::where('user_id', $user->id)->first();
        if (!$faculty) {
            $this->command->warn('Faculty record for angelesnelson@example.com not found. Skipping manual attendance entry seeding.');
            return;
        }

        $schedule = Schedule::where('faculty_id', $faculty->id)->first();
        if (!$schedule) {
            $this->command->warn('Schedule for angelesnelson@example.com not found. Skipping manual attendance entry seeding.');
            return;
        }

        // Get all available schedule details for this schedule
        $scheduleDetails = ScheduleDetail::where('schedule_id', $schedule->id)
            ->orderBy('day')
            ->get();

        if ($scheduleDetails->isEmpty()) {
            $this->command->warn('No schedule details found for this schedule.');
            return;
        }

        // Days to create attendance records (last 5 working days)
        $daysToCreate = [
            ['day' => 'Monday', 'daysAgo' => 9],
            ['day' => 'Tuesday', 'daysAgo' => 8],
            ['day' => 'Wednesday', 'daysAgo' => 7],
            ['day' => 'Thursday', 'daysAgo' => 6],
            ['day' => 'Friday', 'daysAgo' => 5],
        ];

        foreach ($daysToCreate as $dayConfig) {
            $dayName = $dayConfig['day'];
            $daysAgo = $dayConfig['daysAgo'];

            // Find the schedule detail for this day
            $scheduleDetail = $scheduleDetails->firstWhere('day', $dayName);

            if (!$scheduleDetail) {
                continue;
            }

            $attendanceDate = Carbon::now()->subDays($daysAgo)->format('Y-m-d');

            // Check if record already exists
            $existingRecord = AttendanceRecord::where('faculty_id', $faculty->id)
                ->where('attendance_date', $attendanceDate)
                ->first();

            if ($existingRecord) {
                $this->command->info("Attendance record for {$attendanceDate} already exists. Skipping.");
                continue;
            }

            // Extract time portion from schedule detail (they're stored as datetime)
            $startTime = Carbon::parse($scheduleDetail->start_time)->format('H:i:s');
            $endTime = Carbon::parse($scheduleDetail->end_time)->format('H:i:s');

            // Create official times based on schedule detail
            $officialTimeIn = Carbon::parse($attendanceDate . ' ' . $startTime);
            $officialTimeOut = Carbon::parse($attendanceDate . ' ' . $endTime);

            // Create attendance record with NULL actual times (making it available for manual entry)
            AttendanceRecord::create([
                'faculty_id' => $faculty->id,
                'schedule_detail_id' => $scheduleDetail->id,
                'attendance_date' => $attendanceDate,
                'day_of_week' => $dayName,
                'official_time_in' => $officialTimeIn,
                'official_time_out' => $officialTimeOut,
                'actual_time_in' => null, // NULL for manual entry
                'actual_time_out' => null, // NULL for manual entry
                'status' => 'absent', // Status will be updated after manual entry
                'late_minutes' => 0,
                'undertime_minutes' => 0,
                'overtime_minutes' => 0,
                'total_hours_rendered' => 0,
                'required_hours' => $scheduleDetail->hours_required ?? 0,
                'remarks' => 'Biometric record missing - available for manual time entry',
                'is_manual_entry' => false,
            ]);

            $this->command->info("✓ Created attendance record for {$attendanceDate} ({$dayName}) - Available for manual entry");
        }

        $this->command->info('✓ Manual attendance entry seeding completed');
    }
}
