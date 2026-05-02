<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class SystemSetting extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'setting_key',
        'setting_value',
        'setting_type',
        'description',
        'is_editable',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_editable' => 'boolean',
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Relationships */
    /* ------------------------------------------------------------------ */

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers */
    /* ------------------------------------------------------------------ */

    public static function currentAcademicYear(): int
    {
        $value = (string) static::where('setting_key', 'academic_year')->value('setting_value');

        if ($value !== '') {
            preg_match_all('/\d{4}/', $value, $matches);
            if (! empty($matches[0])) {
                return (int) end($matches[0]);
            }

            if (is_numeric($value)) {
                return (int) $value;
            }
        }

        return (int) Carbon::now()->year;
    }

    public static function currentSemester(): int
    {
        $value = static::where('setting_key', 'current_semester')->value('setting_value');
        $semester = (int) $value;

        if ($semester < 1 || $semester > 3) {
            return 1;
        }

        return $semester;
    }

    public static function manualAttendanceRequestLimit(): int
    {
        $value = static::where('setting_key', 'manual_attendance_request_limit')->value('setting_value');
        $limit = (int) $value;

        if ($limit < 1) {
            return 5;
        }

        return $limit;
    }
}
