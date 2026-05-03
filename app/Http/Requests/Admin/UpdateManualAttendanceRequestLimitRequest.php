<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateManualAttendanceRequestLimitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('admin') !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'manual_request_limit' => ['required', 'integer', 'min:1', 'max:999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'manual_request_limit.required' => 'Manual attendance request limit is required.',
            'manual_request_limit.integer' => 'Manual attendance request limit must be a whole number.',
            'manual_request_limit.min' => 'Manual attendance request limit must be at least :min.',
            'manual_request_limit.max' => 'Manual attendance request limit must not exceed :max.',
        ];
    }
}
