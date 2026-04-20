<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Enums\Role as RoleEnum;
use App\Models\Admin;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminRbacManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_add_a_new_role(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $response = $this->actingAs($superAdmin, 'admin')->post(route('admin.rbac.roles.store'), [
            'name' => 'registrar_staff',
            'permissions' => [
                Permission::ViewDashboard->value,
                Permission::ViewReports->value,
            ],
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('roles', [
            'name' => 'registrar_staff',
            'guard_name' => 'admin',
        ]);

        $role = Role::query()->where('name', 'registrar_staff')->firstOrFail();
        $this->assertTrue($role->hasPermissionTo(Permission::ViewDashboard->value, 'admin'));
        $this->assertTrue($role->hasPermissionTo(Permission::ViewReports->value, 'admin'));
    }

    public function test_super_admin_can_edit_a_role_and_its_permissions(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $role = Role::query()->create([
            'name' => 'test_role',
            'guard_name' => 'admin',
        ]);

        $targetUser = $this->createAdminUserWithRole('test_role');

        $response = $this->actingAs($superAdmin, 'admin')->put(route('admin.rbac.roles.update', $role), [
            'name' => 'test_role_updated',
            'permissions' => [Permission::ViewReports->value],
        ]);

        $response->assertRedirect();

        $role->refresh();
        $targetUser->refresh();

        $this->assertSame('test_role_updated', $role->name);
        $this->assertTrue($role->hasPermissionTo(Permission::ViewReports->value, 'admin'));
        $this->assertTrue($targetUser->hasRole('test_role_updated'));
        $this->assertTrue($targetUser->hasPermissionTo(Permission::ViewReports->value, 'admin'));
    }

    public function test_super_admin_can_update_user_roles(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);
        $targetUser = $this->createAdminUserWithRole(RoleEnum::Admin->value);

        $response = $this->actingAs($superAdmin, 'admin')->put(route('admin.rbac.users.roles.update', $targetUser), [
            'roles' => [RoleEnum::HrStaff->value],
        ]);

        $response->assertRedirect();

        $targetUser->refresh();
        $this->assertTrue($targetUser->hasRole(RoleEnum::HrStaff->value));
        $this->assertFalse($targetUser->hasRole(RoleEnum::Admin->value));
    }

    public function test_super_admin_can_delete_a_role(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $role = Role::query()->create([
            'name' => 'temporary_role',
            'guard_name' => 'admin',
        ]);

        $assignedUser = $this->createAdminUserWithRole('temporary_role');

        $response = $this->actingAs($superAdmin, 'admin')
            ->delete(route('admin.rbac.roles.destroy', $role));

        $response->assertRedirect();
        $this->assertDatabaseMissing('roles', [
            'id' => $role->id,
        ]);

        $assignedUser->refresh();
        $this->assertFalse($assignedUser->hasRole('temporary_role'));
    }

    public function test_super_admin_role_cannot_be_renamed(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $superAdminRole = Role::query()
            ->where('name', 'super_admin')
            ->where('guard_name', 'admin')
            ->firstOrFail();

        $response = $this->actingAs($superAdmin, 'admin')->put(route('admin.rbac.roles.update', $superAdminRole), [
            'name' => 'super_admin_renamed',
            'permissions' => [],
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertDatabaseHas('roles', ['name' => 'super_admin', 'guard_name' => 'admin']);
        $this->assertDatabaseMissing('roles', ['name' => 'super_admin_renamed']);
    }

    public function test_cannot_remove_super_admin_from_last_super_admin(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $response = $this->actingAs($superAdmin, 'admin')->put(route('admin.rbac.users.roles.update', $superAdmin), [
            'roles' => [RoleEnum::Admin->value],
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('error');

        $superAdmin->refresh();
        $this->assertTrue($superAdmin->hasRole(RoleEnum::SuperAdmin->value));
    }

    public function test_can_remove_super_admin_role_when_another_super_admin_exists(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin1 = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);
        $superAdmin2 = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $response = $this->actingAs($superAdmin1, 'admin')->put(route('admin.rbac.users.roles.update', $superAdmin2), [
            'roles' => [RoleEnum::Admin->value],
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $superAdmin2->refresh();
        $this->assertFalse($superAdmin2->hasRole(RoleEnum::SuperAdmin->value));
        $this->assertTrue($superAdmin2->hasRole(RoleEnum::Admin->value));
    }

    public function test_role_name_must_be_lowercase(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $superAdmin = $this->createAdminUserWithRole(RoleEnum::SuperAdmin->value);

        $response = $this->actingAs($superAdmin, 'admin')->post(route('admin.rbac.roles.store'), [
            'name' => 'InvalidUpperCase',
            'permissions' => [],
        ]);

        $response->assertSessionHasErrors('name');
    }

    private function createAdminUserWithRole(string $role): User
    {
        $user = User::factory()->create();
        Admin::factory()->for($user)->create();

        $adminRole = Role::query()
            ->where('name', $role)
            ->where('guard_name', 'admin')
            ->firstOrFail();

        $user->assignRole($adminRole);

        return $user;
    }
}
