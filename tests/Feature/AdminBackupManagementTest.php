<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Admin;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role as SpatieRole;
use Tests\TestCase;

class AdminBackupManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_backup_page(): void
    {
        Storage::fake('backups');
        Storage::disk('backups')->put(
            'Faculty Attendance System/backup-20260502-010000.zip',
            'backup-content',
        );

        $admin = $this->createAdminUserWithRole(Role::Admin->value);

        $response = $this->actingAs($admin, 'admin')
            ->get(route('admin.backups.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Backups')
            ->has('backups.data', 1)
            ->where('backups.data.0.name', 'backup-20260502-010000.zip')
            ->where('backups.total', 1)
        );
    }

    public function test_admin_can_trigger_backup_creation(): void
    {
        $admin = $this->createAdminUserWithRole(Role::Admin->value);

        Artisan::shouldReceive('call')
            ->once()
            ->with('backup:run', [
                '--disable-notifications' => true,
                '--no-interaction' => true,
            ])
            ->andReturn(0);

        Artisan::shouldReceive('output')
            ->never();

        $response = $this->actingAs($admin, 'admin')
            ->from(route('admin.backups.index'))
            ->post(route('admin.backups.store'));

        $response->assertRedirect(route('admin.backups.index'));
        $response->assertSessionHas('success', 'Backup created successfully.');
    }

    public function test_admin_can_download_backup_file(): void
    {
        Storage::fake('backups');

        $path = 'Faculty Attendance System/backup-20260502-013000.zip';
        Storage::disk('backups')->put($path, 'backup-content');

        $admin = $this->createAdminUserWithRole(Role::Admin->value);

        $response = $this->actingAs($admin, 'admin')
            ->get(route('admin.backups.download', sha1($path)));

        $response->assertOk();
        $response->assertDownload('backup-20260502-013000.zip');
    }

    public function test_backup_configuration_only_includes_storage_logs_and_database_dump(): void
    {
        $this->assertSame(
            [storage_path('logs')],
            config('backup.backup.source.files.include'),
        );

        $this->assertSame(
            base_path(),
            config('backup.backup.source.files.relative_path'),
        );

        $this->assertSame(
            [],
            config('backup.backup.source.files.exclude'),
        );

        $this->assertSame(
            [config('database.default')],
            config('backup.backup.source.databases'),
        );
    }

    private function createAdminUserWithRole(string $role): User
    {
        $this->seed(RolePermissionSeeder::class);

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
