<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DtrRecord;
use App\Models\Faculty;
use App\Models\HrDtrStatus;
use App\Models\ImportBatch;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\HrDtrRejectedNotification;
use App\Services\AttendanceToDtrService;
use App\Services\HrDtrSyncService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class HrDashboardController extends Controller
{
    public function index(): Response
    {
        $now = Carbon::now();
        $syncDays = HrDtrSyncService::syncDays();
        $pendingDtrs = $this->hrStatusCount('pending');
        $lastSync = SystemSetting::query()
            ->where('setting_key', 'hr_dtr_last_sync_at')
            ->value('setting_value');

        return Inertia::render('Admin/HrDashboard', [
            'stats' => [
                [
                    'label' => 'Pending DTRs',
                    'value' => $pendingDtrs,
                    'description' => 'Records waiting for HR validation',
                ],
                [
                    'label' => 'Active Faculty',
                    'value' => Faculty::query()->where('is_active', true)->count(),
                    'description' => 'Included in DTR synchronization',
                ],
                [
                    'label' => 'Unsynced Imports',
                    'value' => ImportBatch::query()->where('status', 'pending')->count(),
                    'description' => 'Biometric batches still pending sync',
                ],
            ],
            'syncSettings' => [
                'days' => $syncDays,
                'isDueToday' => HrDtrSyncService::isDueToday($now),
                'lastSyncAt' => $lastSync,
                'nextSyncLabel' => $this->nextSyncLabel($syncDays, $now),
                'currentPeriod' => $now->format('F Y'),
                'month' => $now->month,
                'year' => $now->year,
            ],
            'pendingDtrs' => HrDtrStatus::query()
                ->with([
                    'dtrRecord.faculty:id,first_name,middle_name,last_name,department_id',
                ])
                ->where('status', 'pending')
                ->latest('created_at')
                ->limit(10)
                ->get()
                ->map(fn (HrDtrStatus $status): array => [
                    'id' => $status->id,
                    'faculty' => $status->dtrRecord?->faculty?->full_name ?? 'Unknown Faculty',
                    'period' => $this->formatHrPeriod($status),
                    'lateMinutes' => 0,
                    'undertimeMinutes' => 0,
                    'generatedAt' => $status->created_at?->format('M j, Y g:i A'),
                ]),
        ]);
    }

    public function dtrs(Request $request, AttendanceToDtrService $dtrService): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['', 'pending', 'approved', 'rejected'])],
            'search' => ['nullable', 'string', 'max:120'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020', 'max:2100'],
        ]);

        $status = $validated['status'] ?? 'pending';
        $search = trim((string) ($validated['search'] ?? ''));
        $month = $validated['month'] ?? null;
        $year = $validated['year'] ?? null;

        $records = HrDtrStatus::query()
            ->with([
                'dtrRecord.faculty:id,first_name,middle_name,last_name,department_id,faculty_code',
                'dtrRecord.faculty.department:id,name,code',
                'dtrRecord.faculty.schedules' => fn ($query) => $query
                    ->where('status', 'active')
                    ->with('scheduleDetails')
                    ->orderByDesc('academic_year')
                    ->orderByDesc('semester'),
                'reviewedBy:id,username,email',
            ])
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($month, fn ($query) => $query->whereHas('dtrRecord', fn ($recordQuery) => $recordQuery->where('month', $month)))
            ->when($year, fn ($query) => $query->whereHas('dtrRecord', fn ($recordQuery) => $recordQuery->where('year', $year)))
            ->when($search !== '', function ($query) use ($search): void {
                $query->whereHas('dtrRecord.faculty', function ($facultyQuery) use ($search): void {
                    $facultyQuery
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('middle_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('faculty_code', 'like', "%{$search}%");
                });
            })
            ->latest('period_end')
            ->latest('updated_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (HrDtrStatus $status): array => $this->formatDtrRecord($status, $dtrService));

        return Inertia::render('Admin/HrDtrReview', [
            'dtrs' => $records,
            'filters' => [
                'status' => $status,
                'search' => $search,
                'month' => $month,
                'year' => $year,
            ],
            'stats' => [
                'pending' => $this->hrStatusCount('pending'),
                'approved' => $this->hrStatusCount('approved'),
                'rejected' => $this->hrStatusCount('rejected'),
            ],
            'periodOptions' => [
                'months' => collect(range(1, 12))
                    ->map(fn (int $month): array => [
                        'value' => $month,
                        'label' => Carbon::create(2026, $month, 1)->format('F'),
                    ])
                    ->all(),
                'years' => array_values(array_reverse(range(Carbon::now()->year - 5, Carbon::now()->year + 1))),
            ],
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'sync_days' => ['required', 'array', 'min:1', 'max:4'],
            'sync_days.*' => ['required', 'integer', 'min:1', 'max:31', 'distinct'],
        ]);

        $days = collect($validated['sync_days'])
            ->map(fn (int|string $day): int => (int) $day)
            ->sort()
            ->values()
            ->implode(',');

        SystemSetting::updateOrCreate(
            ['setting_key' => 'hr_dtr_sync_days'],
            [
                'setting_value' => $days,
                'setting_type' => 'csv_integer',
                'description' => 'Month days when HR pending DTR records should be synchronized automatically.',
                'is_editable' => true,
                'updated_by' => $request->user('admin')?->id,
            ]
        );

        return back()->with('success', 'HR DTR sync settings updated.');
    }

    public function sync(Request $request, HrDtrSyncService $syncService): RedirectResponse
    {
        $validated = $request->validate([
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020', 'max:2100'],
            'source' => ['nullable', Rule::in(['manual'])],
        ]);

        $summary = DB::transaction(fn (): array => $syncService->syncPendingDtrs(
            $validated['month'] ?? null,
            $validated['year'] ?? null,
        ));

        if (! $summary['period_start'] || ! $summary['period_end']) {
            return back()->with('info', 'No rendered HR cutoff period is available for the selected month yet.');
        }

        return back()->with(
            'success',
            "HR DTR sync completed for {$summary['period_start']} to {$summary['period_end']}: {$summary['created']} created, {$summary['updated']} updated, {$summary['skipped']} skipped."
        );
    }

    public function approveDtr(Request $request, HrDtrStatus $hrDtrStatus): RedirectResponse
    {
        if ($hrDtrStatus->status !== 'pending') {
            return back()->with('error', 'Only pending DTR records can be approved.');
        }

        $hrDtrStatus->update([
            'status' => 'approved',
            'reviewed_by' => $request->user('admin')?->id,
            'reviewed_at' => now(),
        ]);

        return back()->with('success', 'DTR record approved.');
    }

    public function rejectDtr(Request $request, HrDtrStatus $hrDtrStatus): RedirectResponse
    {
        if ($hrDtrStatus->status !== 'pending') {
            return back()->with('error', 'Only pending DTR records can be rejected.');
        }

        $hrDtrStatus->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user('admin')?->id,
            'reviewed_at' => now(),
        ]);

        $hrDtrStatus->load('dtrRecord.faculty.user');
        $facultyUser = $hrDtrStatus->dtrRecord?->faculty?->user;
        $adminUsers = User::role(['super_admin', 'admin', 'hr_admin', 'hr_staff'], 'admin')->get();

        if ($facultyUser) {
            $facultyUser->notify(new HrDtrRejectedNotification($hrDtrStatus, 'faculty'));
        }

        Notification::send(
            $adminUsers,
            new HrDtrRejectedNotification($hrDtrStatus, 'admin')
        );

        return back()->with('success', 'DTR record rejected.');
    }

    /**
     * @param  array<int, int>  $syncDays
     */
    private function nextSyncLabel(array $syncDays, Carbon $now): string
    {
        foreach ($syncDays as $day) {
            if ($day >= $now->day) {
                return $now->copy()->day(min($day, $now->daysInMonth))->format('F j, Y');
            }
        }

        return $now->copy()->addMonthNoOverflow()->day(min($syncDays[0] ?? 15, $now->copy()->addMonthNoOverflow()->daysInMonth))->format('F j, Y');
    }

    private function formatDtrRecord(HrDtrStatus $status, AttendanceToDtrService $dtrService): array
    {
        $record = $status->dtrRecord;
        $summary = $record ? $this->liveDtrSummary($status, $dtrService) : [];

        return [
            'id' => $status->id,
            'facultyId' => $record?->faculty_id,
            'faculty' => $record?->faculty?->full_name ?? 'Unknown Faculty',
            'facultyCode' => $record?->faculty?->faculty_code ?? 'N/A',
            'department' => $record?->faculty?->department?->code
                ?? $record?->faculty?->department?->name
                ?? 'N/A',
            'period' => $this->formatHrPeriod($status),
            'month' => (int) ($record?->month ?? $status->period_start?->month),
            'year' => (int) ($record?->year ?? $status->period_start?->year),
            'startDay' => $status->period_start?->day,
            'endDay' => $status->period_end?->day,
            'status' => $status->status,
            'daysPresent' => (int) ($summary['daysPresent'] ?? 0),
            'daysAbsent' => (int) ($summary['daysAbsent'] ?? 0),
            'daysLate' => (int) ($summary['timesLate'] ?? 0),
            'lateMinutes' => (int) ($summary['totalLateMinutes'] ?? 0),
            'undertimeMinutes' => (int) ($summary['totalUndertimeMinutes'] ?? 0),
            'overtimeMinutes' => (int) ($summary['totalOvertimeMinutes'] ?? 0),
            'hoursRendered' => (float) ($summary['totalHoursRendered'] ?? 0),
            'hoursRequired' => (float) ($summary['totalRequiredHours'] ?? 0),
            'generatedAt' => $status->created_at?->format('M j, Y g:i A'),
            'approvedAt' => $status->reviewed_at?->format('M j, Y g:i A'),
            'approvedBy' => $status->reviewedBy?->username ?? $status->reviewedBy?->email,
            'scheduleCards' => $record ? $this->formatScheduleCards($record) : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function liveDtrSummary(HrDtrStatus $status, AttendanceToDtrService $dtrService): array
    {
        $record = $status->dtrRecord;

        if (! $record) {
            return [];
        }

        $conversion = $dtrService->convertToDtr(
            (int) $record->faculty_id,
            (int) $record->month,
            (int) $record->year,
            $status->period_start?->day,
            $status->period_end?->day,
        );

        return $conversion['summary'] ?? [];
    }

    private function hrStatusCount(string $status): int
    {
        return HrDtrStatus::query()
            ->where('status', $status)
            ->count();
    }

    private function formatHrPeriod(HrDtrStatus $status): string
    {
        if (! $status->period_start || ! $status->period_end) {
            $record = $status->dtrRecord;

            return $record
                ? Carbon::create($record->year, $record->month, 1)->format('F Y')
                : 'Unknown Period';
        }

        return $status->period_start->format('M j').' - '.$status->period_end->format('M j, Y');
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function formatScheduleCards(DtrRecord $record): array
    {
        $faculty = $record->faculty;

        if (! $faculty) {
            return [];
        }

        $targetSchedule = $faculty->schedules
            ->first(fn ($schedule): bool => (int) $schedule->academic_year === (int) $record->year)
            ?? $faculty->schedules->first();

        if (! $targetSchedule) {
            return [];
        }

        return $targetSchedule->scheduleDetails
            ->sortBy(fn ($detail): string => sprintf(
                '%02d-%s',
                $this->weekdayOrder((string) $detail->day),
                $detail->start_time ? Carbon::parse($detail->start_time)->format('H:i:s') : '99:99:99',
            ))
            ->values()
            ->map(fn ($detail): array => [
                'id' => (string) $detail->id,
                'courseCode' => (string) ($detail->course_code ?? 'N/A'),
                'courseTitle' => (string) ($detail->course_title ?? $detail->subject_desc ?? 'Untitled subject'),
                'section' => (string) ($detail->section_name ?? 'N/A'),
                'program' => (string) ($detail->program_code ?? ''),
                'day' => (string) $detail->day,
                'time' => $this->formatScheduleTime($detail->start_time, $detail->end_time),
                'room' => (string) ($detail->room_code ?? ''),
                'semester' => 'A.Y. '.$targetSchedule->academic_year.' · Semester '.$targetSchedule->semester,
            ])
            ->all();
    }

    private function formatScheduleTime(mixed $startTime, mixed $endTime): string
    {
        if (! $startTime || ! $endTime) {
            return 'N/A';
        }

        return Carbon::parse($startTime)->format('g:i A').' - '.Carbon::parse($endTime)->format('g:i A');
    }

    private function weekdayOrder(string $day): int
    {
        return match (strtolower(trim($day))) {
            'monday' => 1,
            'tuesday' => 2,
            'wednesday' => 3,
            'thursday' => 4,
            'friday' => 5,
            'saturday' => 6,
            'sunday' => 7,
            default => 99,
        };
    }
}
