<?php

use App\Http\Controllers\Admin\AdminActivityLogController;
use App\Http\Controllers\Admin\AdminAttendanceImportController;
use App\Http\Controllers\Admin\AdminBackupController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminDtrExportController;
use App\Http\Controllers\Admin\AdminDtrExportPageController;
use App\Http\Controllers\Admin\AdminHolidayController;
use App\Http\Controllers\Admin\AdminManualAttendanceController;
use App\Http\Controllers\Admin\AdminManualAttendanceRequestApprovalController;
use App\Http\Controllers\Admin\AdminNewPasswordController;
use App\Http\Controllers\Admin\AdminOnlineRequestController;
use App\Http\Controllers\Admin\AdminPasswordResetLinkController;
use App\Http\Controllers\Admin\AdminProfileController;
use App\Http\Controllers\Admin\AdminRbacController;
use App\Http\Controllers\Admin\AdminScheduleChangeRequestController;
use App\Http\Controllers\Admin\AdminScheduleController;
use App\Http\Controllers\Admin\AdminSessionController;
use App\Http\Controllers\Admin\AdminUndertimeJustificationController;
use Illuminate\Support\Facades\Route;

// ── Admin Guest routes (no auth required) ──────────────────────────────────
Route::prefix('admin')->group(function () {
    Route::get('/login', [AdminSessionController::class, 'create'])
        ->name('admin.login');

    Route::post('/login', [AdminSessionController::class, 'store'])
        ->name('admin.login.store');

    // ── Password Reset ─────────────────────────────────────────────────────
    Route::get('/forgot-password', [AdminPasswordResetLinkController::class, 'create'])
        ->name('admin.password.request');

    Route::post('/forgot-password', [AdminPasswordResetLinkController::class, 'store'])
        ->name('admin.password.email');

    Route::get('/reset-password/{token}', [AdminNewPasswordController::class, 'create'])
        ->name('admin.password.reset');

    Route::post('/reset-password', [AdminNewPasswordController::class, 'store'])
        ->name('admin.password.store');
});

// ── Admin Protected routes ─────────────────────────────────────────────────
Route::middleware(['auth.admin'])->prefix('admin')->group(function () {

    Route::post('/logout', [AdminSessionController::class, 'destroy'])
        ->name('admin.logout');

    Route::get('/profile', [AdminProfileController::class, 'edit'])
        ->name('admin.profile.edit');

    Route::patch('/profile', [AdminProfileController::class, 'update'])
        ->name('admin.profile.update');

    // ── Dashboard ──────────────────────────────────────────────────────────
    Route::get('/dashboard', [AdminDashboardController::class, 'index'])
        ->name('admin.dashboard');

    Route::get('/activity-logs', [AdminActivityLogController::class, 'index'])
        ->name('admin.activity-logs.index');

    Route::get('/rbac', [AdminRbacController::class, 'index'])
        ->middleware('check.role:super_admin|admin,admin')
        ->name('admin.rbac.index');

    Route::post('/rbac/roles', [AdminRbacController::class, 'storeRole'])
        ->middleware('check.role:super_admin|admin,admin')
        ->name('admin.rbac.roles.store');

    Route::put('/rbac/roles/{role}', [AdminRbacController::class, 'updateRole'])
        ->middleware('check.role:super_admin|admin,admin')
        ->name('admin.rbac.roles.update');

    Route::delete('/rbac/roles/{role}', [AdminRbacController::class, 'destroyRole'])
        ->middleware('check.role:super_admin|admin,admin')
        ->name('admin.rbac.roles.destroy');

    Route::put('/rbac/users/{user}/roles', [AdminRbacController::class, 'updateUserRoles'])
        ->middleware('check.role:super_admin|admin,admin')
        ->name('admin.rbac.users.roles.update');

    Route::get('/api/dashboard', [AdminDashboardController::class, 'liveStats'])
        ->name('admin.api.dashboard');

    Route::get('/api/external-schedules', [AdminDashboardController::class, 'externalSchedules'])
        ->name('admin.api.external-schedules');

    Route::get('/dtr-export/preview', [AdminDtrExportController::class, 'preview'])
        ->name('admin.dtr-export.preview');

    Route::post('/dtr-export/preview-batch', [AdminDtrExportController::class, 'previewBatch'])
        ->name('admin.dtr-export.preview-batch');

    Route::post('/dtr-export/dispatch', [AdminDtrExportController::class, 'dispatch'])
        ->name('admin.dtr-export.dispatch');

    Route::post('/dtr-export/dispatch-batch', [AdminDtrExportController::class, 'dispatchBatch'])
        ->name('admin.dtr-export.dispatch-batch');

    Route::get('/dtr-export/status', [AdminDtrExportController::class, 'status'])
        ->name('admin.dtr-export.status');

    Route::get('/dtr-export/download-file', [AdminDtrExportController::class, 'downloadFile'])
        ->name('admin.dtr-export.download-file');

    Route::get('/dtr-export', [AdminDtrExportPageController::class, 'index'])
        ->name('admin.dtr-export.index');

    // ── Schedule Management ────────────────────────────────────────────────
    Route::get('/schedules', [AdminScheduleController::class, 'index'])
        ->name('admin.schedules.index');

    Route::get('/schedules/suggestions', [AdminScheduleController::class, 'searchSuggestions'])
        ->name('admin.schedules.suggestions');

    Route::post('/schedules', [AdminScheduleController::class, 'store'])
        ->name('admin.schedules.store');

    Route::put('/schedules/{schedule}', [AdminScheduleController::class, 'update'])
        ->name('admin.schedules.update');

    Route::delete('/schedules/{schedule}', [AdminScheduleController::class, 'destroy'])
        ->name('admin.schedules.destroy');

    // ── Schedule Change Requests ───────────────────────────────────────────
    Route::get('/schedule-change-requests', [AdminScheduleChangeRequestController::class, 'index'])
        ->name('admin.schedule-change-requests.index');

    Route::get('/api/schedule-change-requests', [AdminScheduleChangeRequestController::class, 'filter'])
        ->name('admin.schedule-change-requests.filter');

    Route::get('/api/schedule-change-requests/suggestions', [AdminScheduleChangeRequestController::class, 'searchSuggestions'])
        ->name('admin.schedule-change-requests.suggestions');

    Route::patch('/schedule-change-requests/{scheduleChangeRequest}/approve', [AdminScheduleChangeRequestController::class, 'approve'])
        ->name('admin.schedule-change-requests.approve');

    Route::patch('/schedule-change-requests/{scheduleChangeRequest}/reject', [AdminScheduleChangeRequestController::class, 'reject'])
        ->name('admin.schedule-change-requests.reject');

    // ── Online Attendance Requests ─────────────────────────────────────────
    Route::get('/online-requests', [AdminOnlineRequestController::class, 'index'])
        ->name('admin.online-requests.index');

    Route::get('/api/online-requests', [AdminOnlineRequestController::class, 'filter'])
        ->name('admin.online-requests.filter');

    Route::patch('/online-requests/{onlineRequest}/approve', [AdminOnlineRequestController::class, 'approve'])
        ->name('admin.online-requests.approve');

    Route::patch('/online-requests/{onlineRequest}/reject', [AdminOnlineRequestController::class, 'reject'])
        ->name('admin.online-requests.reject');

    // ── Undertime Justification Approvals ──────────────────────────────────
    Route::get('/undertime-justifications', [AdminUndertimeJustificationController::class, 'index'])
        ->name('admin.undertime-justifications.index');

    Route::get('/api/undertime-justifications', [AdminUndertimeJustificationController::class, 'filter'])
        ->name('admin.undertime-justifications.filter');

    Route::patch('/undertime-justifications/{justification}/approve', [AdminUndertimeJustificationController::class, 'approve'])
        ->name('admin.undertime-justifications.approve');

    Route::patch('/undertime-justifications/{justification}/reject', [AdminUndertimeJustificationController::class, 'reject'])
        ->name('admin.undertime-justifications.reject');

    Route::get('/manual-attendance-requests', [AdminManualAttendanceRequestApprovalController::class, 'index'])
        ->name('admin.manual-attendance-requests.index');

    Route::get('/api/manual-attendance-requests', [AdminManualAttendanceRequestApprovalController::class, 'filter'])
        ->name('admin.manual-attendance-requests.filter');

    Route::patch('/manual-attendance-requests/settings/limit', [AdminManualAttendanceRequestApprovalController::class, 'updateLimit'])
        ->name('admin.manual-attendance-requests.limit.update');

    Route::patch('/manual-attendance-requests/{justification}/approve', [AdminManualAttendanceRequestApprovalController::class, 'approve'])
        ->name('admin.manual-attendance-requests.approve');

    Route::patch('/manual-attendance-requests/{justification}/reject', [AdminManualAttendanceRequestApprovalController::class, 'reject'])
        ->name('admin.manual-attendance-requests.reject');

    // ── Holiday Management ─────────────────────────────────────────────────
    Route::get('/holidays/suggestions', [AdminHolidayController::class, 'searchSuggestions'])
        ->name('admin.holidays.suggestions');

    Route::get('/holidays', [AdminHolidayController::class, 'index'])
        ->name('admin.holidays.index');

    Route::post('/holidays', [AdminHolidayController::class, 'store'])
        ->name('admin.holidays.store');

    Route::put('/holidays/{holiday}', [AdminHolidayController::class, 'update'])
        ->name('admin.holidays.update');

    Route::delete('/holidays/{holiday}', [AdminHolidayController::class, 'destroy'])
        ->name('admin.holidays.destroy');

    // ── Attendance Log Import ─────────────────────────────────────────────
    Route::get('/attendance-imports', [AdminAttendanceImportController::class, 'index'])
        ->name('admin.attendance-imports.index');

    Route::post('/attendance-imports', [AdminAttendanceImportController::class, 'store'])
        ->name('admin.attendance-imports.store');

    Route::get('/attendance-imports/{batch}/details', [AdminAttendanceImportController::class, 'details'])
        ->name('admin.attendance-imports.details');

    Route::patch('/attendance-imports/{batch}/logs/{log}', [AdminAttendanceImportController::class, 'updateLog'])
        ->name('admin.attendance-imports.logs.update');

    Route::delete('/attendance-imports/{batch}/logs/{log}', [AdminAttendanceImportController::class, 'destroyLog'])
        ->name('admin.attendance-imports.logs.destroy');

    Route::patch('/attendance-imports/{batch}/sync', [AdminAttendanceImportController::class, 'sync'])
        ->name('admin.attendance-imports.sync');

    Route::delete('/attendance-imports/{batch}', [AdminAttendanceImportController::class, 'destroy'])
        ->name('admin.attendance-imports.destroy');

    Route::get('/attendance-imports/template', [AdminAttendanceImportController::class, 'downloadTemplate'])
        ->name('admin.attendance-imports.template');

    // ── Manual Attendance Entry ───────────────────────────────────────────
    Route::get('/manual-attendance', [AdminManualAttendanceController::class, 'index'])
        ->name('admin.manual-attendance.index');

    Route::post('/manual-attendance', [AdminManualAttendanceController::class, 'store'])
        ->name('admin.manual-attendance.store');

    Route::get('/backups', [AdminBackupController::class, 'index'])
        ->name('admin.backups.index');

    Route::post('/backups/run', [AdminBackupController::class, 'store'])
        ->name('admin.backups.store');

    Route::get('/backups/{backup}/download', [AdminBackupController::class, 'download'])
        ->name('admin.backups.download');
});
