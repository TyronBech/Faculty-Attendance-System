<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class TemporaryFacultyScheduleSyncService
{
    public function __construct(private readonly FlssBackendClient $client)
    {
    }

    /**
     * Pull substitute faculty schedules from FLSS and upsert faculty + schedules + schedule details.
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

                $faculty = $this->upsertFaculty($record, $facultyCode);
                $schedule = $this->upsertSchedule($faculty, $record);

                $activeKeys = [];
                foreach ($schedules as $entry) {
                    if (! is_array($entry)) {
                        $summary['skipped']++;
                        continue;
                    }

                    $payload = $this->buildScheduleDetailPayload($entry);
                    if ($payload === null) {
                        $summary['skipped']++;
                        continue;
                    }

                    $lookup = [
                        'schedule_id' => $schedule->id,
                        'day' => $payload['day'],
                        'start_time' => $payload['start_time'],
                        'end_time' => $payload['end_time'],
                    ];

                    $detail = ScheduleDetail::withTrashed()->firstOrNew($lookup);
                    $detail->fill($payload);
                    if ($detail->trashed()) {
                        $detail->restore();
                    }
                    $detail->save();

                    $activeKeys[] = $this->scheduleDetailKey(
                        $payload['day'],
                        $this->timePart($payload['start_time']),
                        $this->timePart($payload['end_time'])
                    );

                    $summary['processed']++;
                    if ($detail->wasRecentlyCreated) {
                        $summary['created']++;
                    } else {
                        $summary['updated']++;
                    }
                }

                $this->softDeleteStaleScheduleDetails($schedule, $activeKeys);
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

        $records = data_get($payload, 'temporary_faculty_schedules');

        // Backward compatibility for older payload keys used by some environments.
        if (! is_array($records)) {
            $records = data_get($payload, 'parttime_faculty_schedules');
        }

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

    private function upsertFaculty(array $record, string $facultyCode): Faculty
    {
        $externalFacultyId = $this->nullableInteger($record['faculty_id'] ?? null);
        $email = $this->nullableString($record['faculty_email'] ?? null);

        $faculty = null;
        if ($externalFacultyId !== null) {
            $faculty = Faculty::withTrashed()->where('external_faculty_id', $externalFacultyId)->first();
        }
        if (! $faculty) {
            $faculty = Faculty::withTrashed()->where('faculty_code', $facultyCode)->first();
        }

        $user = $faculty?->user_id
            ? User::withTrashed()->find($faculty->user_id)
            : $this->findOrCreateUser($email, $facultyCode);

        $departmentId = $faculty?->department_id ?: $this->resolveDepartmentId($record);

        $faculty = $faculty ?: new Faculty();
        $existingBiometric = $this->nullableString($faculty->biometric_id ?? null);
        $shouldRegenerateBiometric = $existingBiometric === null || str_starts_with($existingBiometric, 'BIOAPI');
        $faculty->fill([
            'external_faculty_id' => $externalFacultyId,
            'user_id' => $user?->id,
            'department_id' => $departmentId,
            'faculty_code' => $facultyCode,
            'biometric_id' => $shouldRegenerateBiometric ? $this->generateUniqueBiometricId() : $existingBiometric,
            'first_name' => $this->nullableString($record['first_name'] ?? null),
            'middle_name' => $this->nullableString($record['middle_name'] ?? null),
            'last_name' => $this->nullableString($record['last_name'] ?? null),
            'suffix_name' => $this->nullableString($record['suffix_name'] ?? null),
            'faculty_type' => 'substitute',
            'employment_type' => 'substitute',
            'assigned_units' => $this->nullableInteger($record['assigned_units'] ?? null),
            'is_active' => true,
        ]);
        if ($faculty->trashed()) {
            $faculty->restore();
        }
        $faculty->save();

        return $faculty;
    }

    private function upsertSchedule(Faculty $faculty, array $record): Schedule
    {
        $externalFacultyId = $this->nullableInteger($record['faculty_id'] ?? null);
        $scheduleCode = 'SCH-SUB-'.$faculty->faculty_code.'-'.date('Y');

        $schedule = null;
        if ($externalFacultyId !== null) {
            $candidateSchedules = Schedule::withTrashed()
                ->where('faculty_id', $faculty->id)
                ->where('external_faculty_id', $externalFacultyId)
                ->orderBy('id')
                ->get();

            $schedule = $candidateSchedules->first(
                fn (Schedule $candidate): bool => str_starts_with((string) $candidate->schedule_code, 'SCH-API-')
            ) ?: $candidateSchedules->first();
        }

        if (! $schedule) {
            $schedule = Schedule::withTrashed()
                ->where('schedule_code', $scheduleCode)
                ->first();
        }

        $schedule = $schedule ?: new Schedule();
        $resolvedScheduleCode = $schedule->exists
            ? (string) $schedule->schedule_code
            : $scheduleCode;
        $schedule->fill([
            'faculty_id' => $faculty->id,
            'external_faculty_id' => $externalFacultyId,
            'schedule_code' => $resolvedScheduleCode,
            'academic_year' => $this->resolveAcademicYear(),
            'semester' => $this->resolveSemester(),
            'effective_from' => now()->startOfYear(),
            'effective_until' => now()->endOfYear(),
            'status' => 'active',
            'schedule_type' => 'fixed',
            'notes' => 'Synced from substitute faculty schedules API for '.($record['faculty_email'] ?? $faculty->faculty_code),
        ]);
        if ($schedule->trashed()) {
            $schedule->restore();
        }
        $schedule->save();

        return $schedule;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>|null
     */
    private function buildScheduleDetailPayload(array $entry): ?array
    {
        $day = $this->nullableString($entry['day'] ?? null);
        if ($day === null) {
            return null;
        }

        $startTime = $this->nullableTime($entry['start_time'] ?? null);
        $endTime = $this->nullableTime($entry['end_time'] ?? null);
        if ($startTime === null || $endTime === null) {
            return null;
        }

        $anchorDate = now()->startOfYear()->toDateString();

        return [
            'day' => $day,
            'start_time' => $anchorDate.' '.$startTime,
            'end_time' => $anchorDate.' '.$endTime,
            'program_code' => $this->nullableString($entry['program_code'] ?? null),
            'program_title' => $this->nullableString($entry['program_title'] ?? null),
            'year_level' => $this->nullableInteger($entry['year_level'] ?? null),
            'section_name' => $this->nullableString($entry['section_name'] ?? null),
            'course_title' => $this->nullableString($entry['course_title'] ?? null),
            'course_code' => $this->nullableString($entry['course_code'] ?? null),
            'room_code' => $this->nullableString($entry['room_code'] ?? null),
            'subject_desc' => $this->nullableString($entry['course_title'] ?? null),
            'hours_required' => $this->nullableDecimal($entry['tuition_hours'] ?? $entry['units'] ?? null) ?? 0,
        ];
    }

    /**
     * @param  array<int, string> $activeKeys
     */
    private function softDeleteStaleScheduleDetails(Schedule $schedule, array $activeKeys): void
    {
        $active = array_fill_keys($activeKeys, true);
        $existing = ScheduleDetail::query()
            ->where('schedule_id', $schedule->id)
            ->get();

        foreach ($existing as $detail) {
            $key = $this->scheduleDetailKey(
                (string) $detail->day,
                optional($detail->start_time)->format('H:i:s') ?? '',
                optional($detail->end_time)->format('H:i:s') ?? ''
            );
            if (! isset($active[$key])) {
                $detail->delete();
            }
        }
    }

    private function scheduleDetailKey(string $day, string $startTime, string $endTime): string
    {
        return implode('|', [$day, $startTime, $endTime]);
    }

    private function timePart(string $dateTime): string
    {
        $timestamp = strtotime($dateTime);

        return $timestamp === false ? $dateTime : date('H:i:s', $timestamp);
    }

    private function findOrCreateUser(?string $email, string $facultyCode): ?User
    {
        if ($email) {
            $existing = User::withTrashed()->where('email', $email)->first();
            if ($existing) {
                if ($existing->trashed()) {
                    $existing->restore();
                }
                return $existing;
            }
        }

        $usernameBase = Str::lower('sub_'.$facultyCode);
        $username = $usernameBase;
        $counter = 1;
        while (User::withTrashed()->where('username', $username)->exists()) {
            $counter++;
            $username = $usernameBase.'_'.$counter;
        }

        $resolvedEmail = $email ?: $username.'@substitute.local';
        if (User::withTrashed()->where('email', $resolvedEmail)->exists()) {
            $resolvedEmail = $username.'_'.Str::lower(Str::random(4)).'@substitute.local';
        }

        return User::create([
            'username' => $username,
            'email' => $resolvedEmail,
            'password' => Hash::make(Str::random(32)),
            'is_active' => false,
        ]);
    }

    private function resolveDepartmentId(array $record): int
    {
        $programCode = $this->nullableString(data_get($record, 'schedules.0.program_code'));
        $departmentCode = match (true) {
            $programCode !== null && str_starts_with($programCode, 'BSIT') => 'BSIT',
            $programCode !== null && str_starts_with($programCode, 'BSCS') => 'BSCS',
            $programCode !== null && str_starts_with($programCode, 'BSBA') => 'BSBA',
            $programCode !== null && str_starts_with($programCode, 'BSED') => 'BSED',
            $programCode !== null && str_starts_with($programCode, 'BSE') => 'BSCE',
            default => null,
        };

        if ($departmentCode) {
            $departmentId = Department::query()->where('code', $departmentCode)->value('id');
            if ($departmentId) {
                return (int) $departmentId;
            }
        }

        $fallbackId = Department::query()->orderBy('id')->value('id');
        if (! $fallbackId) {
            throw new RuntimeException('No department found. Seed at least one department before syncing substitute faculty schedules.');
        }

        return (int) $fallbackId;
    }

    private function generateUniqueBiometricId(): string
    {
        do {
            $candidate = 'SUB'.strtoupper(Str::random(10));
        } while (Faculty::withTrashed()->where('biometric_id', $candidate)->exists());

        return $candidate;
    }

    private function resolveAcademicYear(): int
    {
        $rawYear = data_get(config('app'), 'academic_year');
        if (is_numeric($rawYear)) {
            return (int) $rawYear;
        }

        return (int) now()->format('Y');
    }

    private function resolveSemester(): int
    {
        $month = (int) now()->format('n');
        return $month <= 6 ? 2 : 1;
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
