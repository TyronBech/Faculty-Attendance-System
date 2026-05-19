<?php

namespace App\Console\Commands;

use App\Services\FlssApiSyncService;
use Illuminate\Console\Command;

class FlssSyncCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'flss:sync {--check-only : Only verify API connectivity without syncing}';

    /**
     * @var string
     */
    protected $description = 'Fetch data from FLSS API and sync rooms, faculty, and schedules to the database. Aborts safely if the API is unreachable.';

    public function handle(FlssApiSyncService $syncService): int
    {
        if ($this->option('check-only')) {
            return $this->handleHealthCheck($syncService);
        }

        $this->info('╔══════════════════════════════════════════════════╗');
        $this->info('║          FLSS API → Database Sync                ║');
        $this->info('╚══════════════════════════════════════════════════╝');
        $this->newLine();

        $this->info('⏳ Checking API connectivity…');

        if (! $syncService->isApiReachable()) {
            $this->error('✗ FLSS API is unreachable. Sync CANCELLED to protect data integrity.');
            $this->warn('  No changes were made to the database.');

            return self::FAILURE;
        }

        $this->info('✓ API is reachable.');
        $this->info('⏳ Verifying schedule data is published…');

        if (! $syncService->isScheduleDataPublished()) {
            $this->error('✗ FLSS schedule data is NOT published. Sync CANCELLED.');
            $this->warn('  The API returned a non-"published" status. Only published data can be synced.');
            $this->warn('  No changes were made to the database.');

            return self::FAILURE;
        }

        $this->info('✓ Schedule data is published. Starting synchronization…');
        $this->newLine();

        $summary = $syncService->syncAll();

        if ($summary['aborted']) {
            $this->error('✗ Sync was aborted due to errors:');
            foreach ($summary['errors'] as $error) {
                $this->warn("  • {$error}");
            }
            $this->warn('  No changes were committed to the database.');

            return self::FAILURE;
        }

        $this->info('✓ Sync completed successfully!');
        $this->newLine();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Rooms synced', $summary['rooms']],
                ['Faculty created', $summary['faculty_created']],
                ['Faculty updated', $summary['faculty_updated']],
                ['Schedules created', $summary['schedules_created']],
                ['Schedules updated', $summary['schedules_updated']],
                ['Schedule details created', $summary['details_created']],
                ['Schedule details updated', $summary['details_updated']],
                ['Temporary schedules synced', $summary['temporary_synced']],
            ]
        );

        if (! empty($summary['errors'])) {
            $this->newLine();
            $this->warn('⚠ Non-fatal warnings:');
            foreach ($summary['errors'] as $error) {
                $this->warn("  • {$error}");
            }
        }

        return self::SUCCESS;
    }

    private function handleHealthCheck(FlssApiSyncService $syncService): int
    {
        $this->info('Checking FLSS API connectivity…');

        if ($syncService->isApiReachable()) {
            $this->info('✓ FLSS API is reachable and responding.');

            return self::SUCCESS;
        }

        $this->error('✗ FLSS API is NOT reachable.');

        return self::FAILURE;
    }
}
