<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateAdminProfileRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class AdminProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user('admin');
        $user->load('admin');

        return Inertia::render('Admin/Profile/Edit', [
            'adminProfile' => $user->admin,
            'status' => session('status'),
        ]);
    }

    public function update(UpdateAdminProfileRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user('admin');
        $validated = $request->validated();

        DB::transaction(function () use ($user, $validated): void {
            $userPayload = Arr::only($validated, [
                'username',
                'email',
            ]);

            $user->fill($userPayload);

            if ($user->isDirty('email')) {
                $user->email_verified_at = null;
            }

            $user->save();

            $adminPayload = Arr::only($validated, [
                'admin_code',
                'first_name',
                'middle_name',
                'last_name',
                'suffix_name',
                'phone',
                'position_title',
                'employment_type',
                'date_hired',
            ]);

            $user->admin()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    ...$adminPayload,
                    'is_active' => (bool) $user->is_active,
                ]
            );
        });

        return Redirect::route('admin.profile.edit')
            ->with('success', 'Admin profile updated successfully.');
    }
}
