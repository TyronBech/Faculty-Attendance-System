<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TemporaryFacultySchedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'faculty_id',
        'external_faculty_id',
        'faculty_code',
        'faculty_email',
        'first_name',
        'middle_name',
        'last_name',
        'suffix_name',
        'faculty_type',
        'assigned_units',
        'day',
        'start_time',
        'end_time',
        'room_code',
        'program_code',
        'program_title',
        'year_level',
        'section_name',
        'course_assignment_id',
        'course_title',
        'course_code',
        'lec',
        'lab',
        'units',
        'tuition_hours',
        'source_hash',
        'raw_payload',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'faculty_id' => 'integer',
            'external_faculty_id' => 'integer',
            'assigned_units' => 'decimal:2',
            'year_level' => 'integer',
            'course_assignment_id' => 'integer',
            'lec' => 'decimal:2',
            'lab' => 'decimal:2',
            'units' => 'decimal:2',
            'tuition_hours' => 'decimal:2',
            'raw_payload' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }
}
