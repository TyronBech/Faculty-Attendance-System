<?php

namespace Database\Seeders;

use App\Enums\Permission as PermissionEnum;
use App\Enums\Role as RoleEnum;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        DB::beginTransaction();
        try {
            app()[PermissionRegistrar::class]->forgetCachedPermissions();

            // ── Create any missing admin-guard permissions (additive only) ─
            foreach (PermissionEnum::adminPermissions() as $permission) {
                Permission::firstOrCreate(['name' => $permission->value, 'guard_name' => 'admin']);
            }

            // ── Create any missing web-guard permissions (additive only) ───
            foreach (PermissionEnum::webPermissions() as $permission) {
                Permission::firstOrCreate(['name' => $permission->value, 'guard_name' => 'web']);
            }

            // ── Create missing roles and add missing role-permission links ─
            foreach (RoleEnum::cases() as $roleEnum) {
                $role = Role::firstOrCreate([
                    'name' => $roleEnum->value,
                    'guard_name' => $roleEnum->guard(),
                ]);

                /** @var Collection<int, Permission> $enumPermissions */
                $enumPermissions = collect($roleEnum->permissions())
                    ->map(fn (PermissionEnum $permissionEnum) => Permission::query()
                        ->where('name', $permissionEnum->value)
                        ->where('guard_name', $roleEnum->guard())
                        ->first())
                    ->filter()
                    ->values();

                $existingPermissionNames = $role->permissions()
                    ->pluck('name')
                    ->all();

                $missingPermissions = $enumPermissions->filter(
                    fn (Permission $permission): bool => ! in_array($permission->name, $existingPermissionNames, true)
                );

                if ($missingPermissions->isNotEmpty()) {
                    $role->givePermissionTo($missingPermissions->all());
                }
            }

            app()[PermissionRegistrar::class]->forgetCachedPermissions();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
