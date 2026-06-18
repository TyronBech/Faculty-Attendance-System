<?php

namespace App\Console\Commands;

use App\Models\Agent;
use Illuminate\Console\Command;

class ManageAgentTokenCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'agent-token:manage
        {action : The action to perform (create, list, revoke)}
        {--name= : Agent name (required for create)}
        {--device-ip= : Device IP address (optional for create)}
        {--device-port= : Device port (optional for create)}
        {--branch-id= : Branch ID (optional for create)}
        {--agent-id= : Agent ID (required for revoke)}
        {--token-id= : Token ID (required for revoke)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create, list, or revoke Sanctum tokens for ZKTeco device agents';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $action = $this->argument('action');

        return match ($action) {
            'create' => $this->handleCreate(),
            'list' => $this->handleList(),
            'revoke' => $this->handleRevoke(),
            default => $this->handleUnknownAction($action),
        };
    }

    private function handleCreate(): int
    {
        $name = $this->option('name');

        if (! $name) {
            $this->error('The --name option is required for the create action.');

            return self::FAILURE;
        }

        $agent = Agent::create([
            'name' => $name,
            'device_ip' => $this->option('device-ip'),
            'device_port' => $this->option('device-port') ? (int) $this->option('device-port') : null,
            'branch_id' => $this->option('branch-id') ? (int) $this->option('branch-id') : null,
            'is_active' => true,
        ]);

        $token = $agent->createToken(
            name: 'biometric-sync',
            abilities: ['biometric-logs:push'],
        );

        $this->info('Agent created successfully.');
        $this->newLine();

        $this->table(
            ['Field', 'Value'],
            [
                ['Agent ID', $agent->id],
                ['Name', $agent->name],
                ['Device IP', $agent->device_ip ?? '—'],
                ['Device Port', $agent->device_port ?? '—'],
                ['Branch ID', $agent->branch_id ?? '—'],
            ]
        );

        $this->newLine();
        $this->warn('⚠  Copy the token below. It will NOT be shown again.');
        $this->newLine();
        $this->line('  <fg=green>'.$token->plainTextToken.'</>');
        $this->newLine();

        return self::SUCCESS;
    }

    private function handleList(): int
    {
        $agents = Agent::withCount('tokens')
            ->orderBy('name')
            ->get();

        if ($agents->isEmpty()) {
            $this->info('No agents found.');

            return self::SUCCESS;
        }

        $rows = $agents->map(fn (Agent $agent): array => [
            $agent->id,
            $agent->name,
            $agent->device_ip ?? '—',
            $agent->branch_id ?? '—',
            $agent->is_active ? '✓' : '✗',
            $agent->tokens_count,
            $agent->last_synced_at?->format('Y-m-d H:i:s') ?? 'Never',
        ])->toArray();

        $this->table(
            ['ID', 'Name', 'Device IP', 'Branch', 'Active', 'Tokens', 'Last Synced'],
            $rows
        );

        return self::SUCCESS;
    }

    private function handleRevoke(): int
    {
        $agentId = $this->option('agent-id');
        $tokenId = $this->option('token-id');

        if (! $agentId) {
            $this->error('The --agent-id option is required for the revoke action.');

            return self::FAILURE;
        }

        $agent = Agent::find($agentId);

        if (! $agent) {
            $this->error("Agent with ID {$agentId} not found.");

            return self::FAILURE;
        }

        if ($tokenId) {
            $deleted = $agent->tokens()->where('id', $tokenId)->delete();

            if ($deleted === 0) {
                $this->error("Token with ID {$tokenId} not found for agent '{$agent->name}'.");

                return self::FAILURE;
            }

            $this->info("Token #{$tokenId} revoked for agent '{$agent->name}'.");
        } else {
            $count = $agent->tokens()->count();
            $agent->tokens()->delete();
            $this->info("All {$count} token(s) revoked for agent '{$agent->name}'.");
        }

        return self::SUCCESS;
    }

    private function handleUnknownAction(string $action): int
    {
        $this->error("Unknown action: '{$action}'. Use create, list, or revoke.");

        return self::FAILURE;
    }
}
