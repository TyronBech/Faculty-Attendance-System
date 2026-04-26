<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\User;
use App\Services\FlssBackendClient;
use Illuminate\Database\Seeder;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;

class FacultySeeder extends Seeder
{
    /**
     * Faculty records are sourced from the external API.
     */
    public function run(): void
    {
        DB::beginTransaction();
        try {
            $officialRecords = $this->fetchFacultySchedulesFromApi();
            $temporaryRecords = $this->fetchTemporaryFacultySchedulesFromApi();

            // Merge records, temporary records take precedence or are just added
            // Since we use updateOrCreate, it should handle duplicates correctly
            $records = array_merge($officialRecords, $temporaryRecords);

            // Resolve department IDs by code
            $deptIds = Department::pluck('id', 'code');
            // Resolve user IDs by email
            $userIds = User::pluck('id', 'email');

            foreach ($records as $item) {
                $email = strtolower(trim((string) ($item['faculty_email'] ?? '')));
                $facultyCode = trim((string) ($item['faculty_code'] ?? ''));

                if ($email === '' || $facultyCode === '' || ! isset($userIds[$email])) {
                    continue;
                }

                $firstProgramCode = (string) data_get($item, 'schedules.0.program_code', '');
                $programPrefix = strtoupper(strtok($firstProgramCode, '-'));
                $programToDept = [
                    'DIT' => 'BSIT',
                    'DOMT' => 'BSBA',
                    'BSOA' => 'BSBA',
                ];

                $deptCode = $programToDept[$programPrefix] ?? $programPrefix;
                $departmentId = $deptIds[$deptCode] ?? $deptIds->first();

                $facultyTypeRaw = trim((string) ($item['faculty_type'] ?? ''));

                Faculty::updateOrCreate(
                    ['faculty_code' => $facultyCode],
                    [
                        'external_faculty_id' => ($item['faculty_id'] ?? null) !== null ? (int) $item['faculty_id'] : null,
                        'user_id' => $userIds[$email],
                        'department_id' => $departmentId,
                        'faculty_code' => $facultyCode,
                        'biometric_id' => 'BIOAPI'.str_pad((string) ($item['faculty_id'] ?? 0), 3, '0', STR_PAD_LEFT),
                        'first_name' => (string) ($item['first_name'] ?? ''),
                        'middle_name' => $item['middle_name'] ?: null,
                        'last_name' => (string) ($item['last_name'] ?? ''),
                        'suffix_name' => $item['suffix_name'] ?: null,
                        'faculty_type' => $facultyTypeRaw !== '' ? $facultyTypeRaw : null,
                        'assigned_units' => (int) ($item['assigned_units'] ?? 0),
                        'phone' => null,
                        'employment_type' => str_contains(strtolower($facultyTypeRaw), 'part') ? 'part_time' : 'regular',
                        'date_hired' => null,
                        'is_active' => true,
                    ]
                );
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchFacultySchedulesFromApi(): array
    {
        $client = app(FlssBackendClient::class);
        $response = $client->getFacultySchedules(['per_page' => 500]);

        return $this->parseApiResponse($response, 'official');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchTemporaryFacultySchedulesFromApi(): array
    {
        $client = app(FlssBackendClient::class);
        $response = $client->getTemporaryFacultySchedules(['per_page' => 500]);

        return $this->parseApiResponse($response, 'temporary');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseApiResponse(Response $response, string $type): array
    {
        if (! $response->successful()) {
            if ($type === 'temporary') {
                logger()->warning("External temporary schedules API returned {$response->status()}. Skipping temporary seeding.");

                return [];
            }
            throw new \RuntimeException("External {$type} schedules API request failed while seeding faculties. HTTP ".$response->status());
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException("External {$type} schedules API returned an invalid JSON payload while seeding faculties.");
        }

        $records = data_get($payload, 'parttime_faculty_schedules');

        if (! is_array($records)) {
            $records = data_get($payload, 'data.parttime_faculty_schedules');
        }

        if (! is_array($records)) {
            $records = data_get($payload, 'data');
        }

        if (! is_array($records)) {
            $records = [];
        }

        return array_values(array_filter($records, fn ($record) => is_array($record)));
    }
}
