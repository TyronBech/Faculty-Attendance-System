<?php

namespace Database\Seeders;

use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\Holiday;
use App\Models\InternalSchedule;
use App\Models\LeaveApplication;
use App\Models\OnlineAttendanceRequest;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use App\Services\FlssApiSyncService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FullSimulationSeeder extends Seeder
{
    /**
     * Option 2 — API sync + realistic simulation.
     *
     * Fetches API data THEN seeds realistic requests, attendance,
     * and holidays using professional data patterns modelled after
     * real academic scenarios.
     *
     * Usage:
     *   php artisan db:seed --class=FullSimulationSeeder
     */
    public function run(FlssApiSyncService $syncService): void
    {
        $this->command?->info('╔══════════════════════════════════════════════════╗');
        $this->command?->info('║  Option 2 — Full Simulation (API + Seed Data)   ║');
        $this->command?->info('╚══════════════════════════════════════════════════╝');
        $this->command?->newLine();

        // ── Step 1: Run API sync (includes roles, departments, users) ──────
        $this->command?->info('⏳ Step 1/4: Syncing from FLSS API…');

        $this->call(FlssApiSyncSeeder::class);

        // ── Step 2: Seed holidays ──────────────────────────────────────────
        $this->command?->info('⏳ Step 2/4: Seeding holidays…');
        $this->seedHolidays();

        // ── Step 3: Seed realistic attendance ──────────────────────────────
        $this->command?->info('⏳ Step 3/4: Seeding attendance records…');
        $this->seedRealisticAttendance();

        // ── Step 4: Seed requests (leave, online attendance) ───────────────
        $this->command?->info('⏳ Step 4/4: Seeding requests…');
        $this->seedRealisticRequests();

        $this->command?->newLine();
        $this->command?->info('✓ Full simulation seeding complete!');
    }

    /**
     * Philippine public holidays for 2026.
     */
    private function seedHolidays(): void
    {
        $holidays = [
            // Regular holidays
            ['holiday_date' => '2026-01-01', 'name' => "New Year's Day",                 'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-04-02', 'name' => 'Maundy Thursday',                'type' => 'national', 'is_recurring' => false],
            ['holiday_date' => '2026-04-03', 'name' => 'Good Friday',                    'type' => 'national', 'is_recurring' => false],
            ['holiday_date' => '2026-04-04', 'name' => 'Black Saturday',                 'type' => 'national', 'is_recurring' => false],
            ['holiday_date' => '2026-04-09', 'name' => 'Araw ng Kagitingan',             'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-05-01', 'name' => 'Labor Day',                      'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-06-12', 'name' => 'Independence Day',               'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-08-28', 'name' => 'National Heroes Day',            'type' => 'national', 'is_recurring' => false],
            ['holiday_date' => '2026-11-30', 'name' => 'Bonifacio Day',                  'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-12-25', 'name' => 'Christmas Day',                  'type' => 'national', 'is_recurring' => true],
            ['holiday_date' => '2026-12-30', 'name' => 'Rizal Day',                      'type' => 'national', 'is_recurring' => true],
            // Special non-working holidays
            ['holiday_date' => '2026-02-25', 'name' => 'EDSA People Power Revolution',  'type' => 'special',  'is_recurring' => true],
            ['holiday_date' => '2026-03-31', 'name' => "Eid'l Fitr (approx.)",          'type' => 'national', 'is_recurring' => false],
            ['holiday_date' => '2026-04-01', 'name' => 'Araw ng Dabaw (local)',          'type' => 'local',    'is_recurring' => false],
            ['holiday_date' => '2026-08-21', 'name' => 'Ninoy Aquino Day',               'type' => 'special',  'is_recurring' => true],
            ['holiday_date' => '2026-11-01', 'name' => "All Saints' Day",               'type' => 'special',  'is_recurring' => true],
            ['holiday_date' => '2026-11-02', 'name' => "All Souls' Day",                'type' => 'special',  'is_recurring' => true],
            ['holiday_date' => '2026-12-08', 'name' => 'Feast of the Immaculate Conception', 'type' => 'special', 'is_recurring' => true],
            ['holiday_date' => '2026-12-24', 'name' => 'Christmas Eve',                 'type' => 'special',  'is_recurring' => true],
            ['holiday_date' => '2026-12-31', 'name' => "New Year's Eve",                'type' => 'special',  'is_recurring' => true],
        ];

        foreach ($holidays as $holiday) {
            Holiday::firstOrCreate(['holiday_date' => $holiday['holiday_date']], $holiday);
        }

        $this->command?->info('  ✓ '.count($holidays).' holidays seeded.');
    }

    /**
     * Generate realistic attendance records for the semester period.
     *
     * Patterns modelled after real academic attendance:
     *  - 85-95% of faculty arrive on time (within 5 min of schedule)
     *  - 5-10% arrive 1-15 min late (realistic traffic/parking delays)
     *  - 1-3% have undertime (leave 10-30 min early)
     *  - Holidays and weekends without classes are skipped
     *  - Some faculty have occasional absences (no record for that day)
     */
    private function seedRealisticAttendance(): void
    {
        $faculties = Faculty::orderBy('id')->get();
        $holidayDates = Holiday::pluck('holiday_date')->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))->toArray();

        // Semester period: Feb 9, 2026 → Jun 21, 2026
        $semesterStart = Carbon::create(2026, 2, 9);
        $semesterEnd = Carbon::now()->lt(Carbon::create(2026, 6, 21))
            ? Carbon::now()->subDay()
            : Carbon::create(2026, 6, 21);

        $totalRecords = 0;

        DB::beginTransaction();
        try {
            foreach ($faculties as $facultyIndex => $faculty) {
                $schedule = Schedule::where('faculty_id', $faculty->id)->first();

                if (! $schedule) {
                    continue;
                }

                $details = ScheduleDetail::where('schedule_id', $schedule->id)->get();

                if ($details->isEmpty()) {
                    continue;
                }

                $detailsByDay = $details->groupBy('day');

                // Deterministic seed based on faculty index for reproducible data
                $seed = $facultyIndex * 7 + 42;

                $period = CarbonPeriod::create($semesterStart, $semesterEnd);

                foreach ($period as $date) {
                    $dayName = $date->format('l');
                    $dateStr = $date->format('Y-m-d');

                    // Skip holidays
                    if (in_array($dateStr, $holidayDates, true)) {
                        continue;
                    }

                    // Skip days without classes
                    $dayDetails = $detailsByDay[$dayName] ?? null;

                    if (! $dayDetails || $dayDetails->isEmpty()) {
                        continue;
                    }

                    // Simulate occasional absence (3-5% chance based on faculty seed)
                    $dayHash = crc32($dateStr.$faculty->faculty_code);
                    $absenceThreshold = 95 + ($seed % 3); // 95-97

                    if (($dayHash % 100) >= $absenceThreshold) {
                        continue; // Faculty absent this day
                    }

                    foreach ($dayDetails as $detail) {
                        $existingRecord = AttendanceRecord::where('faculty_id', $faculty->id)
                            ->where('attendance_date', $dateStr)
                            ->where('schedule_detail_id', $detail->id)
                            ->exists();

                        if ($existingRecord) {
                            continue;
                        }

                        $schedTimeIn = Carbon::parse($detail->start_time)->format('H:i:s');
                        $schedTimeOut = Carbon::parse($detail->end_time)->format('H:i:s');

                        $officialIn = Carbon::parse($dateStr.' '.$schedTimeIn);
                        $officialOut = Carbon::parse($dateStr.' '.$schedTimeOut);

                        // Deterministic arrival pattern
                        $pattern = ($dayHash + $seed) % 100;
                        $lateMinutes = 0;
                        $undertimeMinutes = 0;
                        $overtimeMinutes = 0;

                        if ($pattern < 70) {
                            // 70%: On time or 1-3 min early
                            $actualIn = $officialIn->copy()->subMinutes($pattern % 4);
                            $actualOut = $officialOut->copy()->addMinutes($pattern % 3);
                        } elseif ($pattern < 85) {
                            // 15%: 1-8 min late (minor delays)
                            $lateMinutes = 1 + ($pattern % 8);
                            $actualIn = $officialIn->copy()->addMinutes($lateMinutes);
                            $actualOut = $officialOut->copy();
                        } elseif ($pattern < 93) {
                            // 8%: 8-15 min late (traffic, parking)
                            $lateMinutes = 8 + ($pattern % 8);
                            $actualIn = $officialIn->copy()->addMinutes($lateMinutes);
                            $actualOut = $officialOut->copy();
                        } elseif ($pattern < 97) {
                            // 4%: Left 10-25 min early (undertime)
                            $undertimeMinutes = 10 + ($pattern % 16);
                            $actualIn = $officialIn->copy()->subMinutes(2);
                            $actualOut = $officialOut->copy()->subMinutes($undertimeMinutes);
                        } else {
                            // 3%: Late AND undertime
                            $lateMinutes = 5 + ($pattern % 10);
                            $undertimeMinutes = 10 + ($pattern % 15);
                            $actualIn = $officialIn->copy()->addMinutes($lateMinutes);
                            $actualOut = $officialOut->copy()->subMinutes($undertimeMinutes);
                        }

                        if ($actualOut->gt($officialOut)) {
                            $overtimeMinutes = (int) $officialOut->diffInMinutes($actualOut);
                        }

                        $totalHours = round($actualIn->diffInMinutes($actualOut) / 60, 2);

                        $status = match (true) {
                            $lateMinutes > 0 && $undertimeMinutes > 0 => 'late_undertime',
                            $lateMinutes > 0 => 'late',
                            $undertimeMinutes > 0 => 'undertime',
                            default => 'present',
                        };

                        $remarks = match ($status) {
                            'late' => "Arrived {$lateMinutes} min late.",
                            'undertime' => "Left {$undertimeMinutes} min early.",
                            'late_undertime' => "Arrived {$lateMinutes} min late and left {$undertimeMinutes} min early.",
                            default => 'Regular attendance.',
                        };

                        $internalSchedule = InternalSchedule::where('faculty_id', $faculty->id)
                            ->where('schedule_id', $schedule->id)
                            ->where('day_of_week', $dayName)
                            ->first();

                        AttendanceRecord::create([
                            'faculty_id' => $faculty->id,
                            'schedule_detail_id' => $detail->id,
                            'internal_schedule_id' => $internalSchedule?->id,
                            'attendance_date' => $dateStr,
                            'day_of_week' => $dayName,
                            'official_time_in' => $officialIn,
                            'official_time_out' => $officialOut,
                            'operational_day_of_week' => $dayName,
                            'operational_time_in' => $internalSchedule
                                ? Carbon::parse($dateStr.' '.Carbon::parse($internalSchedule->device_time_in)->format('H:i:s'))
                                : $officialIn,
                            'operational_time_out' => $internalSchedule
                                ? Carbon::parse($dateStr.' '.Carbon::parse($internalSchedule->device_time_out)->format('H:i:s'))
                                : $officialOut,
                            'actual_time_in' => $actualIn,
                            'actual_time_out' => $actualOut,
                            'late_minutes' => $lateMinutes,
                            'undertime_minutes' => $undertimeMinutes,
                            'overtime_minutes' => $overtimeMinutes,
                            'total_hours_rendered' => $totalHours,
                            'required_hours' => $detail->hours_required,
                            'status' => $status,
                            'remarks' => $remarks,
                            'is_manual_entry' => false,
                            'processed_at' => now(),
                        ]);

                        $totalRecords++;
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->command?->info("  ✓ {$totalRecords} attendance records seeded.");
    }

    /**
     * Generate realistic leave applications and online attendance requests.
     *
     * Each faculty gets 0-2 leave applications and 0-2 online attendance
     * requests, distributed across the semester with realistic reasons.
     */
    private function seedRealisticRequests(): void
    {
        $adminUser = User::where('username', 'admin')->first();
        $hrUser = User::where('username', 'hr_staff')->first();
        $faculties = Faculty::orderBy('id')->get();

        $leaveCount = 0;
        $onlineCount = 0;

        // Realistic leave scenarios — each is a unique, specific event
        $leaveScenarios = [
            ['type' => 'sick_leave',      'days' => 2, 'reason' => 'Fever and upper respiratory tract infection. Doctor advised 2 days bed rest.', 'review' => 'Approved. Please submit medical certificate upon return.'],
            ['type' => 'sick_leave',      'days' => 1, 'reason' => 'Severe migraine; unable to report for duty.', 'review' => 'Approved.'],
            ['type' => 'sick_leave',      'days' => 2, 'reason' => 'Dental extraction and post-operative recovery.', 'review' => 'Approved with medical certificate on file.'],
            ['type' => 'sick_leave',      'days' => 1, 'reason' => 'Severe dysmenorrhea; unable to report for duty.', 'review' => 'Approved.'],
            ['type' => 'sick_leave',      'days' => 2, 'reason' => 'Flu-like symptoms; advised by physician to rest at home.', 'review' => 'Rejected — no medical certificate submitted within 24 hours.'],
            ['type' => 'vacation_leave',  'days' => 2, 'reason' => 'Personal vacation leave. Family reunion in the province.', 'review' => 'Approved.'],
            ['type' => 'vacation_leave',  'days' => 3, 'reason' => 'Planned family vacation during Holy Week extension.', 'review' => 'Approved. Ensure class coverage is arranged.'],
            ['type' => 'vacation_leave',  'days' => 1, 'reason' => 'Personal errands — government transactions (passport renewal).', 'review' => 'Approved.'],
            ['type' => 'vacation_leave',  'days' => 2, 'reason' => 'Out-of-town professional development seminar.', 'review' => 'Approved.'],
            ['type' => 'emergency_leave', 'days' => 1, 'reason' => 'Family emergency — parent hospitalized for chest pain.', 'review' => 'Approved due to family emergency.'],
            ['type' => 'emergency_leave', 'days' => 1, 'reason' => 'Flash flood affected home; needed to supervise emergency repairs.', 'review' => 'Approved as calamity leave.'],
            ['type' => 'emergency_leave', 'days' => 1, 'reason' => 'Death of a close relative; attending funeral rites.', 'review' => 'Approved as bereavement leave. Condolences.'],
            ['type' => 'paternity_leave', 'days' => 7, 'reason' => 'Wife gave birth. Filing paternity leave as per RA 8187.', 'review' => 'Approved. Congratulations!'],
        ];

        // Leave start dates spread across the semester
        $leaveStartDates = [
            '2026-02-16', '2026-02-24', '2026-03-02', '2026-03-09',
            '2026-03-17', '2026-03-23', '2026-04-06', '2026-04-13',
            '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
        ];

        // Realistic online attendance scenarios
        $onlineRemarks = [
            'Conducted online lecture via Google Meet. 42 students attended.',
            'Asynchronous module uploaded to LMS. Activity deadline set for Friday.',
            'Zoom meeting recorded — link shared with students via Google Classroom.',
            'Online quiz and discussion board activity. All students participated.',
            'Synchronous class with screen sharing for laboratory demonstration.',
            'Posted pre-recorded video lecture on Google Classroom. Q&A session scheduled.',
            'Live Q&A session for the midterm review. 38 of 45 students present.',
            'Async activity: students submitted reflection papers via Google Forms.',
        ];

        $reviewRemarks = [
            'Verified. Screenshot matches the class schedule.',
            'Approved. Attendance recorded.',
            'Rejected. Screenshot is unclear / does not match claimed time.',
            'Approved per department verification.',
        ];

        DB::beginTransaction();
        try {
            $this->ensurePlaceholderImage();

            foreach ($faculties as $facultyIndex => $faculty) {
                $schedule = Schedule::where('faculty_id', $faculty->id)->first();

                if (! $schedule) {
                    continue;
                }

                $details = ScheduleDetail::where('schedule_id', $schedule->id)->get();

                // ── Leave applications ──────────────────────────────────────
                // Each faculty gets 1-2 leaves (deterministic assignment)
                $leaveAssignment = ($facultyIndex % 3 === 0) ? 2 : 1;

                if ($leaveAssignment > 0 && $facultyIndex < count($leaveScenarios)) {
                    for ($i = 0; $i < $leaveAssignment && $i < 2; $i++) {
                        $scenarioIndex = ($facultyIndex + $i) % count($leaveScenarios);
                        $scenario = $leaveScenarios[$scenarioIndex];
                        $startDate = $leaveStartDates[($facultyIndex + $i) % count($leaveStartDates)];

                        $status = match ($facultyIndex % 5) {
                            0, 1, 2, 3 => 'approved',
                            default => $i === 0 ? 'pending' : 'rejected',
                        };

                        $reviewer = ($facultyIndex % 2 === 0) ? $hrUser : $adminUser;

                        LeaveApplication::firstOrCreate(
                            [
                                'faculty_id' => $faculty->id,
                                'start_date' => $startDate,
                                'leave_type' => $scenario['type'],
                            ],
                            [
                                'faculty_id' => $faculty->id,
                                'leave_type' => $scenario['type'],
                                'start_date' => $startDate,
                                'end_date' => Carbon::parse($startDate)->addDays($scenario['days'] - 1)->format('Y-m-d'),
                                'total_days' => $scenario['days'],
                                'reason' => $scenario['reason'],
                                'status' => $status,
                                'reviewed_by' => $status !== 'pending' ? $reviewer?->id : null,
                                'reviewed_at' => $status !== 'pending' ? Carbon::parse($startDate)->subDay()->setTime(15, 0) : null,
                                'review_remarks' => $status === 'approved' ? $scenario['review'] : ($status === 'rejected' ? $scenario['review'] : null),
                            ]
                        );

                        $leaveCount++;
                    }
                }

                // ── Online attendance requests ──────────────────────────────
                if ($details->isEmpty()) {
                    continue;
                }

                $onlineAssignment = ($facultyIndex % 4 === 0) ? 2 : 1;
                $screenshotDir = 'online-attendance/'.$faculty->id;
                Storage::disk('public')->makeDirectory($screenshotDir);

                for ($i = 0; $i < $onlineAssignment; $i++) {
                    $detail = $details[$i % $details->count()];
                    $attendanceDate = Carbon::create(2026, 2, 10)->addDays(($facultyIndex + $i) * 7);

                    // Don't create requests beyond the current date
                    if ($attendanceDate->gt(Carbon::now())) {
                        continue;
                    }

                    $classType = ($i % 2 === 0) ? 'synchronous' : 'asynchronous';

                    $timeIn = Carbon::parse($detail->start_time)->format('H:i:s');
                    $timeOut = Carbon::parse($detail->end_time)->format('H:i:s');

                    $ssInPath = $screenshotDir."/screenshot_in_sim_{$facultyIndex}_{$i}.png";
                    $ssOutPath = $screenshotDir."/screenshot_out_sim_{$facultyIndex}_{$i}.png";

                    Storage::disk('public')->copy('online-attendance/placeholder.png', $ssInPath);
                    Storage::disk('public')->copy('online-attendance/placeholder.png', $ssOutPath);

                    $statuses = ['pending', 'approved', 'rejected'];
                    $status = $statuses[($facultyIndex + $i) % 3];

                    $data = [
                        'faculty_id' => $faculty->id,
                        'schedule_detail_id' => $detail->id,
                        'class_type' => $classType,
                        'attendance_date' => $attendanceDate->format('Y-m-d'),
                        'time_in' => $timeIn,
                        'time_out' => $timeOut,
                        'screenshot_in' => $ssInPath,
                        'screenshot_out' => $ssOutPath,
                        'remarks' => $onlineRemarks[($facultyIndex + $i) % count($onlineRemarks)],
                        'status' => $status,
                        'created_at' => $attendanceDate->copy()->setTime(8 + ($i % 3), 30),
                        'updated_at' => $attendanceDate->copy()->setTime(12 + ($i % 5), 15),
                    ];

                    if ($status !== 'pending') {
                        $data['reviewed_by'] = $adminUser?->id;
                        $data['reviewed_at'] = $attendanceDate->copy()->addDay()->setTime(10, 0);
                        $data['review_remarks'] = $reviewRemarks[($facultyIndex + $i) % count($reviewRemarks)];
                    }

                    $existingRequest = OnlineAttendanceRequest::where('faculty_id', $faculty->id)
                        ->where('attendance_date', $data['attendance_date'])
                        ->exists();

                    if (! $existingRequest) {
                        OnlineAttendanceRequest::create($data);
                        $onlineCount++;
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->command?->info("  ✓ {$leaveCount} leave applications seeded.");
        $this->command?->info("  ✓ {$onlineCount} online attendance requests seeded.");
    }

    /**
     * Create a tiny placeholder PNG for screenshot fields.
     */
    private function ensurePlaceholderImage(): void
    {
        $path = 'online-attendance/placeholder.png';

        if (Storage::disk('public')->exists($path)) {
            return;
        }

        Storage::disk('public')->makeDirectory('online-attendance');

        if (extension_loaded('gd')) {
            $img = imagecreatetruecolor(200, 120);
            $bg = imagecolorallocate($img, 240, 240, 240);
            imagefill($img, 0, 0, $bg);

            $textColour = imagecolorallocate($img, 120, 120, 120);
            imagestring($img, 4, 40, 50, 'Screenshot Placeholder', $textColour);

            ob_start();
            imagepng($img);
            $binary = ob_get_clean();
            imagedestroy($img);

            Storage::disk('public')->put($path, $binary);
        } else {
            $png = base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
            );
            Storage::disk('public')->put($path, $png);
        }
    }
}
