<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifies the authenticated user has at least one of the required permissions
 * on the correct guard.
 *
 * Parameter format:  check.permission:<permissions>|<guard>
 *   <permissions>  – one or more permission names separated by a pipe (|)
 *   <guard>        – optional; 'admin' or 'web'. Defaults to the currently active guard.
 *
 * Examples:
 *   check.permission:view attendance                       → active guard
 *   check.permission:view attendance|edit attendance,admin → 'admin' guard (OR logic)
 *   check.permission:view dashboard,web                    → 'web' guard
 *
 * Notes:
 *   - Spatie resolves permissions against the user model's guard_name, so always
 *     pass the matching guard to avoid cross-guard permission conflicts.
 *   - Pipe ( | ) is used as separator so that permission names can contain spaces.
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permissions, string $guard): Response
    {
        // Resolve which guard to use
        $guardName = $guard ?? Auth::getDefaultDriver();
        $user = Auth::guard($guardName)->user();

        if (! $user instanceof User) {
            return $this->unauthenticated($request, $guardName);
        }

        // Support pipe-separated list of permissions (OR logic)
        $requiredPermissions = array_map('trim', explode('|', $permissions));

        $hasPermission = collect($requiredPermissions)->contains(
            fn (string $permission) => $user->hasPermissionTo($permission, $guardName)
        );

        if (! $hasPermission) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized. Insufficient permissions.'], 403);
            }

            abort(403, 'Unauthorized. Insufficient permissions.');
        }

        return $next($request);
    }

    private function unauthenticated(Request $request, string $guard): Response
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $loginRoute = match ($guard) {
            'admin' => 'admin.login',
            default => 'faculty.login',
        };

        return redirect()->route($loginRoute);
    }
}
