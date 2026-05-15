<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class RunBackupCommandJob implements ShouldQueue
{
    use Queueable;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $exitCode = Artisan::call('backup:run', [
            '--disable-notifications' => true,
            '--no-interaction' => true,
        ]);

        if ($exitCode !== 0) {
            $output = trim(Artisan::output());

            Log::error('Queued backup command failed with a non-zero exit code.', [
                'exit_code' => $exitCode,
                'output' => $output,
            ]);

            throw new RuntimeException(
                $output !== ''
                    ? 'Queued backup failed: '.$output
                    : 'Queued backup failed with a non-zero exit code.',
            );
        }
    }
}
