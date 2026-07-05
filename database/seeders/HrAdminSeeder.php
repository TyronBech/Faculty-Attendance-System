<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class HrAdminSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::updateOrCreate(
            ['email' => 'hradmin@university.edu'],
            [
                'username' => 'hradmin',
                'password' => Hash::make('password'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $role = Role::where('name', 'hr_admin')
            ->where('guard_name', 'admin')
            ->firstOrFail();

        $user->syncRoles([$role]);

        Admin::updateOrCreate(
            ['user_id' => $user->id],
            [
                'admin_code' => 'ADM0005',
                'first_name' => 'HR',
                'middle_name' => null,
                'last_name' => 'Admin',
                'suffix_name' => null,
                'phone' => '09170000005',
                'position_title' => 'HR Administrator',
                'employment_type' => 'regular',
                'date_hired' => now()->subYears(2)->toDateString(),
                'is_active' => true,
            ]
        );
    }
}
