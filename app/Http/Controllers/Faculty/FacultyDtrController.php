<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Admin\AdminDtrExportController;
use App\Jobs\GenerateDtrPdfJob;
use App\Models\Faculty;
use App\Services\AttendanceToDtrService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class FacultyDtrController extends AdminDtrExportController
{
    public function index(Request $request): Response
    {
        $faculty = $this->resolveFaculty($request);
        $now = Carbon::now();

        return Inertia::render('Faculty/DtrPrint', [
            'faculty' => [
                'id' => $faculty->id,
                'full_name' => $faculty->full_name,
                'department' => $faculty->department?->name ?? 'N/A',
            ],
            'dtrExportDefaults' => [
                'month' => $now->month,
                'year' => $now->year,
            ],
            'dtrExportYears' => array_values(array_reverse(range($now->year - 5, $now->year + 1))),
        ]);
    }

    public function preview(Request $request, AttendanceToDtrService $service): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $faculty = $this->resolveFaculty($request);
        $month = (int) $validated['month'];
        $year = (int) $validated['year'];
        $conversion = $service->convertToDtr($faculty->id, $month, $year);
        $attendance = $conversion['attendance'] ?? [];
        $summary = $conversion['summary'] ?? [];

        return response()->json([
            'faculty' => [
                'id' => $faculty->id,
                'full_name' => $faculty->full_name,
                'department' => $faculty->department?->name ?? 'N/A',
            ],
            'periodLabel' => Carbon::create($year, $month, 1)->format('F Y'),
            'rows' => $this->buildRows($attendance, $month, $year),
            'summary' => $summary,
        ]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $faculty = $this->resolveFaculty($request);
        $token = Str::uuid()->toString();
        $safeName = str_replace(' ', '_', strtolower(trim($faculty->full_name)));
        $fileName = "dtr_{$safeName}_{$validated['year']}_{$validated['month']}.pdf";

        GenerateDtrPdfJob::dispatch(
            $faculty->id,
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

    private function resolveFaculty(Request $request): Faculty
    {
        /** @var Faculty|null $faculty */
        $faculty = $request->user()?->faculty;

        abort_if(! $faculty, 403, 'Faculty profile not found.');

        $faculty->loadMissing('department:id,name');

        return $faculty;
    }
}
