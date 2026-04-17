<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('attendance_justifications', function (Blueprint $table) {
            $table->boolean('counts_as_manual_log')->default(true)->after('review_remarks');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance_justifications', function (Blueprint $table) {
            $table->dropColumn('counts_as_manual_log');
        });
    }
};
