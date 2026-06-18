<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ImportBatch extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'file_name',
        'file_path',
        'total_records',
        'processed_records',
        'failed_records',
        'duplicate_records',
        'status',
        'imported_by',
        'agent_id',
        'started_at',
        'completed_at',
        'error_log',
    ];

    protected function casts(): array
    {
        return [
            'total_records' => 'integer',
            'processed_records' => 'integer',
            'failed_records' => 'integer',
            'duplicate_records' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships */
    /* ------------------------------------------------------------------ */

    public function importedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function biometricLogs(): HasMany
    {
        return $this->hasMany(BiometricLog::class);
    }
}
