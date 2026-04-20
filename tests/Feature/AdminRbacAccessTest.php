<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Admin;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role as SpatieRole;
use Tests\TestCase;

class AdminRbacAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_view_the_rbac_page(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $superAdmin = $this->createAdminUserWithRole(Role::SuperAdmin->value);

        $response = $this->actingAs($superAdmin, 'admin')
            ->get(route('admin.rbac.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Rbac')
            ->has('roles')
            ->has('permissions')
            ->has('users')
        );
    }

    public function test_admin_role_can_view_the_rbac_page(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $admin = $this->createAdminUserWithRole(Role::Admin->value);

        $response = $this->actingAs($admin, 'admin')
            ->get(route('admin.rbac.index'));

        $response->assertOk();
    }

    public function test_non_admin_role_cannot_view_the_rbac_page(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $hrStaff = $this->createAdminUserWithRole(Role::HrStaff->value);

        $response = $this->actingAs($hrStaff, 'admin')
            ->get(route('admin.rbac.index'));

        $response->assertForbidden();
    }

    public function test_guest_is_redirected_to_admin_login_when_accessing_rbac_page(): void
    {
        $response = $this->get(route('admin.rbac.index'));

        $response->assertRedirect(route('admin.login'));
    }

    private function createAdminUserWithRole(string $role): User
    {
        $user = User::factory()->create();
        Admin::factory()->for($user)->create();

        $adminRole = SpatieRole::query()
            ->where('name', $role)
            ->where('guard_name', 'admin')
            ->firstOrFail();

        $user->assignRole($adminRole);

        return $user;
    }
}
