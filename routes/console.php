<?php

use App\Models\OnlineAttendanceRequest;
use App\Services\HrDtrSyncService;
use App\Services\OnlineAttendanceSyncService;
use App\Services\TemporaryFacultyScheduleSyncService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('online-attendance:sync-approved', function () {
    $syncService = app(OnlineAttendanceSyncService::class);

    $updated = 0;
    $errors = 0;

    OnlineAttendanceRequest::query()
        ->where('status', 'approved')
        ->orderBy('id')
        ->chunkById(100, function ($requests) use ($syncService, &$updated, &$errors) {
            foreach ($requests as $request) {
                try {
                    DB::transaction(function () use ($syncService, $request) {
                        $fresh = OnlineAttendanceRequest::whereKey($request->id)
                            ->lockForUpdate()
                            ->first();

                        if ($fresh && $fresh->status === 'approved') {
                            $syncService->syncApprovedRequest($fresh);
                        }
                    });
                    $updated++;
                } catch (RuntimeException $e) {
                    $errors++;
                    $this->warn("Skipped request #{$request->id}: {$e->getMessage()}");
                }
            }
        });

    $this->info("Synced approved requests: {$updated}");
    $this->info("Skipped with issues: {$errors}");
})->purpose('Sync approved online attendance requests into attendance_records');

Artisan::command('flss:sync-temporary-schedules {--per-page=500} {--url=}', function (TemporaryFacultyScheduleSyncService $syncService) {
    $perPage = max(1, (int) $this->option('per-page'));
    $url = trim((string) $this->option('url')) ?: null;
    $summary = $syncService->syncFromApi(['per_page' => $perPage], $url);

    $this->info("Temporary schedules processed: {$summary['processed']}");
    $this->info("Created: {$summary['created']}");
    $this->info("Updated: {$summary['updated']}");
    $this->info("Unmatched faculty codes: {$summary['unmatched_faculty']}");
    $this->info("Skipped rows: {$summary['skipped']}");
})->purpose('Sync FLSS temporary faculty schedules and match them to local faculty by faculty_code')
    ->daily()
    ->at('1:00');

Artisan::command('hr:dtr-sync-pending {--force}', function (HrDtrSyncService $syncService) {
    if (! $this->option('force') && ! HrDtrSyncService::isDueToday()) {
        $this->info('HR DTR sync skipped. Today is not one of the configured sync days.');

        return;
    }

    $summary = $syncService->syncPendingDtrs();

    $this->info("HR pending DTR sync complete for {$summary['month']}/{$summary['year']}.");
    $this->info("Created: {$summary['created']}");
    $this->info("Updated: {$summary['updated']}");
    $this->info("Skipped: {$summary['skipped']}");
})->purpose('Create or refresh pending DTR records when today matches HR sync settings');

Schedule::command('hr:dtr-sync-pending')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/hr-dtr-sync.log'));

Schedule::command('flss:sync')
    ->dailyAt('01:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/flss-sync.log'));

Schedule::command('backup:clean --disable-notifications')
    ->daily()
    ->at('01:00');

Schedule::command('backup:run --disable-notifications')
    ->daily()
    ->at('01:30');
