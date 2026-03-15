<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use App\Models\ScheduleChangeRequest;

class Schedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'faculty_id',
        'external_faculty_id',
        'schedule_code',
        'academic_year',
        'semester',
        'effective_from',
        'effective_until',
        'status',
        'schedule_type',
        'created_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'external_faculty_id' => 'integer',
            'academic_year' => 'integer',
            'semester' => 'integer',
            'effective_from' => 'date:Y-m-d',
            'effective_until' => 'date:Y-m-d',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships                                                     */
    /* ------------------------------------------------------------------ */

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scheduleDetails(): HasMany
    {
        return $this->hasMany(ScheduleDetail::class);
    }

    public function internalSchedules(): HasMany
    {
        return $this->hasMany(InternalSchedule::class);
    }

    /* ------------------------------------------------------------------ */
    /*  Admin Query Methods (static)                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Get filtered, paginated schedules for the admin schedule management page.
     *
     * Applies search, status, type, semester, academic year, and department filters.
     */
    public static function getFilteredSchedules(Request $request): array
    {
        $perPage = (int) $request->query('per_page', 10);
        $page    = (int) $request->query('page', 1);
        $search  = $request->query('search', '');
        $status  = $request->query('status', '');
        $type    = $request->query('type', '');
        $semester = $request->query('semester', '');
        $academicYear = $request->query('academic_year', '');
        $department   = $request->query('department', '');

        $query = static::with(['faculty.department', 'scheduleDetails', 'internalSchedules', 'createdBy'])
            ->orderBy('created_at', 'desc');

        // Search
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('schedule_code', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%")
                  ->orWhereRaw('CAST(academic_year AS CHAR) LIKE ?', ["%{$search}%"])
                  ->orWhereHas('faculty', function ($fq) use ($search) {
                      $fq->where('first_name', 'like', "%{$search}%")
                         ->orWhere('last_name', 'like', "%{$search}%")
                         ->orWhere('middle_name', 'like', "%{$search}%")
                         ->orWhere('faculty_code', 'like', "%{$search}%")
                         ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                         ->orWhereRaw("CONCAT(last_name, ', ', first_name) LIKE ?", ["%{$search}%"])
                         ->orWhereRaw("CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name) LIKE ?", ["%{$search}%"]);
                  })
                  ->orWhereHas('scheduleDetails', function ($dq) use ($search) {
                      $dq->where('course_code', 'like', "%{$search}%")
                         ->orWhere('subject_desc', 'like', "%{$search}%")
                         ->orWhere('room_code', 'like', "%{$search}%")
                         ->orWhere('day', 'like', "%{$search}%");
                  });
            });
        }

        // Status filter
        if ($status) {
            $query->where('status', $status);
        }

        // Schedule type filter
        if ($type) {
            $query->where('schedule_type', $type);
        }

        // Semester filter
        if ($semester) {
            $query->where('semester', (int) $semester);
        }

        // Academic year filter
        if ($academicYear) {
            $query->where('academic_year', (int) $academicYear);
        }

        // Department filter
        if ($department) {
            $query->whereHas('faculty', function ($q) use ($department) {
                $q->where('department_id', (int) $department);
            });
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        // Pre-load all approved change requests for this page's schedules in a
        // single query, keyed by schedule_id, to avoid N+1 round-trips.
        $scheduleIds = $items->pluck('id')->all();

        $approvedRequestsBySchedule = ScheduleChangeRequest::where('status', 'approved')
            ->whereHas('scheduleDetail', function ($q) use ($scheduleIds): void {
                $q->whereIn('schedule_id', $scheduleIds);
            })
            ->with('scheduleDetail')
            ->get()
            ->groupBy(fn (ScheduleChangeRequest $r): int => $r->scheduleDetail?->schedule_id ?? 0);

        $formatted = $items->map(function (Schedule $schedule) use ($approvedRequestsBySchedule) {
            $approvedRequests = $approvedRequestsBySchedule->get($schedule->id, collect());

            return [
                'id'             => $schedule->id,
                'schedule_code'  => $schedule->schedule_code,
                'faculty_id'     => $schedule->faculty_id,
                'faculty_name'   => $schedule->faculty?->full_name ?? 'N/A',
                'department'     => $schedule->faculty?->department?->name ?? 'N/A',
                'academic_year'  => $schedule->academic_year,
                'semester'       => $schedule->semester,
                'effective_from' => $schedule->effective_from?->format('Y-m-d'),
                'effective_until' => $schedule->effective_until?->format('Y-m-d'),
                'status'         => $schedule->status,
                'schedule_type'  => $schedule->schedule_type,
                'notes'          => $schedule->notes,
                'created_by'     => $schedule->createdBy?->email ?? 'System',
                'details'        => $schedule->scheduleDetails->map(function (ScheduleDetail $d) {
                    return [
                        'id'             => $d->id,
                        'day'            => $d->day,
                        'start_time'     => Carbon::parse($d->start_time)->format('H:i'),
                        'end_time'       => Carbon::parse($d->end_time)->format('H:i'),
                        'course_code'    => $d->course_code,
                        'subject_desc'   => $d->subject_desc,
                        'room_code'      => $d->room_code,
                        'hours_required' => $d->hours_required,
                    ];
                })->toArray(),
                'internal_schedule' => $schedule->internalSchedules->map(function (InternalSchedule $entry) {
                    return [
                        'id'             => $entry->id,
                        'day'            => $entry->day_of_week,
                        'start_time'     => $entry->device_time_in ? Carbon::parse($entry->device_time_in)->format('H:i') : null,
                        'end_time'       => $entry->device_time_out ? Carbon::parse($entry->device_time_out)->format('H:i') : null,
                        'is_operational' => (bool) $entry->is_operational,
                        'required_hours' => $entry->required_hours,
                        'sync_status'    => $entry->sync_status,
                        'synced_at'      => $entry->synced_at ? Carbon::parse($entry->synced_at)->format('M d, Y h:i A') : null,
                    ];
                })->toArray(),
                'approved_change_requests' => $approvedRequests->map(function (ScheduleChangeRequest $req) {
                    $detail = $req->scheduleDetail;
                    return [
                        'id' => $req->id,
                        'schedule_detail_id' => $req->schedule_detail_id,
                        'course_code' => $detail?->course_code,
                        'subject_desc' => $detail?->subject_desc,
                        'original_day' => $detail?->day,
                        'original_start_time' => $detail?->start_time ? Carbon::parse($detail->start_time)->format('H:i') : null,
                        'original_end_time' => $detail?->end_time ? Carbon::parse($detail->end_time)->format('H:i') : null,
                        'requested_day' => $req->requested_day_of_week,
                        'requested_time_in' => $req->requested_time_in,
                        'requested_time_out' => $req->requested_time_out,
                        'requested_room' => $req->requested_room,
                    ];
                })->toArray(),
                'created_at'     => $schedule->created_at?->format('M d, Y'),
            ];
        })->toArray();

        return [
            'data'         => $formatted,
            'total'        => $total,
            'per_page'     => $perPage,
            'current_page' => $page,
            'last_page'    => (int) ceil($total / $perPage),
        ];
    }

    /**
     * Get search suggestions for the AJAX autocomplete.
     */
    public static function getSearchSuggestions(string $query): array
    {
        $schedules = static::with('faculty')
            ->where(function ($q) use ($query) {
                $q->where('schedule_code', 'like', "%{$query}%")
                  ->orWhereHas('faculty', function ($q2) use ($query) {
                      $q2->where('first_name', 'like', "%{$query}%")
                         ->orWhere('last_name', 'like', "%{$query}%")
                         ->orWhere('middle_name', 'like', "%{$query}%")
                         ->orWhere('faculty_code', 'like', "%{$query}%")
                         ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$query}%"])
                         ->orWhereRaw("CONCAT(last_name, ', ', first_name) LIKE ?", ["%{$query}%"]);
                  })
                  ->orWhereHas('scheduleDetails', function ($dq) use ($query) {
                             $dq->where('course_code', 'like', "%{$query}%")
                                 ->orWhere('room_code', 'like', "%{$query}%");
                  });
            })
            ->limit(8)
            ->get();

        return $schedules->map(fn(Schedule $s) => [
            'id'    => $s->id,
            'label' => "{$s->schedule_code} — {$s->faculty?->full_name}",
            'code'  => $s->schedule_code,
        ])->toArray();
    }
}
