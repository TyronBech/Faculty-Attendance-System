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
            $records = $this->fetchFacultySchedulesFromApi();

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

                $schedule = Schedule::firstOrCreate(
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
                    $startTime = (string) ($entry['start_time'] ?? '08:00:00');
                    $endTime = (string) ($entry['end_time'] ?? '11:00:00');
                    $timeInTs = '2026-01-01 ' . $startTime;
                    $timeOutTs = '2026-01-01 ' . $endTime;
                    $dayOfWeek = (string) ($entry['day'] ?? 'Monday');

                    $hours = 1;
                    try {
                        $hours = max(1, (int) round(abs(strtotime($endTime) - strtotime($startTime)) / 3600));
                    } catch (\Throwable $e) {
                        $hours = 1;
                    }

                    $roomCode = $entry['room_code'] ?? null;
                    $roomId = $roomCode ? ($roomCodeToId[$roomCode] ?? null) : null;

                    $detail = ScheduleDetail::firstOrCreate(
                        [
                            'schedule_id' => $schedule->id,
                            'day'        => $dayOfWeek,
                            'start_time' => $timeInTs,
                            'end_time'   => $timeOutTs,
                        ],
                        [
                            'program_code'   => $entry['program_code'] ?? null,
                            'program_title'  => $entry['program_title'] ?? null,
                            'year_level'     => isset($entry['year_level']) ? (int) $entry['year_level'] : null,
                            'section_name'   => isset($entry['section_name']) ? (string) $entry['section_name'] : null,
                            'course_title'   => $entry['course_title'] ?? null,
                            'course_code'    => $entry['course_code'] ?? null,
                            'room_code'      => $roomCode,
                            'room_id'        => $roomId,
                            'subject_desc'   => $entry['course_title'] ?? null,
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

        if (! $response->successful()) {
            throw new \RuntimeException('External schedules API request failed while seeding schedules. HTTP ' . $response->status());
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException('External schedules API returned an invalid JSON payload while seeding schedules.');
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
