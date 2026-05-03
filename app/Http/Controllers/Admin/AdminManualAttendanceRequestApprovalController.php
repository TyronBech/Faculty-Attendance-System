<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ApproveManualAttendanceRequest;
use App\Http\Requests\Admin\RejectManualAttendanceRequest;
use App\Http\Requests\Admin\UpdateManualAttendanceRequestLimitRequest;
use App\Models\AttendanceJustification;
use App\Models\AttendanceRecord;
use App\Models\Faculty;
use App\Models\InternalSchedule;
use App\Models\ScheduleDetail;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class AdminManualAttendanceRequestApprovalController extends Controller
{
    public function index(Request $request): Response
    {
        $paginator = $this->buildPaginator($request);
        $manualLogLimit = SystemSetting::manualAttendanceRequestLimit();

        return Inertia::render('Admin/ManualAttendanceRequestApproval', [
            'requests' => $this->formatRequests($paginator, $manualLogLimit),
            'paginator' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'path' => $paginator->path(),
            ],
            'filters' => [
                'search' => (string) $request->query('search', ''),
                'status' => (string) $request->query('status', ''),
            ],
            'pendingCount' => AttendanceJustification::query()
                ->where('type', 'manual_time')
                ->where('status', 'pending')
                ->count(),
            'manualLogLimit' => $manualLogLimit,
        ]);
    }

    public function filter(Request $request)
    {
        $paginator = $this->buildPaginator($request);
        $manualLogLimit = SystemSetting::manualAttendanceRequestLimit();

        return response()->json([
            'data' => $this->formatRequests($paginator, $manualLogLimit),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'path' => $paginator->path(),
            ],
            'manualLogLimit' => $manualLogLimit,
        ]);
    }

    public function updateLimit(UpdateManualAttendanceRequestLimitRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        SystemSetting::query()->updateOrCreate(
            ['setting_key' => 'manual_attendance_request_limit'],
            [
                'setting_value' => (string) $validated['manual_request_limit'],
                'setting_type' => 'integer',
                'description' => 'Maximum counted manual attendance requests allowed per faculty each semester.',
                'is_editable' => true,
                'updated_by' => $request->user('admin')?->id,
            ],
        );

        return back()->with('success', 'Manual attendance request limit updated successfully.');
    }

    public function approve(ApproveManualAttendanceRequest $request, AttendanceJustification $justification)
    {
        if ($justification->type !== 'manual_time') {
            return back()->with('error', 'Invalid manual attendance request.');
        }

        if ($justification->status !== 'pending') {
            return back()->with('error', 'This request has already been reviewed.');
        }

        $validated = $request->validated();

        try {
            $countAsManualLog = $request->boolean('count_manual_log', true);
            $manualLogLimit = SystemSetting::manualAttendanceRequestLimit();

            DB::transaction(function () use ($justification, $validated, $request, $countAsManualLog, $manualLogLimit): void {
                $locked = AttendanceJustification::query()
                    ->whereKey($justification->id)
                    ->with([
                        'attendanceRecord',
                        'attendanceRecord.scheduleDetail.schedule',
                        'attendanceRecord.internalSchedule.schedule',
                    ])
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending' || $locked->type !== 'manual_time') {
                    throw new RuntimeException('This request has already been reviewed.');
                }

                if (! $locked->attendanceRecord) {
                    throw new RuntimeException('Attendance record was not found for this request.');
                }

                $attendanceRecord = $locked->attendanceRecord;
                $scheduleWindow = $this->resolveScheduleWindow($attendanceRecord);

                if ($scheduleWindow === null) {
                    throw new RuntimeException('No matching schedule was found for this attendance date.');
                }

                if ($countAsManualLog) {
                    $usedManualLogs = $this->countApprovedManualLogsInSemester(
                        facultyId: (int) $locked->faculty_id,
                        academicYear: $scheduleWindow['academic_year'],
                        semester: $scheduleWindow['semester'],
                        excludedJustificationId: (int) $locked->id,
                    );

                    if ($usedManualLogs >= $manualLogLimit) {
                        throw new RuntimeException("This faculty already reached the maximum of {$manualLogLimit} counted manual logs for this semester.");
                    }
                }

                $this->applyApprovedManualTimes(
                    attendanceRecord: $attendanceRecord,
                    request: $locked,
                    scheduleWindow: $scheduleWindow,
                );

                $locked->update([
                    'status' => 'approved',
                    'reviewed_by' => $request->user('admin')?->id,
                    'reviewed_at' => now(),
                    'review_remarks' => $validated['review_remarks'] ?? null,
                    'counts_as_manual_log' => $countAsManualLog,
                ]);
            });
        } catch (RuntimeException $exception) {
            return back()->with('error', $exception->getMessage());
        }

        $message = 'Manual attendance request approved successfully.';
        if (! $request->boolean('count_manual_log', true)) {
            $message .= ' This approval was not counted toward the semester manual-log limit.';
        }

        return back()->with('success', $message);
    }

    public function reject(RejectManualAttendanceRequest $request, AttendanceJustification $justification)
    {
        if ($justification->type !== 'manual_time') {
            return back()->with('error', 'Invalid manual attendance request.');
        }

        if ($justification->status !== 'pending') {
            return back()->with('error', 'This request has already been reviewed.');
        }

        $validated = $request->validated();

        try {
            DB::transaction(function () use ($justification, $validated, $request): void {
                $locked = AttendanceJustification::query()
                    ->whereKey($justification->id)
                    ->lockForUpdate()
                    ->first();

                if (! $locked || $locked->status !== 'pending' || $locked->type !== 'manual_time') {
                    throw new RuntimeException('This request has already been reviewed.');
                }

                $locked->update([
                    'status' => 'rejected',
                    'reviewed_by' => $request->user('admin')?->id,
                    'reviewed_at' => now(),
                    'review_remarks' => $validated['review_remarks'],
                ]);
            });
        } catch (RuntimeException $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', 'Manual attendance request rejected.');
    }

    private function buildPaginator(Request $request): LengthAwarePaginator
    {
        $query = AttendanceJustification::query()
            ->where('type', 'manual_time')
            ->with([
                'faculty:id,first_name,last_name,user_id',
                'faculty.user:id,email',
                'attendanceRecord:id,faculty_id,schedule_detail_id,internal_schedule_id,attendance_date,actual_time_in,actual_time_out,official_time_in,official_time_out,operational_time_in,operational_time_out,status',
                'attendanceRecord.scheduleDetail:id,schedule_id,day,start_time,end_time,course_code,subject_desc,room_code,hours_required',
                'attendanceRecord.scheduleDetail.schedule:id,academic_year,semester,effective_from,effective_until,status',
                'attendanceRecord.internalSchedule:id,schedule_id,faculty_id,day_of_week,device_time_in,device_time_out,is_operational,required_hours',
                'attendanceRecord.internalSchedule.schedule:id,academic_year,semester,effective_from,effective_until,status',
                'reviewer:id,email,username',
                'reviewer.admin:id,user_id,first_name,middle_name,last_name,suffix_name',
            ])
            ->orderByDesc('created_at');

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('justification', 'like', "%{$search}%")
                    ->orWhereHas('faculty', function ($facultyQuery) use ($search): void {
                        $facultyQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                    })
                    ->orWhereHas('faculty.user', function ($userQuery) use ($search): void {
                        $userQuery->where('email', 'like', "%{$search}%");
                    });
            });
        }

        $status = (string) $request->query('status', '');
        if ($status !== '') {
            $query->where('status', $status);
        }

        return $query->paginate(15);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function formatRequests(LengthAwarePaginator $paginator, int $manualLogLimit): array
    {
        $manualCountCache = [];

        return $paginator->getCollection()->map(function (AttendanceJustification $justification) use (&$manualCountCache, $manualLogLimit): array {
            $record = $justification->attendanceRecord;
            $scheduleWindow = $record ? $this->resolveScheduleWindow($record) : null;

            $semesterLabel = null;
            $usedCount = null;

            if ($scheduleWindow !== null) {
                $semesterLabel = "AY {$scheduleWindow['academic_year']} - Semester {$scheduleWindow['semester']}";
                $cacheKey = $justification->faculty_id.':'.$scheduleWindow['academic_year'].':'.$scheduleWindow['semester'];

                if (! array_key_exists($cacheKey, $manualCountCache)) {
                    $manualCountCache[$cacheKey] = $this->countApprovedManualLogsInSemester(
                        facultyId: (int) $justification->faculty_id,
                        academicYear: $scheduleWindow['academic_year'],
                        semester: $scheduleWindow['semester'],
                    );
                }

                $usedCount = $manualCountCache[$cacheKey];
            }

            $reviewerName = $justification->reviewer?->admin?->full_name;

            if (blank($reviewerName)) {
                $reviewerName = $justification->reviewer?->username;
            }

            return [
                'id' => $justification->id,
                'faculty_name' => $justification->faculty ? trim("{$justification->faculty->first_name} {$justification->faculty->last_name}") : 'Unknown',
                'faculty_email' => $justification->faculty?->user?->email,
                'attendance_date' => $record?->attendance_date?->format('M d, Y'),
                'attendance_date_iso' => $record?->attendance_date?->format('Y-m-d'),
                'requested_time_in' => $justification->requested_time_in?->format('h:i A'),
                'requested_time_out' => $justification->requested_time_out?->format('h:i A'),
                'current_actual_time_in' => $record?->actual_time_in?->format('h:i A'),
                'current_actual_time_out' => $record?->actual_time_out?->format('h:i A'),
                'schedule_source' => $scheduleWindow['source'] ?? null,
                'course_code' => $record?->scheduleDetail?->course_code,
                'subject_desc' => $record?->scheduleDetail?->subject_desc,
                'room_code' => $record?->scheduleDetail?->room_code,
                'justification' => $justification->justification,
                'attachment_url' => $justification->getAttachmentUrl(),
                'attachments_data' => $justification->getAttachmentsData(),
                'status' => $justification->status,
                'review_remarks' => $justification->review_remarks,
                'reviewed_at' => $justification->reviewed_at?->format('M d, Y h:i A'),
                'reviewer_name' => $reviewerName,
                'reviewer_email' => $justification->reviewer?->email,
                'created_at' => $justification->created_at?->format('M d, Y h:i A'),
                'updated_at' => $justification->updated_at?->format('M d, Y h:i A'),
                'counts_as_manual_log' => (bool) $justification->counts_as_manual_log,
                'semester_label' => $semesterLabel,
                'used_manual_logs' => $usedCount,
                'manual_log_limit' => $manualLogLimit,
            ];
        })->values()->all();
    }

    /**
     * @return array{
     *     source: string,
     *     schedule_detail_id: int|null,
     *     internal_schedule_id: int|null,
     *     official_time_in: Carbon,
     *     official_time_out: Carbon,
     *     operational_time_in: Carbon,
     *     operational_time_out: Carbon,
     *     required_hours: float,
     *     academic_year: int,
     *     semester: int
     * }|null
     */
    private function resolveScheduleWindow(AttendanceRecord $attendanceRecord): ?array
    {
        $attendanceDate = Carbon::parse($attendanceRecord->attendance_date)->startOfDay();
        $dayOfWeek = $attendanceDate->format('l');

        $preferredScheduleId = $attendanceRecord->scheduleDetail?->schedule_id;
        $internalSchedule = $this->resolveInternalSchedule($attendanceRecord, $dayOfWeek, $attendanceDate, $preferredScheduleId);

        if ($internalSchedule !== null) {
            $officialDetail = $this->resolveOfficialScheduleDetail(
                attendanceRecord: $attendanceRecord,
                dayOfWeek: $dayOfWeek,
                attendanceDate: $attendanceDate,
                preferredScheduleId: (int) $internalSchedule->schedule_id,
            );

            $operationalTimeIn = $this->combineDateAndTime($attendanceDate, $internalSchedule->device_time_in);
            $operationalTimeOut = $internalSchedule->device_time_out
                ? $this->combineDateAndTime($attendanceDate, $internalSchedule->device_time_out)
                : $operationalTimeIn->copy()->addHours(3);

            $officialTimeIn = $officialDetail
                ? $this->combineDateAndTime($attendanceDate, $officialDetail->start_time)
                : $operationalTimeIn->copy();
            $officialTimeOut = $officialDetail
                ? $this->resolveOfficialTimeOut($officialDetail, $attendanceDate)
                : $operationalTimeOut->copy();

            $requiredHours = (float) ($internalSchedule->required_hours ?: round(max(0, $operationalTimeIn->diffInMinutes($operationalTimeOut, false)) / 60, 2));

            if (! $internalSchedule->schedule || $internalSchedule->schedule->academic_year === null || $internalSchedule->schedule->semester === null) {
                return null;
            }

            return [
                'source' => 'internal',
                'schedule_detail_id' => $officialDetail?->id,
                'internal_schedule_id' => $internalSchedule->id,
                'official_time_in' => $officialTimeIn,
                'official_time_out' => $officialTimeOut,
                'operational_time_in' => $operationalTimeIn,
                'operational_time_out' => $operationalTimeOut,
                'required_hours' => $requiredHours,
                'academic_year' => (int) $internalSchedule->schedule->academic_year,
                'semester' => (int) $internalSchedule->schedule->semester,
            ];
        }

        $officialDetail = $this->resolveOfficialScheduleDetail(
            attendanceRecord: $attendanceRecord,
            dayOfWeek: $dayOfWeek,
            attendanceDate: $attendanceDate,
            preferredScheduleId: $preferredScheduleId,
        );

        if ($officialDetail === null || ! $officialDetail->schedule || $officialDetail->schedule->academic_year === null || $officialDetail->schedule->semester === null) {
            return null;
        }

        $officialTimeIn = $this->combineDateAndTime($attendanceDate, $officialDetail->start_time);
        $officialTimeOut = $this->resolveOfficialTimeOut($officialDetail, $attendanceDate);
        $requiredHours = (float) ($officialDetail->hours_required ?: round(max(0, $officialTimeIn->diffInMinutes($officialTimeOut, false)) / 60, 2));

        return [
            'source' => 'official',
            'schedule_detail_id' => $officialDetail->id,
            'internal_schedule_id' => null,
            'official_time_in' => $officialTimeIn,
            'official_time_out' => $officialTimeOut,
            'operational_time_in' => $officialTimeIn->copy(),
            'operational_time_out' => $officialTimeOut->copy(),
            'required_hours' => $requiredHours,
            'academic_year' => (int) $officialDetail->schedule->academic_year,
            'semester' => (int) $officialDetail->schedule->semester,
        ];
    }

    private function resolveInternalSchedule(
        AttendanceRecord $attendanceRecord,
        string $dayOfWeek,
        Carbon $attendanceDate,
        ?int $preferredScheduleId = null,
    ): ?InternalSchedule {
        $scheduleFacultyId = $this->resolveScheduleFacultyId((int) $attendanceRecord->faculty_id);
        $currentInternal = $attendanceRecord->internalSchedule;

        if (
            $currentInternal
            && $currentInternal->day_of_week === $dayOfWeek
            && (bool) $currentInternal->is_operational
            && $currentInternal->schedule
            && $this->isScheduleEffective($currentInternal->schedule->effective_from, $currentInternal->schedule->effective_until, $attendanceDate)
        ) {
            return $currentInternal;
        }

        $query = InternalSchedule::query()
            ->with('schedule')
            ->where('faculty_id', $scheduleFacultyId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_operational', true)
            ->whereHas('schedule', function ($scheduleQuery) use ($scheduleFacultyId, $attendanceDate): void {
                $scheduleQuery->where('faculty_id', $scheduleFacultyId)
                    ->where('status', 'active')
                    ->whereDate('effective_from', '<=', $attendanceDate->toDateString())
                    ->whereDate('effective_until', '>=', $attendanceDate->toDateString());
            });

        if ($preferredScheduleId !== null) {
            $query->orderByRaw('CASE WHEN schedule_id = ? THEN 0 ELSE 1 END', [$preferredScheduleId]);
        }

        return $query
            ->orderBy('device_time_in')
            ->first();
    }

    private function resolveOfficialScheduleDetail(
        AttendanceRecord $attendanceRecord,
        string $dayOfWeek,
        Carbon $attendanceDate,
        ?int $preferredScheduleId = null,
    ): ?ScheduleDetail {
        $scheduleFacultyId = $this->resolveScheduleFacultyId((int) $attendanceRecord->faculty_id);
        $currentDetail = $attendanceRecord->scheduleDetail;

        if (
            $currentDetail
            && $currentDetail->day === $dayOfWeek
            && $currentDetail->schedule
            && $this->isScheduleEffective($currentDetail->schedule->effective_from, $currentDetail->schedule->effective_until, $attendanceDate)
        ) {
            return $currentDetail;
        }

        $query = ScheduleDetail::query()
            ->with('schedule')
            ->where('day', $dayOfWeek)
            ->whereHas('schedule', function ($scheduleQuery) use ($scheduleFacultyId, $attendanceDate): void {
                $scheduleQuery->where('faculty_id', $scheduleFacultyId)
                    ->where('status', 'active')
                    ->whereDate('effective_from', '<=', $attendanceDate->toDateString())
                    ->whereDate('effective_until', '>=', $attendanceDate->toDateString());
            });

        if ($preferredScheduleId !== null) {
            $query->orderByRaw('CASE WHEN schedule_id = ? THEN 0 ELSE 1 END', [$preferredScheduleId]);
        }

        return $query
            ->orderBy('start_time')
            ->first();
    }

    private function applyApprovedManualTimes(
        AttendanceRecord $attendanceRecord,
        AttendanceJustification $request,
        array $scheduleWindow,
    ): void {
        if (! $request->requested_time_in || ! $request->requested_time_out) {
            throw new RuntimeException('Requested time-in and time-out are required for approval.');
        }

        $actualTimeIn = Carbon::parse($request->requested_time_in);
        $actualTimeOut = Carbon::parse($request->requested_time_out);

        if ($actualTimeOut->lessThanOrEqualTo($actualTimeIn)) {
            throw new RuntimeException('Requested time-out must be later than requested time-in.');
        }

        $operationalTimeIn = $scheduleWindow['operational_time_in'];
        $operationalTimeOut = $scheduleWindow['operational_time_out'];

        $lateMinutes = $actualTimeIn->greaterThan($operationalTimeIn)
            ? $operationalTimeIn->diffInMinutes($actualTimeIn)
            : 0;

        $undertimeMinutes = $actualTimeOut->lessThan($operationalTimeOut)
            ? $actualTimeOut->diffInMinutes($operationalTimeOut)
            : 0;

        $overtimeMinutes = $actualTimeOut->greaterThan($operationalTimeOut)
            ? $operationalTimeOut->diffInMinutes($actualTimeOut)
            : 0;

        $totalMinutesRendered = max(0, $actualTimeIn->diffInMinutes($actualTimeOut, false));
        $totalHoursRendered = round($totalMinutesRendered / 60, 2);

        $attendanceRecord->fill([
            'schedule_detail_id' => $scheduleWindow['schedule_detail_id'],
            'internal_schedule_id' => $scheduleWindow['internal_schedule_id'],
            'day_of_week' => $attendanceRecord->attendance_date->format('l'),
            'official_time_in' => $scheduleWindow['official_time_in'],
            'official_time_out' => $scheduleWindow['official_time_out'],
            'operational_day_of_week' => $attendanceRecord->attendance_date->format('l'),
            'operational_time_in' => $operationalTimeIn,
            'operational_time_out' => $operationalTimeOut,
            'actual_time_in' => $actualTimeIn,
            'actual_time_out' => $actualTimeOut,
            'late_minutes' => $lateMinutes,
            'undertime_minutes' => $undertimeMinutes,
            'overtime_minutes' => $overtimeMinutes,
            'night_minutes' => 0,
            'overtime_night_minutes' => 0,
            'total_hours_rendered' => $totalHoursRendered,
            'required_hours' => $scheduleWindow['required_hours'],
            'status' => $this->resolveAttendanceStatus($lateMinutes, $overtimeMinutes),
            'remarks' => "Manual attendance approved via request #{$request->id}",
            'is_manual_entry' => true,
            'processed_at' => now(),
        ]);

        $attendanceRecord->save();
    }

    private function resolveAttendanceStatus(int $lateMinutes, int $overtimeMinutes): string
    {
        if ($lateMinutes > 0 && $overtimeMinutes > 0) {
            return 'late_overtime';
        }

        if ($lateMinutes > 0) {
            return 'late';
        }

        if ($overtimeMinutes > 0) {
            return 'overtime';
        }

        return 'present';
    }

    private function combineDateAndTime(Carbon $date, string|Carbon $time): Carbon
    {
        $timeValue = $time instanceof Carbon ? $time : Carbon::parse($time);

        return $date->copy()->setTime($timeValue->hour, $timeValue->minute, $timeValue->second);
    }

    private function resolveOfficialTimeOut(ScheduleDetail $detail, Carbon $attendanceDate): Carbon
    {
        if ($detail->end_time) {
            return $this->combineDateAndTime($attendanceDate, $detail->end_time);
        }

        $start = $this->combineDateAndTime($attendanceDate, $detail->start_time);
        $durationMinutes = max(60, (int) round(((float) ($detail->hours_required ?? 1)) * 60));

        return $start->copy()->addMinutes($durationMinutes);
    }

    private function isScheduleEffective(mixed $effectiveFrom, mixed $effectiveUntil, Carbon $attendanceDate): bool
    {
        if (! $effectiveFrom || ! $effectiveUntil) {
            return false;
        }

        $start = Carbon::parse($effectiveFrom)->startOfDay();
        $end = Carbon::parse($effectiveUntil)->endOfDay();

        return $attendanceDate->betweenIncluded($start, $end);
    }

    private function countApprovedManualLogsInSemester(
        int $facultyId,
        int $academicYear,
        int $semester,
        ?int $excludedJustificationId = null,
    ): int {
        return DB::table('attendance_justifications as aj')
            ->leftJoin('attendance_records as ar', 'ar.id', '=', 'aj.attendance_record_id')
            ->leftJoin('internal_schedules as ins', 'ins.id', '=', 'ar.internal_schedule_id')
            ->leftJoin('schedule_details as sd', 'sd.id', '=', 'ar.schedule_detail_id')
            ->leftJoin('schedules as internal_schedule', 'internal_schedule.id', '=', 'ins.schedule_id')
            ->leftJoin('schedules as official_schedule', 'official_schedule.id', '=', 'sd.schedule_id')
            ->where('aj.faculty_id', $facultyId)
            ->where('aj.type', 'manual_time')
            ->where('aj.status', 'approved')
            ->where('aj.counts_as_manual_log', true)
            ->whereNull('aj.deleted_at')
            ->whereRaw('COALESCE(internal_schedule.academic_year, official_schedule.academic_year) = ?', [$academicYear])
            ->whereRaw('COALESCE(internal_schedule.semester, official_schedule.semester) = ?', [$semester])
            ->when($excludedJustificationId !== null, function ($query) use ($excludedJustificationId): void {
                $query->where('aj.id', '!=', $excludedJustificationId);
            })
            ->count('aj.id');
    }

    private function resolveScheduleFacultyId(int $attendanceFacultyId): int
    {
        $externalMatch = Faculty::query()
            ->where('external_faculty_id', $attendanceFacultyId)
            ->value('id');

        if (! empty($externalMatch)) {
            return (int) $externalMatch;
        }

        return $attendanceFacultyId;
    }
}
