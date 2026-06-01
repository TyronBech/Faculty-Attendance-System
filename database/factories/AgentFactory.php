<?php

namespace Database\Factories;

use App\Models\Agent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Agent>
 */
class AgentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'ZKTeco Agent - '.$this->faker->unique()->company(),
            'device_ip' => $this->faker->localIpv4(),
            'device_port' => $this->faker->numberBetween(4000, 5000),
            'branch_id' => $this->faker->numberBetween(1, 5),
            'is_active' => true,
            'last_synced_at' => null,
        ];
    }

    /**
     * Indicate that the agent is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }
}
