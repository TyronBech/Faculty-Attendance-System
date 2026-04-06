<?php
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Faculty\FacultyDashboardController;
use App\Http\Controllers\Faculty\ScheduleChangeRequestController;
use App\Http\Controllers\Faculty\OnlineAttendanceController;
use App\Http\Controllers\Faculty\UndertimeRequestController;

Route::middleware(['auth', 'auth.faculty'])->group(function () {
    Route::get('/faculty/dashboard', [FacultyDashboardController::class, 'index'])->name('faculty.dashboard');
    Route::get('/faculty/api/analytics', [FacultyDashboardController::class, 'getAnalyticsData'])->name('faculty.api.analytics');

    Route::get('/faculty/schedule', [FacultyDashboardController::class, 'schedule'])->name('faculty.schedule');
    Route::get('/faculty/attendance', [FacultyDashboardController::class, 'attendance'])->name('faculty.attendance');
    Route::post('/faculty/attendance/{id}/justification', [FacultyDashboardController::class, 'submitUndertimeJustification'])->name('faculty.attendance.justify');
    Route::post('/faculty/attendance/{id}/missing-justification', [FacultyDashboardController::class, 'submitMissingTimeJustification'])->name('faculty.attendance.missing-justify');

    // ── Schedule Change Requests ───────────────────────────────────────────
    Route::get('/faculty/schedule-change-requests', [ScheduleChangeRequestController::class, 'index'])
        ->name('faculty.schedule-change-requests.index');
    Route::post('/faculty/schedule-change-requests', [ScheduleChangeRequestController::class, 'store'])
        ->name('faculty.schedule-change-requests.store');
    Route::delete('/faculty/schedule-change-requests/{scheduleChangeRequest}', [ScheduleChangeRequestController::class, 'destroy'])
        ->name('faculty.schedule-change-requests.destroy');

    // AJAX endpoints for schedule change requests
    Route::get('/faculty/api/schedule-change-requests', [ScheduleChangeRequestController::class, 'filter'])
        ->name('faculty.schedule-change-requests.filter');
    Route::post('/faculty/api/schedule-change-requests/check-conflict', [ScheduleChangeRequestController::class, 'checkConflict'])
        ->name('faculty.schedule-change-requests.check-conflict');

    // ── Online Attendance Requests ─────────────────────────────────────────
    Route::get('/faculty/online-attendance', [OnlineAttendanceController::class, 'index'])
        ->name('faculty.online-attendance.index');
    Route::post('/faculty/online-attendance', [OnlineAttendanceController::class, 'store'])
        ->name('faculty.online-attendance.store');
    Route::delete('/faculty/online-attendance/{onlineAttendanceRequest}', [OnlineAttendanceController::class, 'destroy'])
        ->name('faculty.online-attendance.destroy');

    // AJAX endpoints for online attendance
    Route::get('/faculty/api/online-attendance', [OnlineAttendanceController::class, 'filter'])
        ->name('faculty.online-attendance.filter');
    Route::get('/faculty/api/online-attendance/check', [OnlineAttendanceController::class, 'checkAttendance'])
        ->name('faculty.online-attendance.check');

    // ── Undertime Requests ────────────────────────────────────────────────
    Route::get('/faculty/undertime-requests', [UndertimeRequestController::class, 'index'])
        ->name('faculty.undertime-requests.index');
    Route::post('/faculty/undertime-requests', [UndertimeRequestController::class, 'store'])
        ->name('faculty.undertime-requests.store');
    Route::delete('/faculty/undertime-requests/{undertimeRequest}', [UndertimeRequestController::class, 'destroy'])
        ->name('faculty.undertime-requests.destroy');

    // AJAX endpoints for undertime requests
    Route::get('/faculty/api/undertime-requests', [UndertimeRequestController::class, 'filter'])
        ->name('faculty.undertime-requests.filter');
});

/*
Route::delete('/faculty/{id}', [FacultyController::class, 'destroy'])
    ✅ Example of how to use the check.permission middleware with a specific permission and guard:
    ->middleware('check.permission:' . Permission::DeleteFaculty->value . ',admin')
    ->name('faculty.destroy');
*/
