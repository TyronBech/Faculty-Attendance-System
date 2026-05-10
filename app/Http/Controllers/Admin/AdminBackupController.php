<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RunBackupCommandJob;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AdminBackupController extends Controller
{
    public function index(Request $request): Response
    {
        $perPage = max(5, min((int) $request->query('per_page', 10), 50));
        $page = max(1, (int) $request->query('page', 1));

        $backupCollection = $this->backupFiles()
            ->map(function (array $backup): array {
                return [
                    'id' => $backup['id'],
                    'name' => $backup['name'],
                    'directory' => $backup['directory'],
                    'size_bytes' => $backup['size_bytes'],
                    'size_human' => $backup['size_human'],
                    'created_at' => $backup['created_at'],
                    'download_url' => route('admin.backups.download', $backup['id']),
                ];
            })
            ->values();

        $backups = $this->paginateBackups($backupCollection, $page, $perPage, $request)->toArray();

        return Inertia::render('Admin/Backups', [
            'backups' => $backups,
            'filters' => [
                'per_page' => $perPage,
            ],
            'schedule' => [
                'cleanup' => 'Daily at 1:00 AM',
                'backup' => 'Daily at 1:30 AM',
            ],
        ]);
    }

    public function store(): RedirectResponse
    {
        try {
            RunBackupCommandJob::dispatch();
        } catch (Throwable $exception) {
            Log::error('Backup job dispatch threw an exception.', [
                'message' => $exception->getMessage(),
            ]);

            return back()->with('error', 'Backup failed: '.$exception->getMessage());
        }

        return to_route('admin.backups.index')->with(
            'success',
            'Backup request queued successfully. Refresh this page after a short while to see the new backup file.',
        );
    }

    public function download(string $backup): StreamedResponse
    {
        $backupFile = $this->backupFiles()->firstWhere('id', $backup);

        abort_if($backupFile === null, 404);

        return Storage::disk('backups')->download(
            $backupFile['path'],
            $backupFile['name'],
        );
    }

    /**
     * @return Collection<int, array{
     *     id: string,
     *     path: string,
     *     name: string,
     *     directory: string,
     *     size_bytes: int,
     *     size_human: string,
     *     created_at: string,
     *     timestamp: int
     * }>
     */
    private function backupFiles(): Collection
    {
        $disk = Storage::disk('backups');

        return collect($disk->allFiles())
            ->filter(fn (string $path): bool => str_ends_with(strtolower($path), '.zip'))
            ->map(function (string $path) use ($disk): array {
                $timestamp = $disk->lastModified($path);
                $directory = dirname($path);

                return [
                    'id' => sha1($path),
                    'path' => $path,
                    'name' => basename($path),
                    'directory' => $directory === '.' ? '' : $directory,
                    'size_bytes' => $disk->size($path),
                    'size_human' => $this->formatBytes($disk->size($path)),
                    'created_at' => Carbon::createFromTimestamp($timestamp)
                        ->timezone(config('app.timezone'))
                        ->format('M d, Y h:i A'),
                    'timestamp' => $timestamp,
                ];
            })
            ->sortByDesc('timestamp')
            ->values();
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes.' B';
        }

        $units = ['KB', 'MB', 'GB', 'TB'];
        $value = $bytes / 1024;
        $unitIndex = 0;

        while ($value >= 1024 && $unitIndex < count($units) - 1) {
            $value /= 1024;
            $unitIndex++;
        }

        return number_format($value, 2).' '.$units[$unitIndex];
    }

    /**
     * @param  Collection<int, array{
     *     id: string,
     *     name: string,
     *     directory: string,
     *     size_bytes: int,
     *     size_human: string,
     *     created_at: string,
     *     download_url: string
     * }>  $backups
     */
    private function paginateBackups(
        Collection $backups,
        int $page,
        int $perPage,
        Request $request,
    ): LengthAwarePaginator {
        return new LengthAwarePaginator(
            $backups->forPage($page, $perPage)->values(),
            $backups->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ],
        );
    }
}
