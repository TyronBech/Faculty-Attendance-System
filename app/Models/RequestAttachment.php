<?php

namespace App\Models;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RequestAttachment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'attachmentable_id',
        'attachmentable_type',
        'file_path',
        'custom_label',
        'mime_type',
        'file_size',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships */
    /* ------------------------------------------------------------------ */

    public function attachmentable(): MorphTo
    {
        return $this->morphTo();
    }

    /* ------------------------------------------------------------------ */
    /*  Methods */
    /* ------------------------------------------------------------------ */

    /**
     * Get the attachment URL if it exists
     */
    public function getUrl(): ?string
    {
        if (! $this->file_path) {
            return null;
        }

        /** @var Filesystem $disk */
        $disk = Storage::disk('public');

        return $disk->url($this->file_path);
    }

    /**
     * Alias for getUrl for consistency across models
     */
    public function getDownloadUrl(): ?string
    {
        return $this->getUrl();
    }

    /**
     * Delete the attachment file from storage
     */
    public function deleteFile(): bool
    {
        if (! $this->file_path) {
            return false;
        }

        try {
            Storage::disk('public')->delete($this->file_path);

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to delete attachment file: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Get file extension from path
     */
    public function getExtension(): ?string
    {
        return pathinfo($this->file_path, PATHINFO_EXTENSION);
    }
}
