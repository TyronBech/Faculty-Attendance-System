<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Http\Requests\Admin\UpdateUserRolesRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminRbacController extends Controller
{
    public function index(): Response
    {
        $roles = Role::query()
            ->where('guard_name', 'admin')
            ->with(['permissions' => function ($query): void {
                $query->select('permissions.id', 'permissions.name', 'permissions.guard_name')
                    ->where('guard_name', 'admin')
                    ->orderBy('name');
            }])
            ->withCount('users')
            ->orderBy('name')
            ->get(['id', 'name', 'guard_name'])
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'guard' => $role->guard_name,
                'users_count' => $role->users_count,
                'permissions' => $role->permissions
                    ->map(fn (Permission $permission): array => [
                        'id' => $permission->id,
                        'name' => $permission->name,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        $permissions = Permission::query()
            ->where('guard_name', 'admin')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Permission $permission): array => [
                'id' => $permission->id,
                'name' => $permission->name,
            ])
            ->values()
            ->all();

        $users = User::query()
            ->whereHas('admin')
            ->with([
                'admin:id,user_id,first_name,middle_name,last_name,suffix_name',
                'roles' => fn ($query) => $query
                    ->where('guard_name', 'admin')
                    ->select('roles.id', 'roles.name', 'roles.guard_name'),
            ])
            ->orderBy('username')
            ->get(['id', 'username', 'email'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'display_name' => $user->admin?->full_name ?: $user->username,
                'email' => $user->email,
                'roles' => $user->roles
                    ->map(fn (Role $role): array => [
                        'id' => $role->id,
                        'name' => $role->name,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        return Inertia::render('Admin/Rbac', [
            'roles' => $roles,
            'permissions' => $permissions,
            'users' => $users,
        ]);
    }

    public function storeRole(StoreRoleRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'admin',
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return back()->with('success', 'Role "'.$role->name.'" has been added.');
    }

    public function updateRole(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        if ($role->guard_name !== 'admin') {
            abort(404);
        }

        if ($role->name === 'super_admin') {
            return back()->with('error', 'The super_admin role cannot be modified.');
        }

        $validated = $request->validated();
        $affectedUsers = $role->users()->count();

        $role->update([
            'name' => $validated['name'],
        ]);
        $role->syncPermissions($validated['permissions'] ?? []);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return back()->with('success', 'Role "'.$role->name.'" has been updated. Changes now affect '.$affectedUsers.' user(s).');
    }

    public function updateUserRoles(UpdateUserRolesRequest $request, User $user): RedirectResponse
    {
        if (! $user->admin) {
            return back()->with('error', 'Selected user is not an admin account.');
        }

        $validated = $request->validated();
        $incomingRoles = $validated['roles'] ?? [];

        $superAdminRole = Role::query()
            ->where('name', 'super_admin')
            ->where('guard_name', 'admin')
            ->first();

        if ($superAdminRole && $user->hasRole($superAdminRole)) {
            $willLoseSuperAdmin = ! in_array('super_admin', $incomingRoles, true);

            if ($willLoseSuperAdmin) {
                $remainingSuperAdmins = $superAdminRole->users()->where('users.id', '!=', $user->id)->count();

                if ($remainingSuperAdmins === 0) {
                    return back()->with('error', 'Cannot remove the super_admin role from the last remaining super admin.');
                }
            }
        }

        $user->syncRoles($incomingRoles);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return back()->with('success', 'Roles updated for '.($user->admin?->full_name ?: $user->username).'.');
    }

    public function destroyRole(Role $role): RedirectResponse
    {
        if ($role->guard_name !== 'admin') {
            abort(404);
        }

        if ($role->name === 'super_admin') {
            return back()->with('error', 'The super_admin role cannot be deleted.');
        }

        $roleName = $role->name;
        $role->users()->detach();
        $role->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return back()->with('success', 'Role "'.$roleName.'" has been deleted.');
    }
}
