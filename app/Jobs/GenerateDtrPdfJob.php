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

class GenerateDtrPdfJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(
        public int $facultyId,
        public int $month,
        public int $year,
        public string $token,
        public string $fileName,
    ) {}

    public function handle(AttendanceToDtrService $service): void
    {
        $faculty = Faculty::query()
            ->with('department:id,name')
            ->findOrFail($this->facultyId);

        $conversion = $service->convertToDtr($faculty->id, $this->month, $this->year);
        $attendance = $conversion['attendance'] ?? [];
        $summary = $conversion['summary'] ?? [];

        $controller = new AdminDtrExportController;
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

        // Ensure the export directory exists
        Storage::disk('local')->makeDirectory('dtr-exports');

        $outputPath = Storage::disk('local')->path("dtr-exports/{$this->token}.pdf");

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
}
