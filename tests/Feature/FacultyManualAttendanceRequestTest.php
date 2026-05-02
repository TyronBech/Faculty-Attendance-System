<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FacultyManualAttendanceRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_attendance_requests_page_uses_configured_manual_request_limit(): void
    {
        $faculty = $this->createFaculty();

        SystemSetting::query()->create([
            'setting_key' => 'manual_attendance_request_limit',
            'setting_value' => '7',
            'setting_type' => 'integer',
            'description' => 'Maximum counted manual attendance requests allowed per faculty each semester.',
            'is_editable' => true,
        ]);

        $response = $this
            ->actingAs($faculty->user)
            ->get(route('faculty.manual-attendance-requests.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Faculty/ManualAttendanceRequests')
            ->where('manualRequestLimit', 7)
            ->where('approvedCountingRequestsCount', 0)
        );
    }

    private function createFaculty(): Faculty
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.manual.limit',
            'email' => 'faculty.manual.limit@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        return Faculty::factory()
            ->for($user)
            ->for($department)
            ->create([
                'biometric_id' => 'BIO-MANUAL-LIMIT',
                'faculty_code' => 'FC-LIMIT',
                'is_active' => true,
            ]);
    }
}
