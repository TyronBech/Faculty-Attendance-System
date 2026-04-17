<?php

namespace App\Models;

use Database\Factories\AdminFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Admin extends Model
{
    /** @use HasFactory<AdminFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'admins';

    protected $fillable = [
        'user_id',
        'admin_code',
        'first_name',
        'middle_name',
        'last_name',
        'suffix_name',
        'phone',
        'position_title',
        'employment_type',
        'date_hired',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'date_hired' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getFullNameAttribute(): string
    {
        $parts = [
            $this->first_name,
            $this->middle_name,
            $this->last_name,
            $this->suffix_name,
        ];

        $parts = array_values(array_filter($parts, static fn (?string $value): bool => filled($value)));

        return implode(' ', $parts);
    }
}
