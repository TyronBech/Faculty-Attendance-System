<?php

namespace App\Services;

use App\Models\Faculty;
use App\Models\TemporaryFacultySchedule;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TemporaryFacultyScheduleSyncService
{
    public function __construct(private readonly FlssBackendClient $client)
    {
    }

    /**
     * Pull temporary faculty schedules from FLSS and store one row per schedule entry.
     *
     * @return array{processed: int, created: int, updated: int, unmatched_faculty: int, skipped: int}
     */
    public function syncFromApi(array $query = ['per_page' => 500], ?string $url = null): array
    {
        $url = $this->nullableString($url);
        $response = $url
            ? $this->client->request('GET', $url, $query)
            : $this->client->getTemporaryFacultySchedules($query);
        $records = $this->parseResponse($response, $url ?? (string) config('services.flss_backend.temporary_schedules_url'));

        return DB::transaction(function () use ($records) {
            $summary = [
                'processed' => 0,
                'created' => 0,
                'updated' => 0,
                'unmatched_faculty' => 0,
                'skipped' => 0,
            ];

            foreach ($records as $record) {
                $facultyCode = $this->nullableString($record['faculty_code'] ?? null);
                $schedules = $record['schedules'] ?? [];

                if ($facultyCode === null || ! is_array($schedules)) {
                    $summary['skipped']++;
                    continue;
                }

                $facultyId = Faculty::query()
                    ->where('faculty_code', $facultyCode)
                    ->value('id');

                if ($facultyId === null) {
                    $summary['unmatched_faculty']++;
                }

                foreach ($schedules as $entry) {
                    if (! is_array($entry)) {
                        $summary['skipped']++;
                        continue;
                    }

                    $payload = $this->buildPayload($record, $entry, $facultyCode, $facultyId ? (int) $facultyId : null);
                    if ($payload === null) {
                        $summary['skipped']++;
                        continue;
                    }

                    $model = TemporaryFacultySchedule::withTrashed()->firstOrNew([
                        'source_hash' => $payload['source_hash'],
                    ]);
                    $model->fill($payload);
                    if ($model->trashed()) {
                        $model->restore();
                    }
                    $model->save();

                    $summary['processed']++;
                    if ($model->wasRecentlyCreated) {
                        $summary['created']++;
                    } else {
                        $summary['updated']++;
                    }
                }
            }

            return $summary;
        });
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseResponse(Response $response, string $url): array
    {
        if (! $response->successful()) {
            $body = trim($response->body());
            $body = $body === '' ? 'No response body.' : mb_strimwidth($body, 0, 500, '...');

            throw new RuntimeException(
                "Temporary faculty schedules API request failed. HTTP {$response->status()} for {$url}. Response: {$body}"
            );
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new RuntimeException('Temporary faculty schedules API returned an invalid JSON payload.');
        }

        $records = data_get($payload, 'parttime_faculty_schedules');

        if (! is_array($records)) {
            $records = data_get($payload, 'data.parttime_faculty_schedules');
        }

        if (! is_array($records)) {
            $records = data_get($payload, 'data');
        }

        if (! is_array($records)) {
            $records = $payload;
        }

        if (isset($records['faculty_code']) && isset($records['schedules'])) {
            $records = [$records];
        }

        return array_values(array_filter($records, fn ($record) => is_array($record)));
    }

    /**
     * @param  array<string, mixed>  $record
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>|null
     */
    private function buildPayload(array $record, array $entry, string $facultyCode, ?int $facultyId): ?array
    {
        $day = $this->nullableString($entry['day'] ?? null);

        if ($day === null) {
            return null;
        }

        $courseDetails = data_get($entry, 'course_details');
        $courseDetails = is_array($courseDetails) ? $courseDetails : [];
        $sourceHash = $this->sourceHash($facultyCode, $entry, $courseDetails);

        return [
            'faculty_id' => $facultyId,
            'external_faculty_id' => $this->nullableInteger($record['faculty_id'] ?? null),
            'faculty_code' => $facultyCode,
            'faculty_email' => $this->nullableString($record['faculty_email'] ?? null),
            'first_name' => $this->nullableString($record['first_name'] ?? null),
            'middle_name' => $this->nullableString($record['middle_name'] ?? null),
            'last_name' => $this->nullableString($record['last_name'] ?? null),
            'suffix_name' => $this->nullableString($record['suffix_name'] ?? null),
            'faculty_type' => $this->nullableString($record['faculty_type'] ?? null),
            'assigned_units' => $this->nullableDecimal($record['assigned_units'] ?? null),
            'day' => $day,
            'start_time' => $this->nullableTime($entry['start_time'] ?? null),
            'end_time' => $this->nullableTime($entry['end_time'] ?? null),
            'room_code' => $this->nullableString($entry['room_code'] ?? null),
            'program_code' => $this->nullableString($entry['program_code'] ?? null),
            'program_title' => $this->nullableString($entry['program_title'] ?? null),
            'year_level' => $this->nullableInteger($entry['year_level'] ?? null),
            'section_name' => $this->nullableString($entry['section_name'] ?? null),
            'course_assignment_id' => $this->nullableInteger($courseDetails['course_assignment_id'] ?? $entry['course_assignment_id'] ?? null),
            'course_title' => $this->nullableString($courseDetails['course_title'] ?? $entry['course_title'] ?? null),
            'course_code' => $this->nullableString($courseDetails['course_code'] ?? $entry['course_code'] ?? null),
            'lec' => $this->nullableDecimal($courseDetails['lec'] ?? $entry['lec'] ?? null),
            'lab' => $this->nullableDecimal($courseDetails['lab'] ?? $entry['lab'] ?? null),
            'units' => $this->nullableDecimal($courseDetails['units'] ?? $entry['units'] ?? null),
            'tuition_hours' => $this->nullableDecimal($courseDetails['tuition_hours'] ?? $entry['tuition_hours'] ?? null),
            'source_hash' => $sourceHash,
            'raw_payload' => [
                'faculty' => Arr::except($record, ['schedules']),
                'schedule' => $entry,
            ],
            'synced_at' => now(),
        ];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, mixed>  $courseDetails
     */
    private function sourceHash(string $facultyCode, array $entry, array $courseDetails): string
    {
        $parts = [
            $facultyCode,
            $this->nullableString($entry['day'] ?? null),
            $this->nullableTime($entry['start_time'] ?? null),
            $this->nullableTime($entry['end_time'] ?? null),
            $this->nullableString($entry['room_code'] ?? null),
            $this->nullableString($entry['program_code'] ?? null),
            $this->nullableString($entry['year_level'] ?? null),
            $this->nullableString($entry['section_name'] ?? null),
            $this->nullableString($courseDetails['course_assignment_id'] ?? $entry['course_assignment_id'] ?? null),
            $this->nullableString($courseDetails['course_code'] ?? $entry['course_code'] ?? null),
        ];

        return hash('sha256', implode('|', array_map(fn ($part) => (string) $part, $parts)));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function nullableInteger(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function nullableDecimal(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function nullableTime(mixed $value): ?string
    {
        $normalized = $this->nullableString($value);

        if ($normalized === null) {
            return null;
        }

        $timestamp = strtotime($normalized);

        return $timestamp === false ? $normalized : date('H:i:s', $timestamp);
    }
}
