<?php

use App\Http\Controllers\ProfileController;
use App\Models\User;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/debug-headers', function (\Illuminate\Http\Request $request) {
    return response()->json([
        'x_inertia' => $request->header('X-Inertia'),
        'server_x_inertia' => $_SERVER['HTTP_X_INERTIA'] ?? null,
        'x_requested_with' => $request->header('X-Requested-With'),
        'server_x_requested_with' => $_SERVER['HTTP_X_REQUESTED_WITH'] ?? null,
        'accept' => $request->header('Accept'),
        'server_accept' => $_SERVER['HTTP_ACCEPT'] ?? null,
    ]);
});

Route::get('/debug-headers-sent', function () {
    $file = null;
    $line = null;

    return response()->json([
        'headers_sent' => headers_sent($file, $line),
        'file' => $file,
        'line' => $line,
        'ob_level' => ob_get_level(),
        'ob_length' => ob_get_length(),
    ]);
});

Route::get('/', function () {
    // Redirect already-authenticated users to their dashboard
    if (Auth::guard('admin')->check()) {
        return redirect()->route('admin.dashboard');
    }

    if (Auth::guard('web')->check()) {
        $user = User::findOrFail(Auth::guard('web')->user()->id);
        return redirect()->route(
            $user->hasRole('faculty') ? 'faculty.dashboard' : 'dashboard'
        );
    }

    return Inertia::render('Welcome');
})->name('home');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__ . '/auth.php';
require __DIR__ . '/admin.php';
require __DIR__ . '/faculty.php';
