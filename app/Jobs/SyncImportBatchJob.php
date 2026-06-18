<?php

namespace App\Jobs;

use App\Http\Controllers\Admin\AdminAttendanceImportController;
use App\Models\ImportBatch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncImportBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $batchId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $batch = ImportBatch::findOrFail($this->batchId);

        app(AdminAttendanceImportController::class)->sync($batch);
    }
}
