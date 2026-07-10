<?php

namespace Database\Seeders;

use App\Models\DtrRecord;
use App\Models\Faculty;
use App\Models\HrDtrStatus;
use App\Services\AttendanceToDtrService;
use App\Services\HrDtrSyncService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LastMonthHrDtrSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $periodMonth = Carbon::now()->subMonthNoOverflow()->startOfMonth();
        $daysInMonth = $periodMonth->daysInMonth;
        $cutoffDays = collect(HrDtrSyncService::syncDays())
            ->map(fn (int $day): int => min($day, $daysInMonth))
            ->unique()
            ->sort()
            ->values();

        $dtrService = app(AttendanceToDtrService::class);

        DB::transaction(function () use ($periodMonth, $cutoffDays, $dtrService): void {
            Faculty::query()
                ->where('is_active', true)
                ->orderBy('id')
                ->each(function (Faculty $faculty) use ($periodMonth, $cutoffDays, $dtrService): void {
                    $dtrRecord = DtrRecord::firstOrCreate(
                        [
                            'faculty_id' => $faculty->id,
                            'month' => $periodMonth->month,
                            'year' => $periodMonth->year,
                        ],
                        [
                            'total_days_present' => 0,
                            'total_days_absent' => 0,
                            'total_days_late' => 0,
                            'total_late_minutes' => 0,
                            'total_undertime_minutes' => 0,
                            'total_hours_rendered' => 0,
                            'total_hours_required' => 0,
                            'status' => 'pending',
                            'generated_at' => now(),
                        ]
                    );

                    $previousCutoffDay = 0;

                    foreach ($cutoffDays as $cutoffDay) {
                        $periodStart = $periodMonth->copy()->day($previousCutoffDay + 1);
                        $periodEnd = $periodMonth->copy()->day($cutoffDay);
                        $summary = $dtrService->convertToDtr(
                            (int) $faculty->id,
                            (int) $periodMonth->month,
                            (int) $periodMonth->year,
                            (int) $periodStart->day,
                            (int) $periodEnd->day,
                        )['summary'] ?? [];

                        HrDtrStatus::updateOrCreate(
                            [
                                'dtr_record_id' => $dtrRecord->id,
                                'period_start' => $periodStart->toDateString(),
                                'period_end' => $periodEnd->toDateString(),
                            ],
                            [
                                'status' => 'pending',
                                'reviewed_by' => null,
                                'reviewed_at' => null,
                            ]
                        );

                        $dtrRecord->forceFill([
                            'total_days_present' => (int) ($summary['daysPresent'] ?? 0),
                            'total_days_absent' => (int) ($summary['daysAbsent'] ?? 0),
                            'total_days_late' => (int) ($summary['timesLate'] ?? 0),
                            'total_late_minutes' => (int) ($summary['totalLateMinutes'] ?? 0),
                            'total_undertime_minutes' => (int) ($summary['totalUndertimeMinutes'] ?? 0),
                            'total_hours_rendered' => (float) ($summary['totalHoursRendered'] ?? 0),
                            'total_hours_required' => (float) ($summary['totalRequiredHours'] ?? 0),
                            'status' => 'pending',
                            'generated_at' => now(),
                        ])->save();

                        $previousCutoffDay = (int) $cutoffDay;
                    }
                });
        });
    }
}
