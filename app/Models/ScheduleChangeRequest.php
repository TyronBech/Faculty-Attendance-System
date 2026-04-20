<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;

class ScheduleChangeRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'faculty_id',
        'schedule_detail_id',
        'requested_day_of_week',
        'requested_time_in',
        'requested_time_out',
        'requested_room',
        'effective_date',
        'reason',
        'supporting_document_path',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date:Y-m-d',
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
    /*  Admin Query: paginated all requests with faculty info            */
    /* ------------------------------------------------------------------ */

    /**
     * Get paginated change requests for admin (all faculty).
     */
    public static function getForAdmin(Request $request): array
    {
        $perPage = max(1, min((int) $request->query('per_page', 10), 100));
        $page = max(1, (int) $request->query('page', 1));
        $status = $request->query('status', '');
        $search = $request->query('search', '');
        $semester = $request->query('semester', '');
        $academicYear = $request->query('academic_year', '');

        $query = static::with(['faculty.user', 'faculty.department', 'scheduleDetail.schedule', 'reviewedBy'])
            ->orderByRaw("
                CASE
                    WHEN status = 'pending'  THEN 1
                    WHEN status = 'approved' THEN 2
                    WHEN status = 'rejected' THEN 3
                    ELSE 4
                END
            ")
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($semester || $academicYear) {
            $query->whereHas('scheduleDetail.schedule', function ($sq) use ($semester, $academicYear) {
                if ($semester !== '') {
                    $sq->where('semester', (int) $semester);
                }
                if ($academicYear !== '') {
                    $sq->where('academic_year', (int) $academicYear);
                }
            });
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                  ->orWhere('requested_day_of_week', 'like', "%{$search}%")
                  ->orWhere('requested_room', 'like', "%{$search}%")
                  ->orWhere('status', 'like', "%{$search}%")
                  ->orWhereHas('faculty', function ($fq) use ($search) {
                      $fq->where('first_name', 'like', "%{$search}%")
                         ->orWhere('last_name', 'like', "%{$search}%")
                         ->orWhere('middle_name', 'like', "%{$search}%")
                         ->orWhere('faculty_code', 'like', "%{$search}%")
                         ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                         ->orWhereRaw("CONCAT(last_name, ', ', first_name) LIKE ?", ["%{$search}%"])
                         ->orWhereRaw("CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name) LIKE ?", ["%{$search}%"])
                         ->orWhereHas('department', function ($dq) use ($search) {
                             $dq->where('name', 'like', "%{$search}%")
                                ->orWhere('code', 'like', "%{$search}%");
                         });
                  })
                  ->orWhereHas('scheduleDetail', function ($sdq) use ($search) {
                      $sdq->where('course_code', 'like', "%{$search}%")
                          ->orWhere('subject_desc', 'like', "%{$search}%")
                          ->orWhere('room_code', 'like', "%{$search}%")
                          ->orWhere('day', 'like', "%{$search}%")
                          ->orWhereHas('schedule', function ($sq) use ($search) {
                              $sq->where('schedule_code', 'like', "%{$search}%");
                          });
                  });
            });
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        $formatted = $items->map(function (self $req) {
            $detail = $req->scheduleDetail;
            $faculty = $req->faculty;

            return [
                'id' => $req->id,
                'faculty_name' => $faculty
                    ? trim($faculty->first_name . ' ' . ($faculty->middle_name ? $faculty->middle_name[0] . '. ' : '') . $faculty->last_name)
                    : 'N/A',
                'faculty_code' => $faculty?->faculty_code ?? 'N/A',
                'department' => $faculty?->department?->name ?? 'N/A',
                'schedule_detail_id' => $req->schedule_detail_id,
                'original_day' => $detail?->day ?? 'N/A',
                'original_time_in' => $detail ? Carbon::parse($detail->start_time)->format('H:i') : '--:--',
                'original_time_out' => $detail ? Carbon::parse($detail->end_time)->format('H:i') : '--:--',
                'original_room' => $detail?->room_code ?? 'N/A',
                'original_subject' => $detail?->course_code ?? 'N/A',
                'original_subject_desc' => $detail?->subject_desc ?? null,
                'schedule_code' => $detail?->schedule?->schedule_code ?? null,
                'requested_day' => $req->requested_day_of_week,
                'requested_time_in' => Carbon::parse($req->requested_time_in)->format('H:i'),
                'requested_time_out' => Carbon::parse($req->requested_time_out)->format('H:i'),
                'requested_room' => $req->requested_room,
                'effective_date' => $req->effective_date?->format('M d, Y'),
                'reason' => $req->reason,
                'supporting_document_url' => $req->supporting_document_path ? \Illuminate\Support\Facades\Storage::url($req->supporting_document_path) : null,
                'status' => $req->status,
                'reviewed_by_email' => $req->reviewedBy?->email ?? null,
                'reviewed_at' => $req->reviewed_at?->format('M d, Y h:i A'),
                'review_remarks' => $req->review_remarks,
                'created_at' => $req->created_at?->format('M d, Y h:i A'),
                'program_code' => $detail?->program_code,
                'year_level' => $detail?->year_level,
                'section_name' => $detail?->section_name,
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

    /* ------------------------------------------------------------------ */
    /*  Faculty Query: paginated own requests                             */
    /* ------------------------------------------------------------------ */

    /**
     * Get paginated change requests for a specific faculty member.
     */
    public static function getForFaculty(int $facultyId, Request $request): array
    {
        $perPage = (int) $request->query('per_page', 10);
        $page = (int) $request->query('page', 1);
        $status = $request->query('status', '');
        $semester = $request->query('semester', '');
        $academicYear = $request->query('academic_year', '');

        $query = static::with(['scheduleDetail.schedule', 'reviewedBy'])
            ->where('faculty_id', $facultyId)
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($semester || $academicYear) {
            $query->whereHas('scheduleDetail.schedule', function ($sq) use ($semester, $academicYear) {
                if ($semester !== '') {
                    $sq->where('semester', (int) $semester);
                }
                if ($academicYear !== '') {
                    $sq->where('academic_year', (int) $academicYear);
                }
            });
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        $formatted = $items->map(function (self $req) {
            $detail = $req->scheduleDetail;

            return [
                'id' => $req->id,
                'schedule_detail_id' => $req->schedule_detail_id,
                'original_day' => $detail?->day ?? 'N/A',
                'original_time_in' => $detail ? Carbon::parse($detail->start_time)->format('H:i') : '--:--',
                'original_time_out' => $detail ? Carbon::parse($detail->end_time)->format('H:i') : '--:--',
                'original_room' => $detail?->room_code ?? 'N/A',
                'original_subject' => $detail?->course_code ?? 'N/A',
                'schedule_code' => $detail?->schedule?->schedule_code ?? null,
                'requested_day' => $req->requested_day_of_week,
                'requested_time_in' => Carbon::parse($req->requested_time_in)->format('H:i'),
                'requested_time_out' => Carbon::parse($req->requested_time_out)->format('H:i'),
                'requested_room' => $req->requested_room,
                'effective_date' => $req->effective_date?->format('M d, Y'),
                'reason' => $req->reason,
                'supporting_document_url' => $req->supporting_document_path ? \Illuminate\Support\Facades\Storage::url($req->supporting_document_path) : null,
                'status' => $req->status,
                'reviewed_by' => $req->reviewedBy?->email ?? null,
                'reviewed_at' => $req->reviewed_at?->format('M d, Y h:i A'),
                'review_remarks' => $req->review_remarks,
                'created_at' => $req->created_at?->format('M d, Y h:i A'),
                'program_code' => $detail?->program_code,
                'year_level' => $detail?->year_level,
                'section_name' => $detail?->section_name,
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
