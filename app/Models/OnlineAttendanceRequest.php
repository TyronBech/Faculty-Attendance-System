<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OnlineAttendanceRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'online_attendance';

    protected $fillable = [
        'faculty_id',
        'schedule_detail_id',
        'internal_schedule_id',
        'class_type',
        'attendance_date',
        'time_in',
        'time_out',
        'screenshot_in',
        'screenshot_out',
        'remarks',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships                                                     */
    /* ------------------------------------------------------------------ */

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function scheduleDetail(): BelongsTo
    {
        return $this->belongsTo(ScheduleDetail::class);
    }

    public function internalSchedule(): BelongsTo
    {
        return $this->belongsTo(InternalSchedule::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(RequestAttachment::class, 'attachmentable');
    }

    /* ------------------------------------------------------------------ */
    /*  Scopes                                                            */
    /* ------------------------------------------------------------------ */

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    /* ------------------------------------------------------------------ */
    /*  Faculty Query: paginated own requests                             */
    /* ------------------------------------------------------------------ */

    /**
     * Get paginated online attendance requests for a specific faculty member.
     */
    public static function getForFaculty(int $facultyId, Request $request): array
    {
        $perPage = (int) $request->query('per_page', 10);
        $page = (int) $request->query('page', 1);
        $status = $request->query('status', '');

        $query = static::with(['scheduleDetail.schedule', 'internalSchedule', 'reviewedBy'])
            ->where('faculty_id', $facultyId)
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        $formatted = $items->map(function (self $req) {
            $detail = $req->scheduleDetail;
            $internal = $req->internalSchedule;

            return [
                'id' => $req->id,
                'class_type' => $req->class_type,
                'attendance_date' => $req->attendance_date?->format('M d, Y'),
                'time_in' => Carbon::parse($req->time_in)->format('h:i A'),
                'time_out' => Carbon::parse($req->time_out)->format('h:i A'),
                'screenshot_in' => $req->screenshot_in ? Storage::url($req->screenshot_in) : null,
                'screenshot_out' => $req->screenshot_out ? Storage::url($req->screenshot_out) : null,
                'remarks' => $req->remarks,
                'status' => $req->status,
                'subject_code' => $detail?->course_code ?? '',
                'subject_desc' => $detail?->subject_desc ?? 'Operational Duty',
                'program_code' => $detail?->program_code ?? null,
                'year_level' => $detail?->year_level ?? null,
                'section_name' => $detail?->section_name ?? null,
                'is_official' => $detail !== null,
                'type' => $detail ? 'Official Class' : 'Internal Duty',
                'day' => $detail?->day ?? $internal?->day_of_week,
                'start_time' => Carbon::parse($req->time_in)->format('h:i A'),
                'end_time' => Carbon::parse($req->time_out)->format('h:i A'),
                'reviewed_by' => $req->reviewedBy?->email ?? null,
                'reviewed_at' => $req->reviewed_at?->format('M d, Y h:i A'),
                'review_remarks' => $req->review_remarks,
                'created_at' => $req->created_at?->format('M d, Y h:i A'),
            ];
        })->toArray();

        return [
            'data' => $formatted,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) ceil($total / max($perPage, 1)),
        ];
    }

    /**
     * Get paginated online attendance requests for admin approval.
     */
    public static function getForAdmin(Request $request): array
    {
        $perPage = (int) $request->query('per_page', 10);
        $page = (int) $request->query('page', 1);
        $status = $request->query('status', '');
        $search = $request->query('search', '');

        // Build the base query with optimized column selection
        $query = static::select([
            'id',
            'faculty_id',
            'schedule_detail_id',
            'class_type',
            'attendance_date',
            'time_in',
            'time_out',
            'screenshot_in',
            'screenshot_out',
            'remarks',
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_remarks',
            'created_at'
        ])
            ->with([
                'faculty:id,first_name,last_name,user_id',
                'faculty.user:id,email',
                'scheduleDetail:id,course_code,subject_desc,day',
                'scheduleDetail.schedule:id',
                'internalSchedule',
                'reviewedBy:id,email'
            ])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                // Search by full name (first_name + last_name)
                $q->whereHas('faculty', function ($faculty) use ($search) {
                    $faculty->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%");
                })
                    // Search faculty email (via user relationship)
                    ->orWhere(function ($q2) use ($search) {
                        $q2->whereHas('faculty', function ($faculty) use ($search) {
                            $faculty->whereHas('user', function ($user) use ($search) {
                                $user->where('email', 'like', "%{$search}%");
                            });
                        });
                    })
                    // Search in remarks
                    ->orWhere('remarks', 'like', "%{$search}%");
            });
        }

        // Count total before pagination
        $total = $query->count();

        // Fetch paginated items
        $items = $query->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $formatted = $items->map(function (self $req) {
            $detail = $req->scheduleDetail;
            $faculty = $req->faculty;
            $internal = $req->internalSchedule;

            return [
                'id' => $req->id,
                'faculty_id' => $req->faculty_id,
                'faculty_name' => $faculty ? "{$faculty->first_name} {$faculty->last_name}" : 'N/A',
                'faculty_email' => $faculty?->user?->email ?? 'N/A',
                'class_type' => $req->class_type,
                'attendance_date' => $req->attendance_date?->format('M d, Y'),
                'time_in' => Carbon::parse($req->time_in)->format('h:i A'),
                'time_out' => $req->time_out ? Carbon::parse($req->time_out)->format('h:i A') : 'N/A',
                'screenshot_in' => $req->screenshot_in ? Storage::url($req->screenshot_in) : null,
                'screenshot_out' => $req->screenshot_out ? Storage::url($req->screenshot_out) : null,
                'remarks' => $req->remarks,
                'status' => $req->status,
                'subject_code' => $detail->course_code ?? '',
                'subject_desc' => $detail?->subject_desc ?? 'Operational Duty',
                'program_code' => $detail?->program_code ?? null,
                'year_level' => $detail?->year_level ?? null,
                'section_name' => $detail?->section_name ?? null,
                'is_official' => $detail !== null,
                'type' => $detail ? 'Official Class' : 'Internal Duty',
                'day' => $detail?->day ?? $internal?->day_of_week ?? 'N/A',
                'start_time' => Carbon::parse($req->time_in)->format('h:i A'),
                'end_time' => $req->time_out ? Carbon::parse($req->time_out)->format('h:i A') : 'N/A',
                'reviewed_by' => $req->reviewedBy?->email ?? null,
                'reviewed_at' => $req->reviewed_at?->format('M d, Y h:i A'),
                'review_remarks' => $req->review_remarks,
                'created_at' => $req->created_at?->format('M d, Y h:i A'),
            ];
        })->toArray();

        return [
            'data' => $formatted,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) ceil($total / max($perPage, 1)),
        ];
    }
}
