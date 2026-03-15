<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('schedule_details')) {
            return;
        }

        $driver = DB::getDriverName();
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        DB::statement('ALTER TABLE schedule_details MODIFY hours_required DECIMAL(4,2) NOT NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('schedule_details')) {
            return;
        }

        $driver = DB::getDriverName();
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        DB::statement('ALTER TABLE schedule_details MODIFY hours_required INT NOT NULL');
    }
};
