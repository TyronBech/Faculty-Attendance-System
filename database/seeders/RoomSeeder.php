<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Services\FlssBackendClient;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $records = $this->fetchRoomsFromApi();

        foreach ($records as $item) {
            $roomId = (int) ($item['room_id'] ?? 0);
            $roomCode = (string) ($item['room_code'] ?? '');
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
        }
    }

    private function fetchRoomsFromApi(): array
    {
        $client = app(FlssBackendClient::class);
        $response = $client->getRooms(['per_page' => 500]);

        if (! $response->successful()) {
            throw new \RuntimeException('External rooms API request failed. HTTP ' . $response->status());
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException('External rooms API returned invalid JSON payload.');
        }

        $records = data_get($payload, 'rooms');
        if (! is_array($records)) {
            $records = data_get($payload, 'data.rooms');
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
