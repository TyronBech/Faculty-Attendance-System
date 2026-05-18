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

class AdminActivityLogPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_activity_logs_page(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $admin = $this->createAdminUserWithRole(Role::Admin->value);

        activity()
            ->useLog('actions')
            ->causedBy($admin)
            ->withProperties([
                'action_label' => 'updated admin profile',
                'method' => 'PATCH',
                'route_name' => 'admin.profile.update',
                'path' => 'admin/profile',
            ])
            ->event('action')
            ->log('Admin updated profile');

        $response = $this->actingAs($admin, 'admin')
            ->get(route('admin.activity-logs.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/ActivityLogs')
            ->has('activityLogs.data', 1)
            ->where('activityLogs.data.0.description', 'Admin updated profile')
            ->where('activityLogs.data.0.action_label', 'updated admin profile')
            ->where('activityLogs.data.0.method', 'PATCH')
            ->where('activityLogs.data.0.route_name', 'admin.profile.update')
            ->where('activityLogs.data.0.path', 'admin/profile')
        );
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
