<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        DB::beginTransaction();
        try {
            $admin = User::where('username', 'admin')->first();

            $settings = [
                [
                    'setting_key' => 'late_grace_period_minutes',
                    'setting_value' => '5',
                    'setting_type' => 'integer',
                    'description' => 'Number of minutes after scheduled time-in before a faculty is marked late.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'undertime_threshold_minutes',
                    'setting_value' => '0',
                    'setting_type' => 'integer',
                    'description' => 'Minutes below required time-out before flagged as undertime.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'overtime_threshold_minutes',
                    'setting_value' => '30',
                    'setting_type' => 'integer',
                    'description' => 'Minimum overtime minutes before it counts as approved overtime.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'work_hours_per_day',
                    'setting_value' => '8',
                    'setting_type' => 'integer',
                    'description' => 'Standard number of working hours per day for regular faculty.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'academic_year',
                    'setting_value' => '2025-2026',
                    'setting_type' => 'string',
                    'description' => 'Current academic year.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'current_semester',
                    'setting_value' => '2',
                    'setting_type' => 'integer',
                    'description' => 'Current semester number (1 or 2).',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'semester_start_date',
                    'setting_value' => '2026-01-06',
                    'setting_type' => 'date',
                    'description' => 'Start date of the current semester.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'semester_end_date',
                    'setting_value' => '2026-05-15',
                    'setting_type' => 'date',
                    'description' => 'End date of the current semester.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'biometric_device_timezone',
                    'setting_value' => 'Asia/Manila',
                    'setting_type' => 'string',
                    'description' => 'Timezone used by the biometric device for log timestamps.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'dtr_auto_generate',
                    'setting_value' => 'false',
                    'setting_type' => 'boolean',
                    'description' => 'Whether DTR records are automatically generated at month end.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'manual_attendance_request_limit',
                    'setting_value' => '5',
                    'setting_type' => 'integer',
                    'description' => 'Maximum counted manual attendance requests allowed per faculty each semester.',
                    'is_editable' => true,
                ],
                [
                    'setting_key' => 'hr_dtr_sync_days',
                    'setting_value' => '15,30',
                    'setting_type' => 'csv_integer',
                    'description' => 'Month days when HR pending DTR records should be synchronized automatically.',
                    'is_editable' => true,
                ],
            ];

            foreach ($settings as $setting) {
                SystemSetting::firstOrCreate(
                    ['setting_key' => $setting['setting_key']],
                    array_merge($setting, ['updated_by' => $admin?->id])
                );
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
