<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response|RedirectResponse
    {
        // Redirect already-authenticated users to their correct dashboard
        if (Auth::guard('admin')->check()) {
            return redirect()->route('admin.dashboard');
        }

        if (Auth::guard('web')->check()) {
            $user = User::findOrFail(Auth::guard('web')->user()->id);
            return redirect()->route(
                $user->hasRole('faculty') ? 'faculty.dashboard' : 'dashboard'
            );
        }

        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $user = $request->user();

        // Block admin-role users from logging in through the faculty portal
        $adminRoles = ['super_admin', 'admin', 'hr_admin', 'hr_staff', 'head_academic_program'];
        if ($user->hasAnyRole($adminRoles)) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Admin accounts must log in through the Admin Portal.',
            ]);
        }

        $request->session()->regenerate();

        // Redirect faculty users to the faculty dashboard
        if ($user->hasRole('faculty')) {
            return redirect()->intended(route('faculty.dashboard', absolute: false));
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
