<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;

class AttendanceJustification extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'attendance_record_id',
        'faculty_id',
        'type',
        'requested_time_in',
        'requested_time_out',
        'justification',
        'attachment_path',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
        'counts_as_manual_log',
    ];

    protected function casts(): array
    {
        return [
            'requested_time_in' => 'datetime',
            'requested_time_out' => 'datetime',
            'reviewed_at' => 'datetime',
            'counts_as_manual_log' => 'boolean',
        ];
    }

    public function getAttachmentUrl(): ?string
    {
        if (! $this->attachment_path) {
            return null;
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        return $disk->url($this->attachment_path);
    }

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class);
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
