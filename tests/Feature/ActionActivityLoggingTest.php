<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActionActivityLoggingTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_requests_are_not_logged_as_actions(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('profile.edit'));

        $this->assertDatabaseCount('activity_log', 0);
    }

    public function test_successful_mutating_requests_are_logged_as_actions(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patch(route('profile.update'), [
            'name' => 'Updated Username',
            'email' => $user->email,
        ])->assertRedirect(route('profile.edit'));

        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'actions',
            'description' => 'PATCH profile.update',
            'event' => 'action',
            'causer_type' => User::class,
            'causer_id' => $user->id,
        ]);
    }
}
