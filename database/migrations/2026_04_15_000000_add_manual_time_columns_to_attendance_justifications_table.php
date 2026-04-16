<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_justifications', function (Blueprint $table) {
            $table->dateTime('requested_time_in')->nullable()->after('type');
            $table->dateTime('requested_time_out')->nullable()->after('requested_time_in');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_justifications', function (Blueprint $table) {
            $table->dropColumn(['requested_time_in', 'requested_time_out']);
        });
    }
};
