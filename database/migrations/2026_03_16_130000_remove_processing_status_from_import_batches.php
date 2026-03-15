<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Remove the deprecated 'processing' enum value from import_batches.status and
     * migrate any existing rows that still carry that value to 'pending'.
     *
     * A new, standalone migration is used instead of editing the original one so
     * that deployed environments which have already run the initial migration
     * receive this schema change on their next `php artisan migrate`.
     */
    public function up(): void
    {
        if (! Schema::hasTable('import_batches')) {
            return;
        }

        // Migrate any 'processing' rows to 'pending' before tightening the enum.
        DB::table('import_batches')
            ->where('status', 'processing')
            ->update(['status' => 'pending']);

        $driver = DB::getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement("ALTER TABLE import_batches MODIFY status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending'");
        }

        // SQLite does not enforce ENUM constraints, so no DDL change is required.
        // PostgreSQL and SQL Server are not in-scope for this project.
    }

    public function down(): void
    {
        if (! Schema::hasTable('import_batches')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement("ALTER TABLE import_batches MODIFY status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending'");
        }
    }
};
