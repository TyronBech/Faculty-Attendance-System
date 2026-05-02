<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_profile_page_is_displayed(): void
    {
        $user = User::factory()->create();
        Admin::factory()->for($user)->create();

        $response = $this->actingAs($user, 'admin')
            ->get(route('admin.profile.edit'));

        $response->assertOk();
    }

    public function test_admin_profile_information_can_be_updated(): void
    {
        $user = User::factory()->create([
            'username' => 'existing_admin',
            'email' => 'existing.admin@example.com',
        ]);

        $admin = Admin::factory()->for($user)->create([
            'admin_code' => 'ADM2222',
            'first_name' => 'Old',
            'middle_name' => null,
            'last_name' => 'Name',
            'position_title' => 'HR Staff',
            'employment_type' => 'regular',
            'date_hired' => '2022-01-01',
        ]);

        $response = $this->actingAs($user, 'admin')
            ->patch(route('admin.profile.update'), [
                'username' => 'updated_admin',
                'email' => 'updated.admin@example.com',
                'admin_code' => 'ADM5555',
                'first_name' => 'Updated',
                'middle_name' => 'Middle',
                'last_name' => 'Person',
                'suffix_name' => 'Jr.',
                'phone' => '09171234567',
                'position_title' => 'Campus Administrator',
                'employment_type' => 'contractual',
                'date_hired' => '2024-06-01',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect(route('admin.profile.edit'));

        $this->assertSame('updated_admin', $user->fresh()->username);
        $this->assertSame('updated.admin@example.com', $user->fresh()->email);

        $admin->refresh();
        $this->assertSame('ADM5555', $admin->admin_code);
        $this->assertSame('Updated', $admin->first_name);
        $this->assertSame('Middle', $admin->middle_name);
        $this->assertSame('Person', $admin->last_name);
        $this->assertSame('Jr.', $admin->suffix_name);
        $this->assertSame('09171234567', $admin->phone);
        $this->assertSame('Campus Administrator', $admin->position_title);
        $this->assertSame('contractual', $admin->employment_type);
        $this->assertSame('2024-06-01', $admin->date_hired?->toDateString());
    }

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
            'suffix_name' => null,
        ]);

        $user = User::query()
            ->with('admin')
            ->findOrFail($admin->user_id);

        $this->assertNotNull($user->admin);
        $this->assertSame('Maria Reyes', $user->admin->full_name);
    }
}
