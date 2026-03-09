<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Remove the foreign key constraint from biometric_logs.biometric_id
     * so that logs from unknown faculty IDs can still be persisted as audit trail.
     */
    public function up(): void
    {
        Schema::table('biometric_logs', function (Blueprint $table) {
            $table->dropForeign(['biometric_id']);
        });
    }

    /**
     * Restore the foreign key constraint.
     *
     * WARNING: This rollback will fail if any biometric_logs rows have a biometric_id
     * that does not correspond to an active faculties.biometric_id (i.e. unrecognized-ID
     * logs that were inserted after the up() migration ran). Remove or update those rows
     * before attempting to roll back this migration.
     */
    public function down(): void
    {
        Schema::table('biometric_logs', function (Blueprint $table) {
            $table->foreign('biometric_id')
                ->references('biometric_id')
                ->on('faculties')
                ->onDelete('cascade');
        });
    }
};
