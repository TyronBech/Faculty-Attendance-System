<?php

use App\Enums\Permission;
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
use App\Http\Controllers\Admin\HrDashboardController;
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
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',admin')
        ->name('admin.dashboard');

    Route::get('/activity-logs', [AdminActivityLogController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewLogs->value.',admin')
        ->name('admin.activity-logs.index');

    Route::get('/rbac', [AdminRbacController::class, 'index'])
        ->middleware('check.permission:'.Permission::ManageRoles->value.'|'.Permission::ManagePermissions->value.',admin')
        ->name('admin.rbac.index');

    Route::post('/rbac/roles', [AdminRbacController::class, 'storeRole'])
        ->middleware('check.permission:'.Permission::ManageRoles->value.'|'.Permission::ManagePermissions->value.',admin')
        ->name('admin.rbac.roles.store');

    Route::put('/rbac/roles/{role}', [AdminRbacController::class, 'updateRole'])
        ->middleware('check.permission:'.Permission::ManageRoles->value.'|'.Permission::ManagePermissions->value.',admin')
        ->name('admin.rbac.roles.update');

    Route::delete('/rbac/roles/{role}', [AdminRbacController::class, 'destroyRole'])
        ->middleware('check.permission:'.Permission::ManageRoles->value.'|'.Permission::ManagePermissions->value.',admin')
        ->name('admin.rbac.roles.destroy');

    Route::put('/rbac/users/{user}/roles', [AdminRbacController::class, 'updateUserRoles'])
        ->middleware('check.permission:'.Permission::ManageRoles->value.'|'.Permission::ManagePermissions->value.',admin')
        ->name('admin.rbac.users.roles.update');

    Route::get('/api/dashboard', [AdminDashboardController::class, 'liveStats'])
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',admin')
        ->name('admin.api.dashboard');

    Route::get('/api/external-schedules', [AdminDashboardController::class, 'externalSchedules'])
        ->middleware('check.permission:'.Permission::ViewDashboard->value.',admin')
        ->name('admin.api.external-schedules');

    Route::get('/hr/dashboard', [HrDashboardController::class, 'index'])
        ->middleware('check.permission:'.Permission::ManageHrDtrSync->value.',admin')
        ->name('admin.hr.dashboard');

    Route::patch('/hr/dtr-settings', [HrDashboardController::class, 'updateSettings'])
        ->middleware('check.permission:'.Permission::ManageHrDtrSync->value.',admin')
        ->name('admin.hr.dtr-settings.update');

    Route::post('/hr/dtr-sync', [HrDashboardController::class, 'sync'])
        ->middleware('check.permission:'.Permission::ManageHrDtrSync->value.',admin')
        ->name('admin.hr.dtr-sync');

    Route::get('/dtr-export/preview', [AdminDtrExportController::class, 'preview'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.preview');

    Route::post('/dtr-export/preview-batch', [AdminDtrExportController::class, 'previewBatch'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.preview-batch');

    Route::post('/dtr-export/dispatch', [AdminDtrExportController::class, 'dispatch'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.dispatch');

    Route::post('/dtr-export/dispatch-batch', [AdminDtrExportController::class, 'dispatchBatch'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.dispatch-batch');

    Route::get('/dtr-export/status', [AdminDtrExportController::class, 'status'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.status');

    Route::get('/dtr-export/download-file', [AdminDtrExportController::class, 'downloadFile'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.download-file');

    Route::get('/dtr-export', [AdminDtrExportPageController::class, 'index'])
        ->middleware('check.permission:'.Permission::GenerateDtr->value.',admin')
        ->name('admin.dtr-export.index');

    // ── Schedule Management ────────────────────────────────────────────────
    Route::get('/schedules', [AdminScheduleController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewSchedules->value.',admin')
        ->name('admin.schedules.index');

    Route::get('/schedules/suggestions', [AdminScheduleController::class, 'searchSuggestions'])
        ->middleware('check.permission:'.Permission::ViewSchedules->value.',admin')
        ->name('admin.schedules.suggestions');

    Route::post('/schedules', [AdminScheduleController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateSchedules->value.',admin')
        ->name('admin.schedules.store');

    Route::put('/schedules/{schedule}', [AdminScheduleController::class, 'update'])
        ->middleware('check.permission:'.Permission::EditSchedules->value.',admin')
        ->name('admin.schedules.update');

    Route::delete('/schedules/{schedule}', [AdminScheduleController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteSchedules->value.',admin')
        ->name('admin.schedules.destroy');

    // ── Schedule Change Requests ───────────────────────────────────────────
    Route::get('/schedule-change-requests', [AdminScheduleChangeRequestController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.schedule-change-requests.index');

    Route::get('/api/schedule-change-requests', [AdminScheduleChangeRequestController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.schedule-change-requests.filter');

    Route::get('/api/schedule-change-requests/suggestions', [AdminScheduleChangeRequestController::class, 'searchSuggestions'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.schedule-change-requests.suggestions');

    Route::patch('/schedule-change-requests/{scheduleChangeRequest}/approve', [AdminScheduleChangeRequestController::class, 'approve'])
        ->middleware('check.permission:'.Permission::ApproveRequests->value.',admin')
        ->name('admin.schedule-change-requests.approve');

    Route::patch('/schedule-change-requests/{scheduleChangeRequest}/reject', [AdminScheduleChangeRequestController::class, 'reject'])
        ->middleware('check.permission:'.Permission::RejectRequests->value.',admin')
        ->name('admin.schedule-change-requests.reject');

    // ── Online Attendance Requests ─────────────────────────────────────────
    Route::get('/online-requests', [AdminOnlineRequestController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.online-requests.index');

    Route::get('/api/online-requests', [AdminOnlineRequestController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.online-requests.filter');

    Route::patch('/online-requests/{onlineRequest}/approve', [AdminOnlineRequestController::class, 'approve'])
        ->middleware('check.permission:'.Permission::ApproveRequests->value.',admin')
        ->name('admin.online-requests.approve');

    Route::patch('/online-requests/{onlineRequest}/reject', [AdminOnlineRequestController::class, 'reject'])
        ->middleware('check.permission:'.Permission::RejectRequests->value.',admin')
        ->name('admin.online-requests.reject');

    // ── Undertime Justification Approvals ──────────────────────────────────
    Route::get('/undertime-justifications', [AdminUndertimeJustificationController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.undertime-justifications.index');

    Route::get('/api/undertime-justifications', [AdminUndertimeJustificationController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.undertime-justifications.filter');

    Route::patch('/undertime-justifications/{justification}/approve', [AdminUndertimeJustificationController::class, 'approve'])
        ->middleware('check.permission:'.Permission::ApproveRequests->value.',admin')
        ->name('admin.undertime-justifications.approve');

    Route::patch('/undertime-justifications/{justification}/reject', [AdminUndertimeJustificationController::class, 'reject'])
        ->middleware('check.permission:'.Permission::RejectRequests->value.',admin')
        ->name('admin.undertime-justifications.reject');

    Route::get('/manual-attendance-requests', [AdminManualAttendanceRequestApprovalController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.manual-attendance-requests.index');

    Route::get('/api/manual-attendance-requests', [AdminManualAttendanceRequestApprovalController::class, 'filter'])
        ->middleware('check.permission:'.Permission::ViewRequests->value.',admin')
        ->name('admin.manual-attendance-requests.filter');

    Route::patch('/manual-attendance-requests/settings/limit', [AdminManualAttendanceRequestApprovalController::class, 'updateLimit'])
        ->middleware('check.permission:'.Permission::EditManualRequestLimit->value.',admin')
        ->name('admin.manual-attendance-requests.limit.update');

    Route::patch('/manual-attendance-requests/{justification}/approve', [AdminManualAttendanceRequestApprovalController::class, 'approve'])
        ->middleware('check.permission:'.Permission::ApproveRequests->value.',admin')
        ->name('admin.manual-attendance-requests.approve');

    Route::patch('/manual-attendance-requests/{justification}/reject', [AdminManualAttendanceRequestApprovalController::class, 'reject'])
        ->middleware('check.permission:'.Permission::RejectRequests->value.',admin')
        ->name('admin.manual-attendance-requests.reject');

    // ── Holiday Management ─────────────────────────────────────────────────
    Route::get('/holidays/suggestions', [AdminHolidayController::class, 'searchSuggestions'])
        ->middleware('check.permission:'.Permission::ViewHolidays->value.',admin')
        ->name('admin.holidays.suggestions');

    Route::get('/holidays', [AdminHolidayController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewHolidays->value.',admin')
        ->name('admin.holidays.index');

    Route::post('/holidays', [AdminHolidayController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateHolidays->value.',admin')
        ->name('admin.holidays.store');

    Route::put('/holidays/{holiday}', [AdminHolidayController::class, 'update'])
        ->middleware('check.permission:'.Permission::EditHolidays->value.',admin')
        ->name('admin.holidays.update');

    Route::delete('/holidays/{holiday}', [AdminHolidayController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteHolidays->value.',admin')
        ->name('admin.holidays.destroy');

    // ── Attendance Log Import ─────────────────────────────────────────────
    Route::get('/attendance-imports', [AdminAttendanceImportController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.index');

    Route::post('/attendance-imports', [AdminAttendanceImportController::class, 'store'])
        ->middleware('check.permission:'.Permission::ImportBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.store');

    Route::get('/attendance-imports/{batch}/details', [AdminAttendanceImportController::class, 'details'])
        ->middleware('check.permission:'.Permission::ViewBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.details');

    Route::patch('/attendance-imports/{batch}/logs/{log}', [AdminAttendanceImportController::class, 'updateLog'])
        ->middleware('check.permission:'.Permission::EditBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.logs.update');

    Route::delete('/attendance-imports/{batch}/logs/{log}', [AdminAttendanceImportController::class, 'destroyLog'])
        ->middleware('check.permission:'.Permission::DeleteBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.logs.destroy');

    Route::patch('/attendance-imports/{batch}/sync', [AdminAttendanceImportController::class, 'sync'])
        ->middleware('check.permission:'.Permission::ImportBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.sync');

    Route::delete('/attendance-imports/{batch}', [AdminAttendanceImportController::class, 'destroy'])
        ->middleware('check.permission:'.Permission::DeleteBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.destroy');

    Route::get('/attendance-imports/template', [AdminAttendanceImportController::class, 'downloadTemplate'])
        ->middleware('check.permission:'.Permission::ImportBiometricLogs->value.',admin')
        ->name('admin.attendance-imports.template');

    // ── Manual Attendance Entry ───────────────────────────────────────────
    Route::get('/manual-attendance', [AdminManualAttendanceController::class, 'index'])
        ->middleware('check.permission:'.Permission::ViewAttendance->value.',admin')
        ->name('admin.manual-attendance.index');

    Route::post('/manual-attendance', [AdminManualAttendanceController::class, 'store'])
        ->middleware('check.permission:'.Permission::CreateAttendance->value.',admin')
        ->name('admin.manual-attendance.store');

    Route::get('/backups', [AdminBackupController::class, 'index'])
        ->middleware('check.permission:'.Permission::BackupDatabase->value.',admin')
        ->name('admin.backups.index');

    Route::post('/backups/run', [AdminBackupController::class, 'store'])
        ->middleware('check.permission:'.Permission::BackupDatabase->value.',admin')
        ->name('admin.backups.store');

    Route::get('/backups/{backup}/download', [AdminBackupController::class, 'download'])
        ->middleware('check.permission:'.Permission::BackupDatabase->value.',admin')
        ->name('admin.backups.download');
});
