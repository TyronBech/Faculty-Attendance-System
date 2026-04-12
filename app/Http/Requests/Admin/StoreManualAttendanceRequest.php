<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreManualAttendanceRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
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
            'attendance_date' => ['required', 'date_format:Y-m-d'],
            'faculty_ids' => ['required', 'array', 'min:1'],
            'faculty_ids.*' => ['required', 'integer', 'distinct', 'exists:faculties,id'],
            'remarks' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'attendance_date.required' => 'Please select the attendance date.',
            'attendance_date.date_format' => 'Attendance date must follow YYYY-MM-DD format.',
            'faculty_ids.required' => 'Select at least one faculty member.',
            'faculty_ids.array' => 'Selected faculty data is invalid.',
            'faculty_ids.min' => 'Select at least one faculty member.',
            'faculty_ids.*.exists' => 'One or more selected faculty members do not exist.',
            'remarks.required' => 'Remarks are required before submitting manual attendance.',
            'remarks.min' => 'Remarks must be at least :min characters.',
        ];
    }
}
