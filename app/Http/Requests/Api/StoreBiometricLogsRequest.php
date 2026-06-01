<?php

namespace App\Http\Requests\Api;

use App\Models\Agent;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreBiometricLogsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Requires the authenticated model to be an active Agent
     * with the 'biometric-logs:push' token ability.
     */
    public function authorize(): bool
    {
        $agent = $this->user();

        return $agent instanceof Agent
            && $agent->is_active
            && $agent->tokenCan('biometric-logs:push');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'device_id' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'integer', 'min:1'],
            'source' => ['nullable', 'string', 'max:100'],
            'auto_sync' => ['sometimes', 'boolean'],
            'logs' => ['required', 'array', 'min:1'],
            'logs.*' => ['required', 'array'],
        ];
    }
}
