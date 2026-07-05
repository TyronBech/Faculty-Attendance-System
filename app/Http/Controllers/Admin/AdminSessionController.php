<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminSessionController extends Controller
{
    /**
     * Show the admin login form.
     */
    public function create(): Response|RedirectResponse
    {
        // Already logged in as admin → go to dashboard
        if (Auth::guard('admin')->check()) {
            return redirect()->route('admin.dashboard');
        }

        return Inertia::render('Admin/Login', [
            'status'           => session('status'),
            'canResetPassword' => true,
        ]);
    }

    /**
     * Handle an admin login request.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Rate limiting
        $throttleKey = Str::transliterate(Str::lower($request->string('email')).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'email' => trans('auth.throttle', [
                    'seconds' => $seconds,
                    'minutes' => ceil($seconds / 60),
                ]),
            ]);
        }

        // Attempt login via the admin guard
        if (! Auth::guard('admin')->attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            RateLimiter::hit($throttleKey);

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        // Ensure the authenticated user has an admin-level role
        $user = User::findOrFail(Auth::guard('admin')->user()->id);
        $adminRoles = ['super_admin', 'admin', 'hr_admin', 'hr_staff', 'head_academic_program'];

        if (! $user->hasAnyRole($adminRoles)) {
            Auth::guard('admin')->logout();
            RateLimiter::hit($throttleKey);

            throw ValidationException::withMessages([
                'email' => 'You do not have permission to access the admin area.',
            ]);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();

        return redirect()->intended(route('admin.dashboard'));
    }

    /**
     * Destroy the admin session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('admin')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
