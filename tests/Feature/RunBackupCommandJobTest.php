<?php

namespace Tests\Feature;

use App\Jobs\RunBackupCommandJob;
use Illuminate\Support\Facades\Artisan;
use RuntimeException;
use Tests\TestCase;

class RunBackupCommandJobTest extends TestCase
{
    public function test_job_runs_backup_command_successfully(): void
    {
        Artisan::shouldReceive('call')
            ->once()
            ->with('backup:run', [
                '--disable-notifications' => true,
                '--no-interaction' => true,
            ])
            ->andReturn(0);

        Artisan::shouldReceive('output')
            ->never();

        (new RunBackupCommandJob)->handle();

        $this->assertTrue(true);
    }

    public function test_job_throws_when_backup_command_fails(): void
    {
        Artisan::shouldReceive('call')
            ->once()
            ->with('backup:run', [
                '--disable-notifications' => true,
                '--no-interaction' => true,
            ])
            ->andReturn(1);

        Artisan::shouldReceive('output')
            ->once()
            ->andReturn('mysqldump: command not found');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Queued backup failed: mysqldump: command not found');

        (new RunBackupCommandJob)->handle();
    }
}
