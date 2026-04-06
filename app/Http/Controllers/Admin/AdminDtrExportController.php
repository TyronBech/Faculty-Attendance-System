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
    public function downloadFile(Request $request): BinaryFileResponse|JsonResponse
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

        return response()
            ->download($fullPath, $fileName)
            ->deleteFileAfterSend(true);
    }

    /* ──────────────────────────────────────────────────────────────
       Helpers
       ────────────────────────────────────────────────────────────── */

    public function buildRows(array $attendance, int $month, int $year): array
    {
        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
        $rows = [];

        for ($day = 1; $day <= $daysInMonth; $day++) {
            $dayData = $attendance[$day] ?? ['status' => 'none', 'record' => null, 'holidays' => []];
            $record = $dayData['record'] ?? null;
            $officialDate = Carbon::create($year, $month, $day);

            $officialMorningIn = $this->timeForPeriod($record?->official_time_in, 'morning');
            $officialMorningOut = $this->timeForPeriod($record?->official_time_out, 'morning');
            $officialAfternoonIn = $this->timeForPeriod($record?->official_time_in, 'afternoon');
            $officialAfternoonOut = $this->timeForPeriod($record?->official_time_out, 'afternoon');
            $officialNightIn = $this->timeForPeriod($record?->official_time_in, 'night');
            $officialNightOut = $this->timeForPeriod($record?->official_time_out, 'night');

            $rawActualTimeIn = $record?->raw_actual_time_in ?? $record?->actual_time_in;
            $rawActualTimeOut = $record?->raw_actual_time_out ?? $record?->actual_time_out;

            $actualMorningIn = $this->timeForPeriod($rawActualTimeIn, 'morning');
            $actualMorningOut = $this->timeForPeriod($rawActualTimeOut, 'morning');
            $actualAfternoonIn = $this->timeForPeriod($rawActualTimeIn, 'afternoon');
            $actualAfternoonOut = $this->timeForPeriod($rawActualTimeOut, 'afternoon');
            $actualNightIn = $this->timeForPeriod($rawActualTimeIn, 'night');
            $actualNightOut = $this->timeForPeriod($rawActualTimeOut, 'night');
            $actualDateSource = $rawActualTimeIn ?: $rawActualTimeOut;
            $actualDate = $actualDateSource ? Carbon::parse($actualDateSource) : null;
            $actualDay = $actualDate?->day ?? $day;
            $actualDayShift = $actualDate
                ? $officialDate->diffInDays($actualDate->copy()->startOfDay(), false)
                : 0;

            $rows[] = [
                'day' => $day,
                'official_day' => $day,
                'actual_day' => $actualDay,
                'actual_day_shift' => (int) $actualDayShift,
                // Keep export/default row values on official schedule times.
                'morning_in' => $officialMorningIn,
                'morning_out' => $officialMorningOut,
                'afternoon_in' => $officialAfternoonIn,
                'afternoon_out' => $officialAfternoonOut,
                'night_in' => $officialNightIn,
                'night_out' => $officialNightOut,
                // Add both time sets for preview tabs in the modal.
                'official_morning_in' => $officialMorningIn,
                'official_morning_out' => $officialMorningOut,
                'official_afternoon_in' => $officialAfternoonIn,
                'official_afternoon_out' => $officialAfternoonOut,
                'official_night_in' => $officialNightIn,
                'official_night_out' => $officialNightOut,
                'actual_morning_in' => $actualMorningIn,
                'actual_morning_out' => $actualMorningOut,
                'actual_afternoon_in' => $actualAfternoonIn,
                'actual_afternoon_out' => $actualAfternoonOut,
                'actual_night_in' => $actualNightIn,
                'actual_night_out' => $actualNightOut,
                'tardy_minutes' => (int) ($record?->late_minutes ?? 0),
                'undertime_minutes' => (int) ($record?->undertime_minutes ?? 0),
                'status' => $dayData['status'] ?? 'none',
                'holiday_label' => collect($dayData['holidays'] ?? [])->pluck('name')->filter()->implode(', '),
                'is_holiday' => ! empty($dayData['holidays']),
            ];
        }

        return $rows;
    }

    public function timeForPeriod(mixed $value, string $period): string
    {
        if (empty($value)) {
            return '';
        }

        $time = Carbon::parse($value);
        $hour = $time->hour;

        $isMorning = $hour < 12;
        $isAfternoon = $hour >= 12 && $hour < 18;
        $isNight = $hour >= 18;

        if (($period === 'morning' && $isMorning)
            || ($period === 'afternoon' && $isAfternoon)
            || ($period === 'night' && $isNight)) {
            return $time->format('g:iA');
        }

        return '';
    }
}
