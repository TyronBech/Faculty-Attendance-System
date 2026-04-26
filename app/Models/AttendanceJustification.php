<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
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
        if ($this->attachment_path) {
            /** @var FilesystemAdapter $disk */
            $disk = Storage::disk('public');

            return $disk->url($this->attachment_path);
        }

        $firstAttachment = $this->attachments()->first();

        return $firstAttachment ? $firstAttachment->getDownloadUrl() : null;
    }

    /**
     * Get all attachments with their URLs
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAttachmentsData(): array
    {
        $data = [];

        // Legacy single attachment
        if ($this->attachment_path) {
            $data[] = [
                'id' => 'legacy',
                'file_path' => $this->attachment_path,
                'custom_label' => 'Supporting Document',
                'url' => Storage::disk('public')->url($this->attachment_path),
            ];
        }

        // New multiple attachments
        foreach ($this->attachments as $attachment) {
            $data[] = [
                'id' => $attachment->id,
                'file_path' => $attachment->file_path,
                'custom_label' => $attachment->custom_label,
                'url' => $attachment->getDownloadUrl(),
                'mime_type' => $attachment->mime_type,
            ];
        }

        return $data;
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

    public function attachments(): MorphMany
    {
        return $this->morphMany(RequestAttachment::class, 'attachmentable');
    }
}
