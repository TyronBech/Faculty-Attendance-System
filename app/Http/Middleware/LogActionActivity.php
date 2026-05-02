<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogActionActivity
{
    /**
     * @var array<string>
     */
    private const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /**
     * @var array<string>
     */
    private const SENSITIVE_FIELDS = ['password', 'password_confirmation', 'current_password', 'token', '_token'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! in_array($request->method(), self::MUTATING_METHODS, true)) {
            return $response;
        }

        $statusCode = $response->getStatusCode();

        if ($statusCode >= 400) {
            return $response;
        }

        $actor = auth('admin')->user() ?? auth('web')->user() ?? $request->user();
        $route = $request->route();
        $routeName = $route?->getName() ?? 'unknown';
        $description = sprintf('%s %s', $request->method(), $routeName);

        $properties = [
            'route_name' => $routeName,
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $statusCode,
            'ip' => $request->ip(),
            'input' => $request->except(self::SENSITIVE_FIELDS),
        ];

        activity()
            ->useLog('actions')
            ->causedBy($actor)
            ->withProperties($properties)
            ->event('action')
            ->log($description);

        return $response;
    }
}
