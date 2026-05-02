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
        Schema::table('online_attendance', function (Blueprint $table) {
            $table->time('time_out')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('online_attendance', function (Blueprint $table) {
            $table->time('time_out')->nullable(false)->change();
        });
    }
};
