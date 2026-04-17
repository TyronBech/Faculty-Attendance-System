<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Admin>
 */
class AdminFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'admin_code' => strtoupper($this->faker->unique()->bothify('ADM####')),
            'first_name' => $this->faker->firstName(),
            'middle_name' => $this->faker->optional()->firstName(),
            'last_name' => $this->faker->lastName(),
            'suffix_name' => $this->faker->optional()->randomElement(['Jr.', 'Sr.', 'III']),
            'phone' => $this->faker->optional()->phoneNumber(),
            'position_title' => $this->faker->optional()->randomElement([
                'Super Administrator',
                'HR Staff',
                'Academic Head',
                'Registrar Staff',
            ]),
            'employment_type' => $this->faker->optional()->randomElement(['regular', 'contractual']),
            'date_hired' => $this->faker->optional()->date(),
            'is_active' => true,
        ];
    }
}
