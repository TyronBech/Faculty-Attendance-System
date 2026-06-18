<?php

namespace App\Models;

use Database\Factories\AgentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Agent extends Authenticatable
{
    /** @use HasFactory<AgentFactory> */
    use HasApiTokens, HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'device_ip',
        'device_port',
        'branch_id',
        'is_active',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'device_port' => 'integer',
            'branch_id' => 'integer',
            'is_active' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships */
    /* ------------------------------------------------------------------ */

    public function importBatches(): HasMany
    {
        return $this->hasMany(ImportBatch::class);
    }
}
