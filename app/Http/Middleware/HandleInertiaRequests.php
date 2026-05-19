<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Middleware;
use Spatie\Permission\Models\Permission;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    public function handle(Request $request, Closure $next): Response
    {
        $this->debug('entering', $request);

        try {
            $response = parent::handle($request, $next);
        } catch (Throwable $exception) {
            $this->debug('exception', $request, [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        $this->debug('leaving', $request, [
            'response_class' => $response::class,
            'status' => $response->getStatusCode(),
            'content_type' => $response->headers->get('Content-Type'),
            'x_inertia' => $response->headers->get('X-Inertia'),
            'x_inertia_location' => $response->headers->get('X-Inertia-Location'),
            'vary' => $response->headers->get('Vary'),
        ]);

        return $response;
    }

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
        $this->debug('share starting', $request);

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

        $shared = [
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

        $this->debug('share completed', $request, [
            'guard' => $guard,
            'user_id' => $user?->id,
            'permissions_count' => count($permissions),
        ]);

        return $shared;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function debug(string $event, Request $request, array $context = []): void
    {
        if (! config('app.debug') && ! filter_var(env('INERTIA_DEBUG'), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        Log::info('[Inertia debug] '.$event, [
            'method' => $request->method(),
            'path' => $request->path(),
            'route' => $request->route()?->getName(),
            'request_x_inertia' => $request->header('X-Inertia'),
            'request_x_inertia_version' => $request->header('X-Inertia-Version'),
            'request_x_requested_with' => $request->header('X-Requested-With'),
            'request_accept' => $request->header('Accept'),
        ] + $context);
    }
}
