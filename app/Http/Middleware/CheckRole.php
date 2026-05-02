<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifies the authenticated user has at least one of the required roles.
 *
 * Usage in routes:
 *   ->middleware('check.role:admin,super_admin')        // uses the currently active guard
 *   ->middleware('check.role:admin|super_admin,admin')  // pipe-separated roles, then guard name
 *
 * Parameter format:  check.role:<roles>|<guard>
 *   <roles>  – one or more role names separated by a pipe (|)
 *   <guard>  – optional; 'admin' or 'web'. Defaults to the currently active guard.
 *
 * Examples:
 *   check.role:super_admin|admin           → must have super_admin OR admin on the active guard
 *   check.role:super_admin|admin,admin     → same but explicitly on the 'admin' guard
 *   check.role:faculty,web                 → must have faculty role on the 'web' guard
 */
class CheckRole
{
    public function handle(Request $request, Closure $next, string $roles, string $guard): Response
    {
        // Resolve which guard to use
        $guardName = $guard ?? Auth::getDefaultDriver();
        $user = Auth::guard($guardName)->user();

        if (! $user instanceof User) {
            return $this->unauthenticated($request, $guardName);
        }

        // Support pipe-separated list of roles (OR logic)
        $allowedRoles = array_map('trim', explode('|', $roles));

        if (! $user->hasAnyRole($allowedRoles)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized. Insufficient role.'], 403);
            }

            abort(403, 'Unauthorized. Insufficient role.');
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
