<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:60',
                'regex:/^[A-Za-z0-9_]+$/',
                Rule::unique('roles', 'name')->where('guard_name', 'admin'),
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => [
                'string',
                Rule::exists('permissions', 'name')->where('guard_name', 'admin'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.regex' => 'Role name may contain letters, numbers, and underscores only.',
        ];
    }
}
