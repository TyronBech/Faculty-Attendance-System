<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrDtrStatus extends Model
{
    use HasFactory;

    protected $fillable = [
        'dtr_record_id',
        'period_start',
        'period_end',
        'status',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function dtrRecord(): BelongsTo
    {
        return $this->belongsTo(DtrRecord::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
