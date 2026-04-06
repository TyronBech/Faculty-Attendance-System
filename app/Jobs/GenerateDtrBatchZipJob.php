<?php

namespace App\Jobs;

use App\Http\Controllers\Admin\AdminDtrExportController;
use App\Models\AttendanceAdjustment;
use App\Models\Faculty;
use App\Services\AttendanceToDtrService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Spatie\LaravelPdf\Facades\Pdf;
use ZipArchive;

class GenerateDtrBatchZipJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public array $facultyIds,
        public int $month,
        public int $year,
        public string $token,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(AttendanceToDtrService $service): void
    {
        $faculties = Faculty::query()
            ->with('department:id,name')
            ->whereIn('id', $this->facultyIds)
            ->get()
            ->keyBy('id');

        Storage::disk('local')->makeDirectory('dtr-exports');
        $batchDirectory = "dtr-exports/{$this->token}";
        Storage::disk('local')->makeDirectory($batchDirectory);

        $controller = new AdminDtrExportController;

        foreach ($this->facultyIds as $facultyId) {
            $faculty = $faculties->get($facultyId);

            if (! $faculty) {
                continue;
            }

            $conversion = $service->convertToDtr($faculty->id, $this->month, $this->year);
            $attendance = $conversion['attendance'] ?? [];
            $summary = $conversion['summary'] ?? [];

            $rows = $controller->buildRows($attendance, $this->month, $this->year);

            $manualEntries = AttendanceAdjustment::query()
                ->whereHas('attendanceRecord', function ($query) use ($faculty) {
                    $query->where('faculty_id', $faculty->id)
                        ->whereYear('attendance_date', $this->year)
                        ->whereMonth('attendance_date', $this->month);
                })
                ->with('attendanceRecord:id,attendance_date')
                ->orderBy('id')
                ->get()
                ->map(fn (AttendanceAdjustment $adj) => [
                    'date' => optional($adj->attendanceRecord?->attendance_date)->format('M d, Y') ?? 'N/A',
                    'reason' => (string) $adj->reason,
                ])
                ->values()
                ->all();

            $periodLabel = Carbon::create($this->year, $this->month, 1)->format('F Y');

            $safeName = str_replace(' ', '_', strtolower(trim($faculty->full_name)));
            $fileName = "dtr_{$safeName}_{$this->year}_{$this->month}.pdf";
            $outputPath = Storage::disk('local')->path("{$batchDirectory}/{$fileName}");

            Pdf::view('pdf.monthly-dtr', [
                'faculty' => $faculty,
                'rows' => $rows,
                'summary' => $summary,
                'manualEntries' => $manualEntries,
                'periodLabel' => $periodLabel,
                'generatedAt' => now()->format('l, F d, Y'),
            ])
                ->driver('dompdf')
                ->paperSize(105, 297, 'mm')
                ->portrait()
                ->margins(0, 0, 0, 0)
                ->save($outputPath);
        }

        $zipPath = Storage::disk('local')->path("dtr-exports/{$this->token}.zip");
        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return;
        }

        foreach (Storage::disk('local')->files($batchDirectory) as $file) {
            $zip->addFile(Storage::disk('local')->path($file), basename($file));
        }

        $zip->close();

        Storage::disk('local')->deleteDirectory($batchDirectory);
    }
}
