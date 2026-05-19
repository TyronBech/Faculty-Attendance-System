<?php

use App\Enums\Permission;
use App\Http\Controllers\Faculty\FacultyDashboardController;
use App\Http\Controllers\Faculty\FacultyDtrController;
use App\Http\Controllers\Faculty\ManualAttendanceRequestController;
use App\Http\Controllers\Faculty\OnlineAttendanceController;
use App\Http\Controllers\Faculty\ScheduleChangeRequestController;
use App\Http\Controllers\Faculty\UndertimeRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'auth.faculty'])->group(function () {
    Route::get('/faculty/dashboard', [FacultyDashboardController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',web')
        ->name('faculty.dashboard');
    Route::get('/faculty/api/analytics', [FacultyDashboardController::class, 'getAnalyticsData'])
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',web')
        ->name('faculty.api.analytics');

    Route::get('/faculty/schedule', [FacultyDashboardController::class, 'schedule'])
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',web')
        ->name('faculty.schedule');
    Route::get('/faculty/attendance', [FacultyDashboardController::class, 'attendance'])
        ->middleware('check.permission:'.Permission::ViewAttendance->value.',web')
        ->name('faculty.attendance');
    Route::post('/faculty/attendance/{id}/justification', [FacultyDashboardController::class, 'submitUndertimeJustification'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.attendance.justify');
    Route::post('/faculty/attendance/{id}/missing-justification', [FacultyDashboardController::class, 'submitMissingTimeJustification'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.attendance.missing-justify');
    Route::get('/faculty/dtr', [FacultyDtrController::class, 'index'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',web')
        ->name('faculty.dtr.index');
    Route::get('/faculty/dtr/preview', [FacultyDtrController::class, 'preview'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',web')
        ->name('faculty.dtr.preview');
    Route::post('/faculty/dtr/dispatch', [FacultyDtrController::class, 'dispatch'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',web')
        ->name('faculty.dtr.dispatch');
    Route::get('/faculty/dtr/status', [FacultyDtrController::class, 'status'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',web')
        ->name('faculty.dtr.status');
    Route::get('/faculty/dtr/download-file', [FacultyDtrController::class, 'downloadFile'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',web')
        ->name('faculty.dtr.download-file');

    // ── Schedule Change Requests ───────────────────────────────────────────
    Route::get('/faculty/schedule-change-requests', [ScheduleChangeRequestController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.schedule-change-requests.index');
    Route::post('/faculty/schedule-change-requests', [ScheduleChangeRequestController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.schedule-change-requests.store');
    Route::delete('/faculty/schedule-change-requests/{scheduleChangeRequest}', [ScheduleChangeRequestController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteOwnRequests->value.',web')
        ->name('faculty.schedule-change-requests.destroy');

    // AJAX endpoints for schedule change requests
    Route::get('/faculty/api/schedule-change-requests', [ScheduleChangeRequestController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.schedule-change-requests.filter');
    Route::post('/faculty/api/schedule-change-requests/check-conflict', [ScheduleChangeRequestController::class, 'checkConflict'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.schedule-change-requests.check-conflict');

    // ── Online Attendance Requests ─────────────────────────────────────────
    Route::get('/faculty/online-attendance', [OnlineAttendanceController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.online-attendance.index');
    Route::post('/faculty/online-attendance', [OnlineAttendanceController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.online-attendance.store');
    Route::delete('/faculty/online-attendance/{onlineAttendanceRequest}', [OnlineAttendanceController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteOwnRequests->value.',web')
        ->name('faculty.online-attendance.destroy');

    // AJAX endpoints for online attendance
    Route::get('/faculty/api/online-attendance', [OnlineAttendanceController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.online-attendance.filter');
    Route::get('/faculty/api/online-attendance/check', [OnlineAttendanceController::class, 'checkAttendance'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.online-attendance.check');

    // ── Undertime Requests ────────────────────────────────────────────────
    Route::get('/faculty/undertime-requests', [UndertimeRequestController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.undertime-requests.index');
    Route::post('/faculty/undertime-requests', [UndertimeRequestController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.undertime-requests.store');
    Route::delete('/faculty/undertime-requests/{undertimeRequest}', [UndertimeRequestController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteOwnRequests->value.',web')
        ->name('faculty.undertime-requests.destroy');

    // AJAX endpoints for undertime requests
    Route::get('/faculty/api/undertime-requests', [UndertimeRequestController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.undertime-requests.filter');

    // ── Manual Attendance Requests ────────────────────────────────────────
    Route::get('/faculty/manual-attendance-requests', [ManualAttendanceRequestController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.manual-attendance-requests.index');
    Route::post('/faculty/manual-attendance-requests', [ManualAttendanceRequestController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateOwnRequests->value.',web')
        ->name('faculty.manual-attendance-requests.store');
    Route::delete('/faculty/manual-attendance-requests/{attendanceJustification}', [ManualAttendanceRequestController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteOwnRequests->value.',web')
        ->name('faculty.manual-attendance-requests.destroy');

    // AJAX endpoints for manual attendance requests
    Route::get('/faculty/api/manual-attendance-requests', [ManualAttendanceRequestController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewOwnRequests->value.',web')
        ->name('faculty.manual-attendance-requests.filter');
});

/*
Route::delete('/faculty/{id}', [FacultyController::class, 'destroy'])
    ✅ Example of how to use the check.permission middleware with a specific permission and guard:
    ->middleware('check.permission:' . Permission::DeleteFaculty->value . ',admin')
    ->name('faculty.destroy');
*/
