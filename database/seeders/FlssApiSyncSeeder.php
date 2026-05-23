<?php

namespace Database\Seeders;

use App\Services\FlssApiSyncService;
use Illuminate\Database\Seeder;

class FlssApiSyncSeeder extends Seeder
{
    /**
     * Option 1 — API-only sync.
     *
     * Fetches rooms, faculty, and schedules from the FLSS API and
     * writes them to the database. No simulation data is generated.
     *
     * Safety: if the API is unreachable the seeder aborts without
     * modifying any data.
     *
     * Usage:
     *   php artisan db:seed --class=FlssApiSyncSeeder
     */
    public function run(FlssApiSyncService $syncService): void
    {
        $this->command?->info('╔══════════════════════════════════════════════════╗');
        $this->command?->info('║   Option 1 — FLSS API Sync Only (no simulation) ║');
        $this->command?->info('╚══════════════════════════════════════════════════╝');
        $this->command?->newLine();

        $this->command?->info('⏳ Verifying FLSS API connectivity…');

        if (! $syncService->isApiReachable()) {
            $this->command?->error('✗ FLSS API is unreachable. Seeder ABORTED.');
            $this->command?->warn('  No changes were made to the database.');

            return;
        }

        $this->command?->info('✓ API reachable. Running sync…');

        // Ensure prerequisite data exists (roles, departments, users)
        $this->call([
            RolePermissionSeeder::class,
            DepartmentSeeder::class,
            UserSeeder::class,
        ]);

        $summary = $syncService->syncAll();

        if ($summary['aborted']) {
            $this->command?->error('✗ Sync aborted:');
            foreach ($summary['errors'] as $error) {
                $this->command?->warn("  • {$error}");
            }

            return;
        }

        $this->command?->newLine();
        $this->command?->info('✓ API sync completed!');
        $this->command?->table(
            ['Metric', 'Count'],
            [
                ['Rooms', $summary['rooms']],
                ['Faculty created', $summary['faculty_created']],
                ['Faculty updated', $summary['faculty_updated']],
                ['Schedules created', $summary['schedules_created']],
                ['Schedules updated', $summary['schedules_updated']],
                ['Schedule details created', $summary['details_created']],
                ['Schedule details updated', $summary['details_updated']],
                ['Temporary schedules', $summary['temporary_synced']],
            ]
        );
    }
}
