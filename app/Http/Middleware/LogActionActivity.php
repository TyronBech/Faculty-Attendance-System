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

    /**
     * @var array<string, string>
     */
    private const ACTION_LABELS = [
        'profile.update' => 'updated profile',
        'password.update' => 'updated password',
        'faculty.dtr.dispatch' => 'exported DTR',
        'admin.dtr-export.dispatch' => 'exported DTR',
        'admin.dtr-export.dispatch-batch' => 'exported DTR batch',
        'admin.attendance-imports.store' => 'imported attendance logs',
        'admin.attendance-imports.sync' => 'synced attendance import',
        'admin.attendance-imports.logs.update' => 'updated attendance import log',
        'admin.attendance-imports.logs.destroy' => 'deleted attendance import log',
        'admin.attendance-imports.destroy' => 'deleted attendance import batch',
        'admin.manual-attendance.store' => 'recorded manual attendance',
        'admin.backups.store' => 'generated backup',
    ];

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
        $description = $this->buildDescription($actor, $routeName);

        $properties = [
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

    private function buildDescription(mixed $actor, string $routeName): string
    {
        $actorLabel = $this->resolveActorLabel($actor);
        $actionLabel = self::ACTION_LABELS[$routeName] ?? 'performed an action';

        return "{$actorLabel} {$actionLabel}";
    }

    private function resolveActorLabel(mixed $actor): string
    {
        if (! $actor) {
            return 'System';
        }

        $name = $actor->username
            ?? $actor->name
            ?? $actor->full_name
            ?? null;

        if (is_string($name) && trim($name) !== '') {
            return trim($name);
        }

        return 'User';
    }
}
