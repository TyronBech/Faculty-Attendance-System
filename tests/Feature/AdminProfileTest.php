<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_profile_stores_full_name_and_credentials(): void
    {
        $user = User::factory()->create();

        $admin = Admin::factory()
            ->for($user)
            ->create([
                'admin_code' => 'ADM1001',
                'first_name' => 'Juan',
                'middle_name' => 'Santos',
                'last_name' => 'Dela Cruz',
                'suffix_name' => null,
                'position_title' => 'Campus Administrator',
            ]);

        $this->assertSame('ADM1001', $admin->admin_code);
        $this->assertSame('Campus Administrator', $admin->position_title);
        $this->assertSame('Juan Santos Dela Cruz', $admin->full_name);
        $this->assertSame($admin->id, $user->fresh()->admin?->id);
    }

    public function test_admin_profile_can_be_retrieved_through_user_relationship(): void
    {
        $admin = Admin::factory()->create([
            'first_name' => 'Maria',
            'middle_name' => null,
            'last_name' => 'Reyes',
        ]);

        $user = User::query()
            ->with('admin')
            ->findOrFail($admin->user_id);

        $this->assertNotNull($user->admin);
        $this->assertSame('Maria Reyes', $user->admin->full_name);
    }
}
