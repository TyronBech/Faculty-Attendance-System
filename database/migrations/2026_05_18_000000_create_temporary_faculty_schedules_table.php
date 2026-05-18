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
        Schema::create('temporary_faculty_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faculty_id')->nullable()->constrained('faculties')->nullOnDelete();
            $table->unsignedBigInteger('external_faculty_id')->nullable();
            $table->string('faculty_code');
            $table->string('faculty_email')->nullable();
            $table->string('first_name')->nullable();
            $table->string('middle_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('suffix_name')->nullable();
            $table->string('faculty_type')->nullable();
            $table->decimal('assigned_units', 6, 2)->nullable();
            $table->string('day');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('room_code')->nullable();
            $table->string('program_code')->nullable();
            $table->text('program_title')->nullable();
            $table->unsignedTinyInteger('year_level')->nullable();
            $table->string('section_name')->nullable();
            $table->unsignedBigInteger('course_assignment_id')->nullable();
            $table->string('course_title')->nullable();
            $table->string('course_code')->nullable();
            $table->decimal('lec', 6, 2)->nullable();
            $table->decimal('lab', 6, 2)->nullable();
            $table->decimal('units', 6, 2)->nullable();
            $table->decimal('tuition_hours', 6, 2)->nullable();
            $table->string('source_hash', 64)->unique();
            $table->json('raw_payload')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('external_faculty_id');
            $table->index('faculty_code');
            $table->index(['faculty_id', 'day']);
            $table->index('course_assignment_id');
            $table->index('course_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('temporary_faculty_schedules');
    }
};
