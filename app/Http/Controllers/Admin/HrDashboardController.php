<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DtrRecord;
use App\Models\Faculty;
use App\Models\HrDtrStatus;
use App\Models\ImportBatch;
use App\Models\SystemSetting;
use App\Services\AttendanceToDtrService;
use App\Services\HrDtrSyncService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'pendingDtrs' => DtrRecord::query()
                ->with([
                    'faculty:id,first_name,middle_name,last_name,department_id',
                    'hrStatus',
                ])
                ->where(function ($query): void {
                    $query
                        ->whereDoesntHave('hrStatus')
                        ->orWhereHas('hrStatus', fn ($hrStatusQuery) => $hrStatusQuery->where('status', 'pending'));
                })
                ->latest('generated_at')
                ->limit(10)
                ->get()
                ->map(fn (DtrRecord $record): array => [
                    'id' => $record->id,
                    'faculty' => $record->faculty?->full_name ?? 'Unknown Faculty',
                    'period' => Carbon::create($record->year, $record->month, 1)->format('F Y'),
                    'lateMinutes' => (int) $record->total_late_minutes,
                    'undertimeMinutes' => (int) $record->total_undertime_minutes,
                    'generatedAt' => $record->generated_at?->format('M j, Y g:i A'),
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

        $records = DtrRecord::query()
            ->with([
                'faculty:id,first_name,middle_name,last_name,department_id,faculty_code',
                'faculty.department:id,name,code',
                'faculty.schedules' => fn ($query) => $query
                    ->where('status', 'active')
                    ->with('scheduleDetails')
                    ->orderByDesc('academic_year')
                    ->orderByDesc('semester'),
                'hrStatus.reviewedBy:id,username,email',
            ])
            ->when($status === 'pending', function ($query): void {
                $query->where(function ($statusQuery): void {
                    $statusQuery
                        ->whereDoesntHave('hrStatus')
                        ->orWhereHas('hrStatus', fn ($hrStatusQuery) => $hrStatusQuery->where('status', 'pending'));
                });
            })
            ->when(in_array($status, ['approved', 'rejected'], true), function ($query) use ($status): void {
                $query->whereHas('hrStatus', fn ($hrStatusQuery) => $hrStatusQuery->where('status', $status));
            })
            ->when($month, fn ($query) => $query->where('month', $month))
            ->when($year, fn ($query) => $query->where('year', $year))
            ->when($search !== '', function ($query) use ($search): void {
                $query->whereHas('faculty', function ($facultyQuery) use ($search): void {
                    $facultyQuery
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('middle_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('faculty_code', 'like', "%{$search}%");
                });
            })
            ->latest('generated_at')
            ->latest('updated_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (DtrRecord $record): array => $this->formatDtrRecord($record, $dtrService));

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

        return back()->with(
            'success',
            "HR DTR sync completed: {$summary['created']} created, {$summary['updated']} updated, {$summary['skipped']} skipped."
        );
    }

    public function approveDtr(Request $request, DtrRecord $dtrRecord, AttendanceToDtrService $dtrService): RedirectResponse
    {
        if ($this->currentHrStatus($dtrRecord) !== 'pending') {
            return back()->with('error', 'Only pending DTR records can be approved.');
        }

        $this->refreshDtrRecordTotals($dtrRecord, $dtrService);

        HrDtrStatus::updateOrCreate(
            ['dtr_record_id' => $dtrRecord->id],
            [
                'status' => 'approved',
                'reviewed_by' => $request->user('admin')?->id,
                'reviewed_at' => now(),
            ]
        );

        return back()->with('success', 'DTR record approved.');
    }

    public function rejectDtr(Request $request, DtrRecord $dtrRecord): RedirectResponse
    {
        if ($this->currentHrStatus($dtrRecord) !== 'pending') {
            return back()->with('error', 'Only pending DTR records can be rejected.');
        }

        HrDtrStatus::updateOrCreate(
            ['dtr_record_id' => $dtrRecord->id],
            [
                'status' => 'rejected',
                'reviewed_by' => $request->user('admin')?->id,
                'reviewed_at' => now(),
            ]
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

    private function formatDtrRecord(DtrRecord $record, AttendanceToDtrService $dtrService): array
    {
        $summary = $this->liveDtrSummary($record, $dtrService);

        return [
            'id' => $record->id,
            'facultyId' => $record->faculty_id,
            'faculty' => $record->faculty?->full_name ?? 'Unknown Faculty',
            'facultyCode' => $record->faculty?->faculty_code ?? 'N/A',
            'department' => $record->faculty?->department?->code
                ?? $record->faculty?->department?->name
                ?? 'N/A',
            'period' => Carbon::create($record->year, $record->month, 1)->format('F Y'),
            'month' => (int) $record->month,
            'year' => (int) $record->year,
            'status' => $record->hrStatus?->status ?? 'pending',
            'daysPresent' => (int) ($summary['daysPresent'] ?? $record->total_days_present),
            'daysAbsent' => (int) ($summary['daysAbsent'] ?? $record->total_days_absent),
            'daysLate' => (int) ($summary['timesLate'] ?? $record->total_days_late),
            'lateMinutes' => (int) ($summary['totalLateMinutes'] ?? $record->total_late_minutes),
            'undertimeMinutes' => (int) ($summary['totalUndertimeMinutes'] ?? $record->total_undertime_minutes),
            'overtimeMinutes' => (int) ($summary['totalOvertimeMinutes'] ?? 0),
            'hoursRendered' => (float) ($summary['totalHoursRendered'] ?? $record->total_hours_rendered),
            'hoursRequired' => (float) ($summary['totalRequiredHours'] ?? $record->total_hours_required),
            'generatedAt' => $record->generated_at?->format('M j, Y g:i A'),
            'approvedAt' => $record->hrStatus?->reviewed_at?->format('M j, Y g:i A'),
            'approvedBy' => $record->hrStatus?->reviewedBy?->username ?? $record->hrStatus?->reviewedBy?->email,
            'scheduleCards' => $this->formatScheduleCards($record),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function liveDtrSummary(DtrRecord $record, AttendanceToDtrService $dtrService): array
    {
        $conversion = $dtrService->convertToDtr(
            (int) $record->faculty_id,
            (int) $record->month,
            (int) $record->year,
        );

        return $conversion['summary'] ?? [];
    }

    private function refreshDtrRecordTotals(DtrRecord $record, AttendanceToDtrService $dtrService): void
    {
        $summary = $this->liveDtrSummary($record, $dtrService);

        $record->fill([
            'total_days_present' => (int) ($summary['daysPresent'] ?? $record->total_days_present),
            'total_days_absent' => (int) ($summary['daysAbsent'] ?? $record->total_days_absent),
            'total_days_late' => (int) ($summary['timesLate'] ?? $record->total_days_late),
            'total_late_minutes' => (int) ($summary['totalLateMinutes'] ?? $record->total_late_minutes),
            'total_undertime_minutes' => (int) ($summary['totalUndertimeMinutes'] ?? $record->total_undertime_minutes),
            'total_hours_rendered' => (float) ($summary['totalHoursRendered'] ?? $record->total_hours_rendered),
            'total_hours_required' => (float) ($summary['totalRequiredHours'] ?? $record->total_hours_required),
            'generated_at' => $record->generated_at ?? now(),
        ]);

        $record->save();
    }

    private function currentHrStatus(DtrRecord $record): string
    {
        return $record->hrStatus?->status ?? 'pending';
    }

    private function hrStatusCount(string $status): int
    {
        if ($status === 'pending') {
            return DtrRecord::query()
                ->where(function ($query): void {
                    $query
                        ->whereDoesntHave('hrStatus')
                        ->orWhereHas('hrStatus', fn ($hrStatusQuery) => $hrStatusQuery->where('status', 'pending'));
                })
                ->count();
        }

        return DtrRecord::query()
            ->whereHas('hrStatus', fn ($query) => $query->where('status', $status))
            ->count();
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
