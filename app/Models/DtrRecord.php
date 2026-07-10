<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class DtrRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'faculty_id',
        'month',
        'year',
        'total_days_present',
        'total_days_absent',
        'total_days_late',
        'total_late_minutes',
        'total_undertime_minutes',
        'total_hours_rendered',
        'total_hours_required',
        'status',
        'finalized_at',
        'approved_by',
        'approved_at',
        'pdf_path',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'year' => 'integer',
            'total_days_present' => 'integer',
            'total_days_absent' => 'integer',
            'total_days_late' => 'integer',
            'total_late_minutes' => 'integer',
            'total_undertime_minutes' => 'integer',
            'total_hours_rendered' => 'decimal:2',
            'total_hours_required' => 'decimal:2',
            'finalized_at' => 'datetime',
            'approved_at' => 'datetime',
            'generated_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships                                                     */
    /* ------------------------------------------------------------------ */

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function hrStatus(): HasOne
    {
        return $this->hasOne(HrDtrStatus::class);
    }

    public function hrStatuses(): HasMany
    {
        return $this->hasMany(HrDtrStatus::class);
    }
}
