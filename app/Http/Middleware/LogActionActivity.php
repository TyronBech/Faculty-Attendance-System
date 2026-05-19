<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

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
        'admin.logout' => 'logged out',
        'admin.profile.update' => 'updated admin profile',
        'profile.update' => 'updated profile',
        'profile.destroy' => 'deleted account',
        'password.update' => 'updated password',
        'faculty.dtr.dispatch' => 'exported DTR',
        'admin.dtr-export.dispatch' => 'exported DTR',
        'admin.dtr-export.dispatch-batch' => 'exported DTR batch',
        'admin.rbac.roles.store' => 'created role',
        'admin.rbac.roles.update' => 'updated role',
        'admin.rbac.roles.destroy' => 'deleted role',
        'admin.rbac.users.roles.update' => 'updated user roles',
        'admin.schedules.store' => 'created schedule',
        'admin.schedules.update' => 'updated schedule',
        'admin.schedules.destroy' => 'deleted schedule',
        'admin.schedule-change-requests.approve' => 'approved schedule change request',
        'admin.schedule-change-requests.reject' => 'rejected schedule change request',
        'admin.online-requests.approve' => 'approved online attendance request',
        'admin.online-requests.reject' => 'rejected online attendance request',
        'admin.undertime-justifications.approve' => 'approved undertime justification',
        'admin.undertime-justifications.reject' => 'rejected undertime justification',
        'admin.manual-attendance-requests.limit.update' => 'updated manual attendance request limit',
        'admin.manual-attendance-requests.approve' => 'approved manual attendance request',
        'admin.manual-attendance-requests.reject' => 'rejected manual attendance request',
        'admin.holidays.store' => 'created holiday',
        'admin.holidays.update' => 'updated holiday',
        'admin.holidays.destroy' => 'deleted holiday',
        'admin.attendance-imports.store' => 'imported attendance logs',
        'admin.attendance-imports.sync' => 'synced attendance import',
        'admin.attendance-imports.logs.update' => 'updated attendance import log',
        'admin.attendance-imports.logs.destroy' => 'deleted attendance import log',
        'admin.attendance-imports.destroy' => 'deleted attendance import batch',
        'admin.manual-attendance.store' => 'recorded manual attendance',
        'admin.backups.store' => 'generated backup',
        'faculty.attendance.justify' => 'submitted undertime justification',
        'faculty.attendance.missing-justify' => 'submitted missing attendance justification',
        'faculty.schedule-change-requests.store' => 'submitted schedule change request',
        'faculty.schedule-change-requests.destroy' => 'cancelled schedule change request',
        'faculty.schedule-change-requests.check-conflict' => 'checked schedule change conflict',
        'faculty.online-attendance.store' => 'submitted online attendance request',
        'faculty.online-attendance.destroy' => 'cancelled online attendance request',
        'faculty.undertime-requests.store' => 'submitted undertime request',
        'faculty.undertime-requests.destroy' => 'cancelled undertime request',
        'faculty.manual-attendance-requests.store' => 'submitted manual attendance request',
        'faculty.manual-attendance-requests.destroy' => 'cancelled manual attendance request',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $this->debug('entering', $request);

        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            $this->debug('exception', $request, [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        $this->debug('after next', $request, [
            'response_class' => $response::class,
            'status' => $response->getStatusCode(),
            'content_type' => $response->headers->get('Content-Type'),
            'x_inertia' => $response->headers->get('X-Inertia'),
            'x_inertia_location' => $response->headers->get('X-Inertia-Location'),
            'vary' => $response->headers->get('Vary'),
        ]);

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
        $actionLabel = $this->resolveActionLabel($request, $routeName);
        $description = $this->buildDescription($actor, $actionLabel);

        $properties = [
            'action_label' => $actionLabel,
            'method' => $request->method(),
            'path' => $request->path(),
            'route_name' => $routeName,
            'route_parameters' => $this->formatRouteParameters($route?->parameters() ?? []),
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

    /**
     * @param  array<string, mixed>  $context
     */
    private function debug(string $event, Request $request, array $context = []): void
    {
        if (! config('app.debug') && ! filter_var(env('INERTIA_DEBUG'), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        Log::info('[Action activity debug] '.$event, [
            'method' => $request->method(),
            'path' => $request->path(),
            'route' => $request->route()?->getName(),
            'request_x_inertia' => $request->header('X-Inertia'),
            'request_x_inertia_version' => $request->header('X-Inertia-Version'),
            'request_x_requested_with' => $request->header('X-Requested-With'),
            'request_accept' => $request->header('Accept'),
        ] + $context);
    }

    private function buildDescription(mixed $actor, string $actionLabel): string
    {
        $actorLabel = $this->resolveActorLabel($actor);

        return "{$actorLabel} {$actionLabel}";
    }

    private function resolveActionLabel(Request $request, string $routeName): string
    {
        if (isset(self::ACTION_LABELS[$routeName])) {
            return self::ACTION_LABELS[$routeName];
        }

        return match ($request->method()) {
            'POST' => 'created or submitted a record',
            'PUT', 'PATCH' => 'updated a record',
            'DELETE' => 'deleted or cancelled a record',
            default => 'performed an action',
        };
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

    /**
     * @param  array<string, mixed>  $parameters
     * @return array<string, mixed>
     */
    private function formatRouteParameters(array $parameters): array
    {
        return collect($parameters)
            ->map(function (mixed $value): mixed {
                if (is_object($value) && method_exists($value, 'getKey')) {
                    return [
                        'type' => class_basename($value),
                        'id' => $value->getKey(),
                    ];
                }

                return $value;
            })
            ->all();
    }
}
