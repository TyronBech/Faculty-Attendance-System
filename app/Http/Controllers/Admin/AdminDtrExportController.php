<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateDtrBatchZipJob;
use App\Jobs\GenerateDtrPdfJob;
use App\Models\Faculty;
use App\Services\AttendanceToDtrService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminDtrExportController extends Controller
{
    /**
     * Return a JSON preview of the DTR data (rows + summary) for the modal.
     */
    public function preview(Request $request, AttendanceToDtrService $service): JsonResponse
    {
        $validated = $request->validate([
            'faculty_id' => ['required', 'integer', 'exists:faculties,id'],
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $faculty = Faculty::query()
            ->with('department:id,name')
            ->findOrFail($validated['faculty_id']);

        $month = (int) $validated['month'];
        $year = (int) $validated['year'];

        $conversion = $service->convertToDtr($faculty->id, $month, $year);
        $attendance = $conversion['attendance'] ?? [];
        $summary = $conversion['summary'] ?? [];

        $rows = $this->buildRows($attendance, $month, $year);

        $periodLabel = Carbon::create($year, $month, 1)->format('F Y');

        return response()->json([
            'faculty' => [
                'id' => $faculty->id,
                'full_name' => $faculty->full_name,
                'department' => $faculty->department?->name ?? 'N/A',
            ],
            'periodLabel' => $periodLabel,
            'rows' => $rows,
            'summary' => $summary,
        ]);
    }

    /**
     * Return a JSON preview for multiple faculty (rows + summary per faculty).
     */
    public function previewBatch(Request $request, AttendanceToDtrService $service): JsonResponse
    {
        $validated = $request->validate([
            'faculty_ids' => ['required', 'array', 'min:1'],
            'faculty_ids.*' => ['required', 'integer', 'exists:faculties,id'],
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $month = (int) $validated['month'];
        $year = (int) $validated['year'];

        $faculties = Faculty::query()
            ->with('department:id,name')
            ->whereIn('id', $validated['faculty_ids'])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        $periodLabel = Carbon::create($year, $month, 1)->format('F Y');

        $previews = $faculties->map(function (Faculty $faculty) use ($service, $month, $year) {
            $conversion = $service->convertToDtr($faculty->id, $month, $year);
            $attendance = $conversion['attendance'] ?? [];
            $summary = $conversion['summary'] ?? [];

            $rows = $this->buildRows($attendance, $month, $year);

            return [
                'faculty' => [
                    'id' => $faculty->id,
                    'full_name' => $faculty->full_name,
                    'department' => $faculty->department?->name ?? 'N/A',
                ],
                'rows' => $rows,
                'summary' => $summary,
            ];
        })->values();

        return response()->json([
            'periodLabel' => $periodLabel,
            'previews' => $previews,
        ]);
    }

    /**
     * Dispatch a background job to generate the PDF, return a token to poll.
     */
    public function dispatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'faculty_id' => ['required', 'integer', 'exists:faculties,id'],
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $faculty = Faculty::query()
            ->with('department:id,name')
            ->findOrFail($validated['faculty_id']);

        $token = Str::uuid()->toString();
        $safeName = str_replace(' ', '_', strtolower(trim($faculty->full_name)));
        $fileName = "dtr_{$safeName}_{$validated['year']}_{$validated['month']}.pdf";

        GenerateDtrPdfJob::dispatch(
            (int) $validated['faculty_id'],
            (int) $validated['month'],
            (int) $validated['year'],
            $token,
            $fileName,
        );

        return response()->json([
            'token' => $token,
            'fileName' => $fileName,
            'message' => 'PDF generation started.',
        ]);
    }

    /**
     * Dispatch a background job to generate a zip of multiple DTR PDFs.
     */
    public function dispatchBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'faculty_ids' => ['required', 'array', 'min:1'],
            'faculty_ids.*' => ['required', 'integer', 'exists:faculties,id'],
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $token = Str::uuid()->toString();
        $fileName = "dtr_export_{$validated['year']}_{$validated['month']}.zip";

        GenerateDtrBatchZipJob::dispatch(
            array_map(fn ($id) => (int) $id, $validated['faculty_ids']),
            (int) $validated['month'],
            (int) $validated['year'],
            $token,
        );

        return response()->json([
            'token' => $token,
            'fileName' => $fileName,
            'message' => 'Batch PDF generation started.',
        ]);
    }

    /**
     * Check if the PDF has been generated yet.
     */
    public function status(Request $request): JsonResponse
    {
        $token = $request->query('token');
        $extension = $request->query('extension', 'pdf');
        $extension = in_array($extension, ['pdf', 'zip'], true) ? $extension : 'pdf';

        if (! $token) {
            return response()->json(['ready' => false], 422);
        }

        $path = "dtr-exports/{$token}.{$extension}";

        return response()->json([
            'ready' => Storage::disk('local')->exists($path),
        ]);
    }

    /**
     * Serve the generated PDF file for download, then clean up.
     */
    public function downloadFile(Request $request): BinaryFileResponse|StreamedResponse|JsonResponse
    {
        $token = $request->query('token');
        $fileName = $request->query('fileName', 'dtr.pdf');
        $extension = $request->query('extension');

        if (! $token) {
            return response()->json(['error' => 'Missing token.'], 422);
        }

        $extension = $extension
            ?? (strtolower(pathinfo($fileName, PATHINFO_EXTENSION)) ?: 'pdf');
        $extension = in_array($extension, ['pdf', 'zip'], true) ? $extension : 'pdf';
        $path = "dtr-exports/{$token}.{$extension}";

        if (! Storage::disk('local')->exists($path)) {
            return response()->json(['error' => 'File not ready yet.'], 404);
        }

        $fullPath = Storage::disk('local')->path($path);
        $size = Storage::disk('local')->size($path);

        // Prevent stray buffered output (e.g. a leading newline) from corrupting binary files.
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        return response()->streamDownload(function () use ($fullPath): void {
            $stream = fopen($fullPath, 'rb');

            if ($stream === false) {
                return;
            }

            fpassthru($stream);
            fclose($stream);
        }, $fileName, [
            'Content-Type' => $extension === 'zip' ? 'application/zip' : 'application/pdf',
            'Content-Transfer-Encoding' => 'binary',
            'Content-Length' => (string) $size,
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    /* ──────────────────────────────────────────────────────────────
       Helpers
       ────────────────────────────────────────────────────────────── */

    public function buildPdfPayload(AttendanceToDtrService $service, int $facultyId, int $month, int $year): array
    {
        $conversion = $service->convertToDtr($facultyId, $month, $year);
        $attendance = $conversion['attendance'] ?? [];
        $summary = $conversion['summary'] ?? [];

        return [
            'rows' => $this->buildRows($attendance, $month, $year),
            'summary' => $summary,
        ];
    }

    public function buildRows(array $attendance, int $month, int $year): array
    {
        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
        $rows = [];

        for ($day = 1; $day <= $daysInMonth; $day++) {
            $dayData = $attendance[$day] ?? ['status' => 'none', 'records' => [], 'holidays' => []];
            $records = $dayData['records'] ?? [];
            $officialDate = Carbon::create($year, $month, $day);

            $sortedRecords = collect($records)
                ->sortBy(function ($record) {
                    $rawOfficial = $record?->raw_official_time_in ?? $record?->official_time_in;

                    return $rawOfficial ? Carbon::parse($rawOfficial)->timestamp : PHP_INT_MAX;
                })
                ->values()
                ->all();

            $slots = $this->selectDisplaySlots($sortedRecords);

            $slotMap = [
                'morning' => $slots[0] ?? null,
                'afternoon' => $slots[1] ?? null,
                'night' => $slots[2] ?? null,
            ];

            $officialTimes = [];
            $internalTimes = [];

            foreach ($slotMap as $slot => $record) {
                $officialTimes[$slot] = [
                    'in' => $this->formatTime($record?->official_time_in),
                    'out' => $this->formatTime($record?->official_time_out),
                    'is_absent' => (bool) (($record?->status ?? '') === 'absent' && empty($record?->actual_time_in) && empty($record?->actual_time_out)),
                ];

                $internalTimes[$slot] = [
                    'in' => $this->formatTime(
                        $record?->operational_time_in
                            ?? $record?->official_time_in
                    ),
                    'out' => $this->formatTime(
                        $record?->operational_time_out
                            ?? $record?->official_time_out
                    ),
                ];
            }

            $primaryRecord = $slots[0] ?? null;
            $internalDateSource = $primaryRecord?->operational_time_in
                ?? $primaryRecord?->operational_time_out
                ?? $primaryRecord?->actual_time_in
                ?? $primaryRecord?->actual_time_out;
            $internalDate = $internalDateSource ? Carbon::parse($internalDateSource) : null;
            $internalDay = $internalDate?->day ?? $day;
            $internalDayShift = $internalDate
                ? $officialDate->diffInDays($internalDate->copy()->startOfDay(), false)
                : 0;

            $tardyMinutes = collect($records)
                ->sum(fn ($record) => (int) ($record?->computed_late_minutes ?? $record?->late_minutes ?? 0));
            $undertimeMinutes = collect($records)
                ->sum(fn ($record) => (int) ($record?->computed_undertime_minutes ?? $record?->undertime_minutes ?? 0));
            $totalHoursRendered = collect($records)
                ->sum(fn ($record) => (float) ($record?->computed_total_hours_rendered ?? 0));
            $requiredHours = collect($records)
                ->sum(fn ($record) => (float) ($record?->required_hours ?? 0));
            $isManual = collect($records)->contains(fn ($record) => (bool) ($record?->is_manual_entry ?? false));

            $rows[] = [
                'day' => $day,
                'official_day' => $day,
                'internal_day' => $internalDay,
                'internal_day_shift' => (int) $internalDayShift,

                // Legacy fallback keys (used by PDF generator if it reads these directly)
                'morning_in' => $officialTimes['morning']['in'],
                'morning_out' => $officialTimes['morning']['out'],
                'afternoon_in' => $officialTimes['afternoon']['in'],
                'afternoon_out' => $officialTimes['afternoon']['out'],
                'night_in' => $officialTimes['night']['in'],
                'night_out' => $officialTimes['night']['out'],

                // Official tab
                'official_morning_in' => $officialTimes['morning']['in'],
                'official_morning_out' => $officialTimes['morning']['out'],
                'official_morning_absent' => $officialTimes['morning']['is_absent'],
                'official_afternoon_in' => $officialTimes['afternoon']['in'],
                'official_afternoon_out' => $officialTimes['afternoon']['out'],
                'official_afternoon_absent' => $officialTimes['afternoon']['is_absent'],
                'official_night_in' => $officialTimes['night']['in'],
                'official_night_out' => $officialTimes['night']['out'],
                'official_night_absent' => $officialTimes['night']['is_absent'],

                // Internal tab
                'internal_morning_in' => $internalTimes['morning']['in'],
                'internal_morning_out' => $internalTimes['morning']['out'],
                'internal_afternoon_in' => $internalTimes['afternoon']['in'],
                'internal_afternoon_out' => $internalTimes['afternoon']['out'],
                'internal_night_in' => $internalTimes['night']['in'],
                'internal_night_out' => $internalTimes['night']['out'],

                'tardy_minutes' => (int) $tardyMinutes,
                'undertime_minutes' => (int) $undertimeMinutes,
                'total_hours_rendered' => round($totalHoursRendered, 2),
                'required_hours' => round($requiredHours, 2),
                'status' => $dayData['status'] ?? 'none',
                'has_absent_slot' => collect($slots)->contains(function ($record): bool {
                    return (bool) (($record?->status ?? '') === 'absent' && empty($record?->actual_time_in) && empty($record?->actual_time_out));
                }),
                'holiday_label' => collect($dayData['holidays'] ?? [])->pluck('name')->filter()->implode(', '),
                'is_holiday' => ! empty($dayData['holidays']),
                'is_manual' => $isManual,
            ];
        }

        return $rows;
    }

    public function formatTime(mixed $value): string
    {
        if (empty($value)) {
            return '';
        }

        $time = Carbon::parse($value);

        return $time->format('g:iA');
    }

    private function selectDisplaySlots(array $records): array
    {
        if (count($records) <= 3) {
            return $records;
        }

        $actualRecords = collect($records)
            ->filter(fn ($record): bool => ! empty($record?->actual_time_in) || ! empty($record?->actual_time_out))
            ->values();

        $selected = $actualRecords->take(3);

        if ($selected->count() < 3) {
            $selected = $selected
                ->concat(
                    collect($records)
                        ->reject(fn ($record): bool => $actualRecords->containsStrict($record))
                        ->take(3 - $selected->count())
                );
        }

        return $selected
            ->sortBy(function ($record) {
                $rawOfficial = $record?->raw_official_time_in ?? $record?->official_time_in;

                return $rawOfficial ? Carbon::parse($rawOfficial)->timestamp : PHP_INT_MAX;
            })
            ->values()
            ->all();
    }
}
