<?php

namespace App\Models;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class UndertimeRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'attendance_justifications';

    protected $fillable = [
        'faculty_id',
        'attendance_record_id',
        'type',
        'justification',
        'attachment_path',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships */
    /* ------------------------------------------------------------------ */

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class);
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
    /*  Scopes */
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

    public function scopeUndertime($query)
    {
        return $query->where('type', 'undertime');
    }

    /* ------------------------------------------------------------------ */
    /*  Methods */
    /* ------------------------------------------------------------------ */

    /**
     * Get the first attachment URL if it exists
     */
    public function getAttachmentUrl(): ?string
    {
        if ($this->attachment_path) {
            /** @var Filesystem $disk */
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

    /**
     * Delete the attachment file
     */
    public function deleteAttachment(): void
    {
        if ($this->attachment_path && Storage::disk('public')->exists($this->attachment_path)) {
            Storage::disk('public')->delete($this->attachment_path);
        }
    }
}
