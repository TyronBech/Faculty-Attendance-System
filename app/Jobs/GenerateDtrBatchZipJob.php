<?php

namespace App\Jobs;

use App\Http\Controllers\Admin\AdminDtrExportController;
use App\Models\AttendanceAdjustment;
use App\Models\Faculty;
use App\Services\AttendanceToDtrService;
use App\Support\MonthlyDtrBarcode;
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

            $payload = $controller->buildPdfPayload($service, $faculty->id, $this->month, $this->year);
            $rows = $payload['rows'] ?? [];
            $summary = $payload['summary'] ?? [];

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

            $printedAt = now();
            $barcode = MonthlyDtrBarcode::build($faculty, $printedAt);

            Pdf::view('pdf.monthly-dtr', [
                'faculty' => $faculty,
                'rows' => $rows,
                'summary' => $summary,
                'manualEntries' => $manualEntries,
                'periodLabel' => $periodLabel,
                'generatedAt' => $printedAt->format('l, F d, Y'),
                'barcodeImg' => $barcode['img'],
                'barcodeValue' => $barcode['value'],
            ])
                ->driver('dompdf')
                ->paperSize(210, 297, 'mm')
                ->portrait()
                ->margins(0, 0, 0, 0, 'mm')
                ->save($outputPath);
        }

        $finalRelativePath = "dtr-exports/{$this->token}.zip";
        $temporaryRelativePath = "dtr-exports/{$this->token}.tmp.zip";
        $zipPath = Storage::disk('local')->path($temporaryRelativePath);
        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return;
        }

        foreach (Storage::disk('local')->files($batchDirectory) as $file) {
            $zip->addFile(Storage::disk('local')->path($file), basename($file));
        }

        $zip->close();

        Storage::disk('local')->move($temporaryRelativePath, $finalRelativePath);
        Storage::disk('local')->deleteDirectory($batchDirectory);
    }
}
