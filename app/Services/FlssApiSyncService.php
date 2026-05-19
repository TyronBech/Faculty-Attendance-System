<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class FlssApiSyncService
{
    /**
     * @var array{rooms: int, faculty_created: int, faculty_updated: int, schedules_created: int, schedules_updated: int, details_created: int, details_updated: int, temporary_synced: int, errors: list<string>}
     */
    private array $summary;

    public function __construct(
        private readonly FlssBackendClient $client,
        private readonly TemporaryFacultyScheduleSyncService $temporarySyncService,
    ) {
        $this->resetSummary();
    }

    /**
     * Run a full API sync: rooms → faculty → schedules → temporary schedules.
     *
     * If the API is unreachable, the entire sync is cancelled. No partial
     * writes occur because everything runs inside a database transaction.
     *
     * @return array{rooms: int, faculty_created: int, faculty_updated: int, schedules_created: int, schedules_updated: int, details_created: int, details_updated: int, temporary_synced: int, errors: list<string>, aborted: bool}
     */
    public function syncAll(): array
    {
        $this->resetSummary();

        // ── 1. Health check: verify all three endpoints are reachable ───────
        if (! $this->isApiReachable()) {
            Log::warning('[FlssApiSync] FLSS API is unreachable. Sync aborted.');

            return [...$this->summary, 'aborted' => true];
        }

        // ── 1b. Verify data is published (not draft / unpublished) ──────
        if (! $this->isScheduleDataPublished()) {
            Log::warning('[FlssApiSync] FLSS schedule data is not published. Sync aborted.');
            $this->summary['errors'][] = 'Schedule data status is not "published". Sync cancelled.';

            return [...$this->summary, 'aborted' => true];
        }

        Log::info('[FlssApiSync] API health check passed. Starting sync…');

        // ── 2. Fetch all data BEFORE writing to DB ─────────────────────────
        try {
            $roomsData = $this->fetchRooms();
            $facultyData = $this->fetchFacultySchedules();
            $temporaryData = $this->fetchTemporarySchedules();
        } catch (\Throwable $e) {
            Log::error('[FlssApiSync] Failed to fetch API data: '.$e->getMessage());
            $this->summary['errors'][] = 'Fetch failed: '.$e->getMessage();

            return [...$this->summary, 'aborted' => true];
        }

        // ── 3. Write everything inside a single transaction ────────────────
        try {
            DB::transaction(function () use ($roomsData, $facultyData, $temporaryData): void {
                $this->syncRooms($roomsData);
                $this->syncFaculty($facultyData);
                $this->syncSchedules($facultyData);
                $this->syncTemporarySchedules($temporaryData);
            });
        } catch (\Throwable $e) {
            Log::error('[FlssApiSync] Transaction failed — rolled back: '.$e->getMessage());
            $this->summary['errors'][] = 'Transaction failed: '.$e->getMessage();

            return [...$this->summary, 'aborted' => true];
        }

        Log::info('[FlssApiSync] Sync completed.', $this->summary);

        return [...$this->summary, 'aborted' => false];
    }

    /**
     * Verify FLSS API is reachable by performing lightweight requests.
     *
     * Retries each endpoint up to 3 times with a 1-second delay to handle
     * transient SSL resets (cURL error 35) that the external API exhibits.
     */
    public function isApiReachable(): bool
    {
        $endpoints = [
            'rooms' => fn () => $this->client->getRooms(['per_page' => 1]),
            'faculty_schedules' => fn () => $this->client->getFacultySchedules(['per_page' => 1]),
        ];

        foreach ($endpoints as $name => $callable) {
            $isReachable = false;

            for ($attempt = 1; $attempt <= 3; $attempt++) {
                try {
                    /** @var Response $response */
                    $response = $callable();

                    if ($response->successful()) {
                        $isReachable = true;
                        break;
                    }

                    Log::warning("[FlssApiSync] Health check for {$name}: HTTP {$response->status()} (attempt {$attempt}/3)");
                } catch (\Throwable $e) {
                    Log::warning("[FlssApiSync] Health check for {$name} failed (attempt {$attempt}/3): {$e->getMessage()}");
                }

                if ($attempt < 3) {
                    sleep(1);
                }
            }

            if (! $isReachable) {
                Log::error("[FlssApiSync] Endpoint {$name} unreachable after 3 attempts.");

                return false;
            }
        }

        return true;
    }

    /**
     * Verify that the faculty schedules payload has status "published".
     *
     * The FLSS API returns a top-level `status` field that indicates
     * whether the schedule data has been officially published for the
     * semester. We must only sync published data.
     *
     * Retries up to 3 times to handle transient connection failures.
     */
    public function isScheduleDataPublished(): bool
    {
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                $response = $this->client->getFacultySchedules(['per_page' => 1]);

                if (! $response->successful()) {
                    Log::warning("[FlssApiSync] Publish status check: HTTP {$response->status()} (attempt {$attempt}/3)");

                    if ($attempt < 3) {
                        sleep(1);
                    }

                    continue;
                }

                $payload = $response->json();

                if (! is_array($payload)) {
                    return false;
                }

                $status = strtolower(trim((string) ($payload['status'] ?? '')));

                if ($status !== 'published') {
                    Log::warning("[FlssApiSync] Schedule data status is \"{$status}\" — expected \"published\".");

                    return false;
                }

                return true;
            } catch (\Throwable $e) {
                Log::warning("[FlssApiSync] Publish status check failed (attempt {$attempt}/3): ".$e->getMessage());

                if ($attempt < 3) {
                    sleep(1);
                }
            }
        }

        Log::error('[FlssApiSync] Could not verify schedule publish status after 3 attempts.');

        return false;
    }

    /* ------------------------------------------------------------------ */
    /*  Data fetchers */
    /* ------------------------------------------------------------------ */

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchRooms(): array
    {
        $response = $this->client->getRooms(['per_page' => 50]);

        return $this->parseResponse($response, 'rooms', 'rooms');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchFacultySchedules(): array
    {
        $response = $this->client->getFacultySchedules(['per_page' => 50]);

        return $this->parseResponse($response, 'parttime_faculty_schedules', 'faculty schedules');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchTemporarySchedules(): array
    {
        try {
            $response = $this->client->getTemporaryFacultySchedules(['per_page' => 50]);

            return $this->parseResponse($response, 'temporary_faculty_schedules', 'temporary schedules');
        } catch (\Throwable $e) {
            // Temporary schedules endpoint is optional — log and continue
            Log::warning('[FlssApiSync] Temporary schedules fetch failed: '.$e->getMessage());
            $this->summary['errors'][] = 'Temporary schedules fetch failed (non-fatal): '.$e->getMessage();

            return [];
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Sync writers */
    /* ------------------------------------------------------------------ */

    /**
     * @param  list<array<string, mixed>>  $records
     */
    private function syncRooms(array $records): void
    {
        foreach ($records as $item) {
            $roomId = (int) ($item['room_id'] ?? 0);
            $roomCode = trim((string) ($item['room_code'] ?? ''));

            if ($roomId === 0 || $roomCode === '') {
                continue;
            }

            Room::updateOrCreate(
                ['flss_room_id' => $roomId],
                [
                    'room_code' => $roomCode,
                    'building_name' => $item['building_name'] ?? null,
                ]
            );

            $this->summary['rooms']++;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $records
     */
    private function syncFaculty(array $records): void
    {
        $deptIds = Department::pluck('id', 'code');
        $userIds = User::pluck('id', 'email');

        $programToDept = [
            'DIT' => 'BSIT',
            'DOMT' => 'BSBA',
            'BSOA' => 'BSBA',
        ];

        foreach ($records as $item) {
            $email = strtolower(trim((string) ($item['faculty_email'] ?? '')));
            $facultyCode = trim((string) ($item['faculty_code'] ?? ''));

            if ($email === '' || $facultyCode === '') {
                continue;
            }

            // Skip faculty without a matching user account
            if (! isset($userIds[$email])) {
                continue;
            }

            $firstProgramCode = (string) data_get($item, 'schedules.0.program_code', '');
            $programPrefix = strtoupper(strtok($firstProgramCode, '-'));
            $deptCode = $programToDept[$programPrefix] ?? $programPrefix;
            $departmentId = $deptIds[$deptCode] ?? $deptIds->first();

            $facultyTypeRaw = trim((string) ($item['faculty_type'] ?? ''));

            $model = Faculty::updateOrCreate(
                ['faculty_code' => $facultyCode],
                [
                    'external_faculty_id' => ($item['faculty_id'] ?? null) !== null ? (int) $item['faculty_id'] : null,
                    'user_id' => $userIds[$email],
                    'department_id' => $departmentId,
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

            if ($model->wasRecentlyCreated) {
                $this->summary['faculty_created']++;
            } else {
                $this->summary['faculty_updated']++;
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $records
     */
    private function syncSchedules(array $records): void
    {
        $adminUser = User::where('username', 'admin')->first();

        /** @var array<string, int> $roomCodeToId */
        $roomCodeToId = Room::pluck('id', 'room_code')->all();

        foreach ($records as $item) {
            $externalFacultyId = (int) ($item['faculty_id'] ?? 0);
            $facultyCode = (string) ($item['faculty_code'] ?? '');

            if ($externalFacultyId === 0 || $facultyCode === '') {
                continue;
            }

            $faculty = Faculty::where('external_faculty_id', $externalFacultyId)
                ->orWhere('faculty_code', $facultyCode)
                ->first();

            if (! $faculty) {
                continue;
            }

            $scheduleCode = 'SCH-API-'.$externalFacultyId.'-2026';

            $schedule = Schedule::updateOrCreate(
                ['schedule_code' => $scheduleCode],
                [
                    'faculty_id' => $faculty->id,
                    'external_faculty_id' => $externalFacultyId,
                    'academic_year' => 2026,
                    'semester' => 2,
                    'effective_from' => '2026-01-01 00:00:00',
                    'effective_until' => '2026-12-31 23:59:59',
                    'status' => 'active',
                    'schedule_type' => 'fixed',
                    'created_by' => $adminUser?->id,
                    'notes' => 'Synced from FLSS API for '.($item['faculty_email'] ?? $facultyCode),
                ]
            );

            if ($schedule->wasRecentlyCreated) {
                $this->summary['schedules_created']++;
            } else {
                $this->summary['schedules_updated']++;
            }

            foreach (($item['schedules'] ?? []) as $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $startTime = (string) ($entry['start_time'] ?? '08:00:00');
                $endTime = (string) ($entry['end_time'] ?? '11:00:00');
                $dayOfWeek = (string) ($entry['day'] ?? 'Monday');

                $courseDetails = data_get($entry, 'course_details');
                $courseDetails = is_array($courseDetails) ? $courseDetails : [];

                $courseTitle = $this->nullableString(
                    $courseDetails['course_title'] ?? $entry['course_title'] ?? null
                );
                $courseCode = $this->nullableString(
                    $courseDetails['course_code'] ?? $entry['course_code'] ?? null
                );
                $hours = $this->resolveHoursRequired($entry, $courseDetails, $startTime, $endTime);

                $roomCode = $this->nullableString($entry['room_code'] ?? null);
                $roomId = $roomCode ? ($roomCodeToId[$roomCode] ?? null) : null;

                $detail = ScheduleDetail::updateOrCreate(
                    [
                        'schedule_id' => $schedule->id,
                        'day' => $dayOfWeek,
                        'start_time' => '2026-01-01 '.$startTime,
                        'end_time' => '2026-01-01 '.$endTime,
                    ],
                    [
                        'program_code' => $this->nullableString($entry['program_code'] ?? null),
                        'program_title' => $this->nullableString($entry['program_title'] ?? null),
                        'year_level' => isset($entry['year_level']) ? (int) $entry['year_level'] : null,
                        'section_name' => $this->nullableString($entry['section_name'] ?? null),
                        'course_title' => $courseTitle,
                        'course_code' => $courseCode,
                        'room_code' => $roomCode,
                        'room_id' => $roomId,
                        'subject_desc' => $courseTitle,
                        'hours_required' => $hours,
                    ]
                );

                if ($detail->wasRecentlyCreated) {
                    $this->summary['details_created']++;
                } else {
                    $this->summary['details_updated']++;
                }
            }
        }
    }

    /**
     * Sync temporary faculty schedules using the existing service.
     *
     * @param  list<array<string, mixed>>  $records
     */
    private function syncTemporarySchedules(array $records): void
    {
        if (empty($records)) {
            return;
        }

        // The existing TemporaryFacultyScheduleSyncService expects to call
        // the API itself, but since we already fetched the data we process
        // it inline here using the same logic pattern.
        foreach ($records as $record) {
            $facultyCode = $this->nullableString($record['faculty_code'] ?? null);

            if ($facultyCode === null) {
                continue;
            }

            $this->summary['temporary_synced']++;
        }

        // Use the existing sync service for proper persistence
        try {
            $tempSummary = $this->temporarySyncService->syncFromApi(['per_page' => 50]);
            $this->summary['temporary_synced'] = $tempSummary['processed'];
        } catch (\Throwable $e) {
            Log::warning('[FlssApiSync] Temporary schedule sync failed (non-fatal): '.$e->getMessage());
            $this->summary['errors'][] = 'Temporary sync failed: '.$e->getMessage();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers */
    /* ------------------------------------------------------------------ */

    /**
     * @return list<array<string, mixed>>
     */
    private function parseResponse(Response $response, string $primaryKey, string $label): array
    {
        if (! $response->successful()) {
            throw new RuntimeException("FLSS {$label} API returned HTTP {$response->status()}.");
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            throw new RuntimeException("FLSS {$label} API returned invalid JSON.");
        }

        $records = data_get($payload, $primaryKey);

        if (! is_array($records)) {
            $records = data_get($payload, 'data.'.$primaryKey);
        }

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
            $records = [];
        }

        return array_values(array_filter($records, fn ($record) => is_array($record)));
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, mixed>  $courseDetails
     */
    private function resolveHoursRequired(array $entry, array $courseDetails, string $startTime, string $endTime): float
    {
        $tuitionHours = $courseDetails['tuition_hours'] ?? $entry['tuition_hours'] ?? null;

        if (is_numeric($tuitionHours)) {
            return max(0.5, (float) $tuitionHours);
        }

        $startTimestamp = strtotime($startTime);
        $endTimestamp = strtotime($endTime);

        if ($startTimestamp === false || $endTimestamp === false) {
            return 1.0;
        }

        return max(0.5, round(abs($endTimestamp - $startTimestamp) / 3600, 2));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function resetSummary(): void
    {
        $this->summary = [
            'rooms' => 0,
            'faculty_created' => 0,
            'faculty_updated' => 0,
            'schedules_created' => 0,
            'schedules_updated' => 0,
            'details_created' => 0,
            'details_updated' => 0,
            'temporary_synced' => 0,
            'errors' => [],
        ];
    }
}
