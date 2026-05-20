<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_attendance', function (Blueprint $table) {
            // Original file names for check-in and check-out screenshots as uploaded by the client
            $table->string('screenshot_in_original_name')->nullable()->after('screenshot_in');
            $table->string('screenshot_out_original_name')->nullable()->after('screenshot_out');

            // Client-side file modification timestamps indicating when screenshots were last modified on the device
            $table->timestamp('screenshot_in_client_modified_at')->nullable()->after('screenshot_in_original_name');
            $table->timestamp('screenshot_out_client_modified_at')->nullable()->after('screenshot_out_original_name');

            // Server-side detection timestamps indicating when screenshots were processed and verified
            $table->timestamp('screenshot_in_detected_at')->nullable()->after('screenshot_in_client_modified_at');
            $table->timestamp('screenshot_out_detected_at')->nullable()->after('screenshot_out_client_modified_at');

            // Detection source identifying where the check-in/out screenshot verification originated (e.g., metadata, client_file_modified_at, filename)
            $table->string('screenshot_in_detection_source', 50)->nullable()->after('screenshot_in_detected_at');
            $table->string('screenshot_out_detection_source', 50)->nullable()->after('screenshot_out_detected_at');
        });
    }

    public function down(): void
    {
        Schema::table('online_attendance', function (Blueprint $table) {
            // Drop all screenshot timestamp and metadata columns added in the up() migration
            $table->dropColumn([
                'screenshot_in_original_name',
                'screenshot_out_original_name',
                'screenshot_in_client_modified_at',
                'screenshot_out_client_modified_at',
                'screenshot_in_detected_at',
                'screenshot_out_detected_at',
                'screenshot_in_detection_source',
            ]);
        });
    }
};
