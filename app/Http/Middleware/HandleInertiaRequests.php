<?php

namespace App\Http\Middleware;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Inertia\Middleware;
use Spatie\Permission\Models\Permission;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        // Resolve the authenticated user from either the admin or web guard (if any)
        $guard = null;
        $authenticatedUser = null;

        if (Auth::guard('admin')->check()) {
            $guard = 'admin';
            $authenticatedUser = Auth::guard('admin')->user();
        } elseif (Auth::guard('web')->check()) {
            $guard = 'web';
            $authenticatedUser = Auth::guard('web')->user();
        }

        $user = null;
        $permissions = [];

        if ($authenticatedUser) {
            $user = User::with(['faculty', 'admin'])->find($authenticatedUser->id);

            if ($user && $guard) {
                /** @var Collection<int, Permission> $userPermissions */
                $userPermissions = $user->getPermissionsViaRoles()
                    ->merge($user->permissions)
                    ->filter(fn ($permission) => $permission->guard_name === $guard);

                $permissions = $userPermissions
                    ->pluck('name')
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        $displayName = $user?->admin?->full_name
            ?? $user?->faculty?->full_name
            ?? $user?->username;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
                'faculty' => $user ? $user->faculty : null,
                'admin' => $user ? $user->admin : null,
                'display_name' => $displayName,
                'roles' => $user ? $user->getRoleNames()->toArray() : [],
                'permissions' => $permissions,
                'guard' => $guard,
            ],
            'flash' => [
                'success' => session('success'),
                'error' => session('error'),
                'warning' => session('warning'),
                'info' => session('info'),
            ],
            'csrf_token' => csrf_token(),
        ];
    }
}
