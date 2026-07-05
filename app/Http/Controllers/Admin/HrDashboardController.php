<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DtrRecord;
use App\Models\Faculty;
use App\Models\ImportBatch;
use App\Models\SystemSetting;
use App\Services\HrDtrSyncService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class HrDashboardController extends Controller
{
    public function index(): Response
    {
        $now = Carbon::now();
        $syncDays = HrDtrSyncService::syncDays();
        $pendingDtrs = DtrRecord::query()->where('status', 'pending')->count();
        $lastSync = SystemSetting::query()
            ->where('setting_key', 'hr_dtr_last_sync_at')
            ->value('setting_value');

        return Inertia::render('Admin/HrDashboard', [
            'stats' => [
                [
                    'label' => 'Pending DTRs',
                    'value' => $pendingDtrs,
                    'description' => 'Records waiting for HR validation',
                ],
                [
                    'label' => 'Active Faculty',
                    'value' => Faculty::query()->where('is_active', true)->count(),
                    'description' => 'Included in DTR synchronization',
                ],
                [
                    'label' => 'Unsynced Imports',
                    'value' => ImportBatch::query()->where('status', 'pending')->count(),
                    'description' => 'Biometric batches still pending sync',
                ],
            ],
            'syncSettings' => [
                'days' => $syncDays,
                'isDueToday' => HrDtrSyncService::isDueToday($now),
                'lastSyncAt' => $lastSync,
                'nextSyncLabel' => $this->nextSyncLabel($syncDays, $now),
                'currentPeriod' => $now->format('F Y'),
                'month' => $now->month,
                'year' => $now->year,
            ],
            'pendingDtrs' => DtrRecord::query()
                ->with('faculty:id,first_name,middle_name,last_name,department_id')
                ->where('status', 'pending')
                ->latest('generated_at')
                ->limit(10)
                ->get()
                ->map(fn (DtrRecord $record): array => [
                    'id' => $record->id,
                    'faculty' => $record->faculty?->full_name ?? 'Unknown Faculty',
                    'period' => Carbon::create($record->year, $record->month, 1)->format('F Y'),
                    'lateMinutes' => (int) $record->total_late_minutes,
                    'undertimeMinutes' => (int) $record->total_undertime_minutes,
                    'generatedAt' => $record->generated_at?->format('M j, Y g:i A'),
                ]),
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'sync_days' => ['required', 'array', 'min:1', 'max:4'],
            'sync_days.*' => ['required', 'integer', 'min:1', 'max:31', 'distinct'],
        ]);

        $days = collect($validated['sync_days'])
            ->map(fn (int|string $day): int => (int) $day)
            ->sort()
            ->values()
            ->implode(',');

        SystemSetting::updateOrCreate(
            ['setting_key' => 'hr_dtr_sync_days'],
            [
                'setting_value' => $days,
                'setting_type' => 'csv_integer',
                'description' => 'Month days when HR pending DTR records should be synchronized automatically.',
                'is_editable' => true,
                'updated_by' => $request->user('admin')?->id,
            ]
        );

        return back()->with('success', 'HR DTR sync settings updated.');
    }

    public function sync(Request $request, HrDtrSyncService $syncService): RedirectResponse
    {
        $validated = $request->validate([
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020', 'max:2100'],
            'source' => ['nullable', Rule::in(['manual'])],
        ]);

        $summary = DB::transaction(fn (): array => $syncService->syncPendingDtrs(
            $validated['month'] ?? null,
            $validated['year'] ?? null,
        ));

        return back()->with(
            'success',
            "HR DTR sync completed: {$summary['created']} created, {$summary['updated']} updated, {$summary['skipped']} skipped."
        );
    }

    /**
     * @param  array<int, int>  $syncDays
     */
    private function nextSyncLabel(array $syncDays, Carbon $now): string
    {
        foreach ($syncDays as $day) {
            if ($day >= $now->day) {
                return $now->copy()->day(min($day, $now->daysInMonth))->format('F j, Y');
            }
        }

        return $now->copy()->addMonthNoOverflow()->day(min($syncDays[0] ?? 15, $now->copy()->addMonthNoOverflow()->daysInMonth))->format('F j, Y');
    }
}
