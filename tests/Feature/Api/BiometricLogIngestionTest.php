<?php

namespace Tests\Feature\Api;

use App\Jobs\SyncImportBatchJob;
use App\Models\Agent;
use App\Models\BiometricLog;
use App\Models\Faculty;
use App\Models\ImportBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BiometricLogIngestionTest extends TestCase
{
    use RefreshDatabase;

    /* ------------------------------------------------------------------ */
    /*  Authentication & Authorization */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [['id' => '1', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0]],
        ]);

        $response->assertStatus(401);
    }

    public function test_user_token_is_rejected_with_403(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [['id' => '1', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0]],
        ]);

        $response->assertStatus(403);
    }

    public function test_agent_token_without_push_ability_returns_403(): void
    {
        $agent = Agent::factory()->create();

        Sanctum::actingAs($agent, ['some-other-ability']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [['id' => '1', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0]],
        ]);

        $response->assertStatus(403);
    }

    public function test_inactive_agent_returns_403(): void
    {
        $agent = Agent::factory()->inactive()->create();

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [['id' => '1', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0]],
        ]);

        $response->assertStatus(403);
    }

    /* ------------------------------------------------------------------ */
    /*  Validation */
    /* ------------------------------------------------------------------ */

    public function test_empty_logs_array_returns_422(): void
    {
        $agent = Agent::factory()->create();

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['logs']);
    }

    public function test_missing_logs_key_returns_422(): void
    {
        $agent = Agent::factory()->create();

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'device_id' => 'ZK-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['logs']);
    }

    public function test_more_than_500_logs_returns_422(): void
    {
        $agent = Agent::factory()->create();

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => array_fill(0, 501, [
                'id' => '1',
                'timestamp' => '2026-06-01 08:00:00',
                'state' => 0,
            ]),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['logs']);
    }

    /* ------------------------------------------------------------------ */
    /*  Successful Ingestion */
    /* ------------------------------------------------------------------ */

    public function test_valid_push_creates_biometric_logs_and_returns_summary(): void
    {
        Queue::fake();

        $agent = Agent::factory()->create(['branch_id' => 1]);
        $faculty = Faculty::factory()->create(['biometric_id' => '101']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'device_id' => 'ZK-001',
            'logs' => [
                ['id' => '101', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0],
                ['id' => '101', 'timestamp' => '2026-06-01 17:00:00', 'state' => 1],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Biometric logs received.')
            ->assertJsonPath('data.inserted', 2)
            ->assertJsonPath('data.failed', 0)
            ->assertJsonPath('data.duplicates', 0);

        $this->assertDatabaseCount('biometric_logs', 2);

        $this->assertDatabaseHas('biometric_logs', [
            'biometric_id' => '101',
            'log_type' => 'IN',
            'device_id' => 'ZK-001',
        ]);

        $this->assertDatabaseHas('biometric_logs', [
            'biometric_id' => '101',
            'log_type' => 'OUT',
            'device_id' => 'ZK-001',
        ]);

        Queue::assertPushed(SyncImportBatchJob::class);
    }

    public function test_import_batch_is_attributed_to_agent(): void
    {
        $agent = Agent::factory()->create();
        $faculty = Faculty::factory()->create(['biometric_id' => '202']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $this->postJson('/api/biometric-logs', [
            'logs' => [
                ['id' => '202', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0],
            ],
        ]);

        $batch = ImportBatch::latest()->first();

        $this->assertNotNull($batch);
        $this->assertEquals($agent->id, $batch->agent_id);
        $this->assertNull($batch->imported_by);
    }

    public function test_agent_last_synced_at_is_updated(): void
    {
        $agent = Agent::factory()->create(['last_synced_at' => null]);
        $faculty = Faculty::factory()->create(['biometric_id' => '303']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $this->postJson('/api/biometric-logs', [
            'logs' => [
                ['id' => '303', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0],
            ],
        ]);

        $agent->refresh();

        $this->assertNotNull($agent->last_synced_at);
    }

    /* ------------------------------------------------------------------ */
    /*  Duplicate Handling */
    /* ------------------------------------------------------------------ */

    public function test_duplicate_logs_are_counted_in_response(): void
    {
        $agent = Agent::factory()->create();
        $faculty = Faculty::factory()->create(['biometric_id' => '404']);

        // Pre-create a log that will be a duplicate.
        BiometricLog::create([
            'biometric_id' => '404',
            'log_datetime' => '2026-06-01 08:00:00',
            'log_type' => 'IN',
            'device_id' => 'ZK-001',
            'is_processed' => false,
        ]);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'device_id' => 'ZK-001',
            'logs' => [
                ['id' => '404', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0],
                ['id' => '404', 'timestamp' => '2026-06-01 17:00:00', 'state' => 1],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.inserted', 1)
            ->assertJsonPath('data.duplicates', 1);
    }

    public function test_duplicate_logs_within_the_same_batch_are_counted(): void
    {
        $agent = Agent::factory()->create();
        $faculty = Faculty::factory()->create(['biometric_id' => '405']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $log = ['id' => '405', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0];

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [$log, $log],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.inserted', 1)
            ->assertJsonPath('data.duplicates', 1);
    }

    /* ------------------------------------------------------------------ */
    /*  Malformed Log Entries */
    /* ------------------------------------------------------------------ */

    public function test_malformed_logs_surface_errors_without_crashing(): void
    {
        $agent = Agent::factory()->create();
        $faculty = Faculty::factory()->create(['biometric_id' => '505']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [
                // Valid log.
                ['id' => '505', 'timestamp' => '2026-06-01 08:00:00', 'state' => 0],
                // Missing biometric_id.
                ['timestamp' => '2026-06-01 09:00:00', 'state' => 0],
                // Missing timestamp.
                ['id' => '505', 'state' => 1],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.inserted', 1)
            ->assertJsonPath('data.failed', 2);

        $this->assertNotEmpty($response->json('data.errors'));
    }

    /* ------------------------------------------------------------------ */
    /*  Payload Variations */
    /* ------------------------------------------------------------------ */

    public function test_zkteco_indexed_array_format_is_accepted(): void
    {
        $agent = Agent::factory()->create();
        $faculty = Faculty::factory()->create(['biometric_id' => '606']);

        Sanctum::actingAs($agent, ['biometric-logs:push']);

        // ZKTeco SDK returns logs as indexed arrays: [uid, id, state, timestamp, type]
        $response = $this->postJson('/api/biometric-logs', [
            'logs' => [
                [1, '606', 0, '2026-06-01 08:00:00', 1],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.inserted', 1);

        $this->assertDatabaseHas('biometric_logs', [
            'biometric_id' => '606',
            'log_type' => 'IN',
        ]);
    }
}
