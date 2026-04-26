<?php

namespace Database\Seeders;

use App\Models\Faculty;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleDetail;
use App\Models\User;
use App\Services\FlssBackendClient;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ScheduleSeeder extends Seeder
{
    /**
     * Seeds official schedules from the external API only.
     */
    public function run(): void
    {
        DB::beginTransaction();
        try {
            $officialRecords = $this->fetchFacultySchedulesFromApi();
            $temporaryRecords = $this->fetchTemporaryFacultySchedulesFromApi();

            $records = array_merge($officialRecords, $temporaryRecords);

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

                $scheduleCode = 'SCH-API-' . $externalFacultyId . '-2026';

                $schedule = Schedule::updateOrCreate(
                    ['schedule_code' => $scheduleCode],
                    [
                        'faculty_id'          => $faculty->id,
                        'external_faculty_id' => $externalFacultyId,
                        'schedule_code'       => $scheduleCode,
                        'academic_year'       => 2026,
                        'semester'            => 2,
                        'effective_from'      => '2026-01-01 00:00:00',
                        'effective_until'     => '2026-12-31 23:59:59',
                        'status'              => 'active',
                        'schedule_type'       => 'fixed',
                        'created_by'          => $adminUser?->id,
                        'notes'               => 'Imported from external faculty schedules API for ' . ($item['faculty_email'] ?? $facultyCode),
                    ]
                );

                foreach (($item['schedules'] ?? []) as $entry) {
                    if (! is_array($entry)) {
                        continue;
                    }

                    $startTime = (string) ($entry['start_time'] ?? '08:00:00');
                    $endTime = (string) ($entry['end_time'] ?? '11:00:00');
                    $timeInTs = '2026-01-01 ' . $startTime;
                    $timeOutTs = '2026-01-01 ' . $endTime;
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

                    ScheduleDetail::updateOrCreate(
                        [
                            'schedule_id' => $schedule->id,
                            'day'        => $dayOfWeek,
                            'start_time' => $timeInTs,
                            'end_time'   => $timeOutTs,
                        ],
                        [
                            'program_code'   => $this->nullableString($entry['program_code'] ?? null),
                            'program_title'  => $this->nullableString($entry['program_title'] ?? null),
                            'year_level'     => isset($entry['year_level']) ? (int) $entry['year_level'] : null,
                            'section_name'   => $this->nullableString($entry['section_name'] ?? null),
                            'course_title'   => $courseTitle,
                            'course_code'    => $courseCode,
                            'room_code'      => $roomCode,
                            'room_id'        => $roomId,
                            'subject_desc'   => $courseTitle,
                            'hours_required' => $hours,
                        ]
                    );
                }
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
    private function parseApiResponse(\Illuminate\Http\Client\Response $response, string $type): array
    {
        if (! $response->successful()) {
            throw new \RuntimeException("External {$type} schedules API request failed while seeding schedules. HTTP " . $response->status());
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException("External {$type} schedules API returned an invalid JSON payload while seeding schedules.");
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

        $durationHours = abs($endTimestamp - $startTimestamp) / 3600;

        return max(0.5, round($durationHours, 2));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }
}
