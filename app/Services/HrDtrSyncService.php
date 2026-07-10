<?php

namespace App\Services;

use App\Models\DtrRecord;
use App\Models\Faculty;
use App\Models\HrDtrStatus;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class HrDtrSyncService
{
    public function __construct(
        private readonly AttendanceToDtrService $attendanceToDtrService,
    ) {}

    /**
     * @return array{
     *     month: int,
     *     year: int,
     *     period_start: string|null,
     *     period_end: string|null,
     *     processed: int,
     *     created: int,
     *     updated: int,
     *     skipped: int
     * }
     */
    public function syncPendingDtrs(?int $month = null, ?int $year = null): array
    {
        $now = Carbon::now();
        $targetMonth = $month ?? $now->month;
        $targetYear = $year ?? $now->year;
        $period = $this->resolvedRenderedPeriod($targetMonth, $targetYear, $now);

        $summary = [
            'month' => $targetMonth,
            'year' => $targetYear,
            'period_start' => $period?->get('start')?->toDateString(),
            'period_end' => $period?->get('end')?->toDateString(),
            'processed' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
        ];

        if (! $period) {
            return $summary;
        }

        $periodStart = $period->get('start');
        $periodEnd = $period->get('end');
        $startDay = (int) $periodStart->day;
        $endDay = (int) $periodEnd->day;

        Faculty::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->chunkById(100, function (Collection $faculties) use (&$summary, $targetMonth, $targetYear, $periodStart, $periodEnd, $startDay, $endDay): void {
                foreach ($faculties as $faculty) {
                    $existingRecord = DtrRecord::query()
                        ->where('faculty_id', $faculty->id)
                        ->where('month', $targetMonth)
                        ->where('year', $targetYear)
                        ->first();

                    $existingHrStatus = $existingRecord?->hrStatuses()
                        ->whereDate('period_start', $periodStart->toDateString())
                        ->whereDate('period_end', $periodEnd->toDateString())
                        ->first();

                    if (in_array($existingHrStatus?->status, ['approved', 'rejected'], true)) {
                        $summary['skipped']++;

                        continue;
                    }

                    $conversion = $this->attendanceToDtrService->convertToDtr($faculty->id, $targetMonth, $targetYear, $startDay, $endDay);
                    $dtrSummary = $conversion['summary'] ?? [];

                    $dtrRecord = DtrRecord::updateOrCreate(
                        [
                            'faculty_id' => $faculty->id,
                            'month' => $targetMonth,
                            'year' => $targetYear,
                        ],
                        [
                            'total_days_present' => (int) ($dtrSummary['daysPresent'] ?? 0),
                            'total_days_absent' => (int) ($dtrSummary['daysAbsent'] ?? 0),
                            'total_days_late' => (int) ($dtrSummary['timesLate'] ?? 0),
                            'total_late_minutes' => (int) ($dtrSummary['totalLateMinutes'] ?? 0),
                            'total_undertime_minutes' => (int) ($dtrSummary['totalUndertimeMinutes'] ?? 0),
                            'total_hours_rendered' => (float) ($dtrSummary['totalHoursRendered'] ?? 0),
                            'total_hours_required' => (float) ($dtrSummary['totalRequiredHours'] ?? 0),
                            'status' => 'pending',
                            'generated_at' => now(),
                        ]
                    );

                    HrDtrStatus::firstOrCreate(
                        [
                            'dtr_record_id' => $dtrRecord->id,
                            'period_start' => $periodStart->toDateString(),
                            'period_end' => $periodEnd->toDateString(),
                        ],
                        ['status' => 'pending']
                    );

                    $summary[$existingRecord ? 'updated' : 'created']++;
                    $summary['processed']++;
                }
            });

        SystemSetting::updateOrCreate(
            ['setting_key' => 'hr_dtr_last_sync_at'],
            [
                'setting_value' => now()->toDateTimeString(),
                'setting_type' => 'datetime',
                'description' => 'Last time HR pending DTR records were synchronized.',
                'is_editable' => false,
            ]
        );

        return $summary;
    }

    /**
     * @return Collection{start: Carbon, end: Carbon}|null
     */
    private function resolvedRenderedPeriod(int $month, int $year, Carbon $now): ?Collection
    {
        $periodMonth = Carbon::create($year, $month, 1);
        $daysInMonth = $periodMonth->daysInMonth;
        $cutoffDays = collect(self::syncDays())
            ->map(fn (int $day): int => min($day, $daysInMonth))
            ->unique()
            ->sort()
            ->values();

        $comparisonDate = $periodMonth->isSameMonth($now)
            ? min($now->day, $daysInMonth)
            : ($periodMonth->lessThan($now->copy()->startOfMonth()) ? $daysInMonth : 0);

        $eligibleCutoffs = $cutoffDays->filter(fn (int $day): bool => $day <= $comparisonDate)->values();
        $cutoffDay = $eligibleCutoffs->last();

        if (! $cutoffDay) {
            return null;
        }

        $cutoffIndex = $eligibleCutoffs->count() - 1;
        $previousCutoffDay = $cutoffIndex > 0 ? (int) $eligibleCutoffs[$cutoffIndex - 1] : 0;

        return collect([
            'start' => Carbon::create($year, $month, $previousCutoffDay + 1)->startOfDay(),
            'end' => Carbon::create($year, $month, (int) $cutoffDay)->endOfDay(),
        ]);
    }

    /**
     * @return array<int, int>
     */
    public static function syncDays(): array
    {
        $value = (string) SystemSetting::query()
            ->where('setting_key', 'hr_dtr_sync_days')
            ->value('setting_value');

        $days = collect(explode(',', $value !== '' ? $value : '15,30'))
            ->map(fn (string $day): int => (int) trim($day))
            ->filter(fn (int $day): bool => $day >= 1 && $day <= 31)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $days ?: [15, 30];
    }

    public static function isDueToday(?Carbon $date = null): bool
    {
        return in_array(($date ?? Carbon::now())->day, self::syncDays(), true);
    }
}
