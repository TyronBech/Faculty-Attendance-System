<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('hr_dtr_statuses', 'period_start')) {
            Schema::table('hr_dtr_statuses', function (Blueprint $table) {
                $table->date('period_start')->nullable()->after('dtr_record_id');
                $table->date('period_end')->nullable()->after('period_start');
            });
        }

        DB::table('hr_dtr_statuses')
            ->join('dtr_records', 'hr_dtr_statuses.dtr_record_id', '=', 'dtr_records.id')
            ->select('hr_dtr_statuses.id', 'dtr_records.month', 'dtr_records.year')
            ->orderBy('hr_dtr_statuses.id')
            ->get()
            ->each(function (object $status): void {
                $periodStart = now()->setDate((int) $status->year, (int) $status->month, 1)->startOfDay();

                DB::table('hr_dtr_statuses')
                    ->where('id', $status->id)
                    ->update([
                        'period_start' => $periodStart->toDateString(),
                        'period_end' => $periodStart->copy()->endOfMonth()->toDateString(),
                    ]);
            });

        Schema::table('hr_dtr_statuses', function (Blueprint $table) {
            $table->index('dtr_record_id', 'hr_dtr_statuses_dtr_record_id_index');
            $table->dropUnique(['dtr_record_id']);
            $table->unique(['dtr_record_id', 'period_start', 'period_end'], 'hr_dtr_statuses_record_period_unique');
            $table->index(['period_start', 'period_end'], 'hr_dtr_statuses_period_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hr_dtr_statuses', function (Blueprint $table) {
            $table->dropIndex('hr_dtr_statuses_period_index');
            $table->dropUnique('hr_dtr_statuses_record_period_unique');
            $table->unique('dtr_record_id');
            $table->dropIndex('hr_dtr_statuses_dtr_record_id_index');
            $table->dropColumn(['period_start', 'period_end']);
        });
    }
};
