<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreManualAttendanceRequest;
use App\Services\ManualAttendanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AdminManualAttendanceController extends Controller
{
    public function index(Request $request, ManualAttendanceService $manualAttendanceService): Response
    {
        $requestedDate = (string) $request->query('date', now()->addDay()->toDateString());

        try {
            $targetDate = Carbon::parse($requestedDate)->startOfDay();
        } catch (Throwable) {
            $targetDate = now()->addDay()->startOfDay();
        }

        return Inertia::render('Admin/ManualAttendance', [
            'targetDate' => $targetDate->toDateString(),
            'targetDay' => $targetDate->format('l'),
            'candidates' => $manualAttendanceService->getCandidatesForDate($targetDate),
        ]);
    }

    public function store(
        StoreManualAttendanceRequest $request,
        ManualAttendanceService $manualAttendanceService
    ) {
        $validated = $request->validated();

        try {
            $result = $manualAttendanceService->storeManualAttendance(
                date: $validated['attendance_date'],
                facultyIds: $validated['faculty_ids'],
                remarks: $validated['remarks'],
            );
        } catch (Throwable $e) {
            return back()->with('error', 'An error occurred while saving manual attendance. Please try again.');
        }

        if ($result['processed_faculties'] === 0) {
            return back()->with('error', 'No eligible faculty schedules were found for the selected date.');
        }

        $message = "{$result['records_saved']} attendance record(s) saved for {$result['processed_faculties']} selected faculty member(s).";

        if (! empty($result['skipped_faculty_ids'])) {
            $message .= ' Some selected faculty were skipped because no active and effective schedule was found.';
        }

        return back()->with('success', $message);
    }
}
