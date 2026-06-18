<?php

use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\EnsureAdminAuthenticated;
use App\Http\Middleware\EnsureFacultyAuthenticated;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LogActionActivity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            LogActionActivity::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // ── Guard-aware authentication ──────────────────────────────────────
        // auth.admin  → checks the 'admin' guard (super_admin / admin / hr_staff)
        // auth.faculty → checks the 'web' guard (faculty)
        $middleware->alias([
            'auth.admin' => EnsureAdminAuthenticated::class,
            'auth.faculty' => EnsureFacultyAuthenticated::class,
            'check.role' => CheckRole::class,
            'check.permission' => CheckPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
