<?php

namespace Database\Seeders;

use App\Models\AttendanceJustification;
use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ManualAttendanceRequestSeeder extends Seeder
{
    /**
     * Creates sample manual attendance requests for a specific faculty member
     */
    public function run(): void
    {
        // Find the faculty member with email angelesnelson@example.com
        $user = User::where('email', 'angelesnelson@example.com')->first();
        if (!$user) {
            $this->command->info('User angelesnelson@example.com not found. Skipping manual attendance request seeding.');
            return;
        }

        $faculty = Faculty::where('user_id', $user->id)->first();
        if (!$faculty) {
            $this->command->info('Faculty record for angelesnelson@example.com not found. Skipping manual attendance request seeding.');
            return;
        }

        // Get the latest 3 attendance records for this faculty
        $attendanceRecords = AttendanceRecord::where('faculty_id', $faculty->id)
            ->orderByDesc('attendance_date')
            ->limit(3)
            ->get();

        if ($attendanceRecords->isEmpty()) {
            $this->command->info('No attendance records found for angelesnelson@example.com. Skipping manual attendance request seeding.');
            return;
        }

        $sampleReasons = [
            'System was offline when I logged in. I cannot provide biometric data. Manual entry is necessary.',
            'Biometric device was malfunctioning at that time. I arrived on time but could not record.',
            'Badge reader was not working properly. I requested help from IT but they took time to fix it.',
        ];

        foreach ($attendanceRecords as $index => $record) {
            // Check if a manual request already exists for this record
            $existingRequest = AttendanceJustification::where('attendance_record_id', $record->id)
                ->where('type', 'manual_time')
                ->exists();
            
            if ($existingRequest) {
                continue;
            }

            // Generate random times around the official times
            $attendanceDate = Carbon::parse($record->attendance_date);
            $officialTimeIn = Carbon::parse($record->official_time_in ?? $record->operational_time_in);
            $officialTimeOut = Carbon::parse($record->official_time_out ?? $record->operational_time_out);

            // Add 5-15 minutes to official times
            $requestedTimeIn = $officialTimeIn->copy()->addMinutes(rand(5, 15));
            $requestedTimeOut = $officialTimeOut->copy()->subMinutes(rand(10, 20));

            $status = $index === 0 ? 'pending' : ($index === 1 ? 'approved' : 'rejected');

            AttendanceJustification::create([
                'attendance_record_id' => $record->id,
                'faculty_id' => $faculty->id,
                'type' => 'manual_time',
                'requested_time_in' => $requestedTimeIn,
                'requested_time_out' => $requestedTimeOut,
                'justification' => $sampleReasons[$index % count($sampleReasons)],
                'status' => $status,
                'reviewed_by' => $status !== 'pending' ? 1 : null,
                'reviewed_at' => $status !== 'pending' ? now() : null,
                'review_remarks' => $status === 'approved'
                    ? 'Approved - reasonable explanation provided. Biometric device issue confirmed with IT.'
                    : ($status === 'rejected' ? 'No supporting documentation provided.' : null),
            ]);

            $this->command->info("Created manual attendance request for {$attendanceDate->format('Y-m-d')} - Status: {$status}");
        }

        $this->command->info('Manual attendance request seeding completed for angelesnelson@example.com');
    }
}
