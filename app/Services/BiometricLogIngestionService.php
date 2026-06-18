<?php

namespace App\Services;

use App\Jobs\SyncImportBatchJob;
use App\Models\Agent;
use App\Models\BiometricLog;
use App\Models\Faculty;
use App\Models\ImportBatch;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class BiometricLogIngestionService
{
    private const MAX_ERRORS = 50;

    private const IN_STATE_CODES = [0, 2, 4];

    private const OUT_STATE_CODES = [1, 3, 5];

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function ingest(Agent $agent, array $payload): array
    {
        $logs = $payload['logs'] ?? [];
        $deviceId = $this->resolvePayloadDeviceId($payload) ?? $agent->device_ip;
        $source = $this->resolvePayloadSource($payload);

        $batch = ImportBatch::create([
            'file_name' => $this->buildBatchName($source, $payload, $deviceId),
            'file_path' => $this->buildBatchPath($source, $deviceId),
            'status' => 'pending',
            'agent_id' => $agent->id,
            'started_at' => now(),
        ]);

        $summary = [
            'total' => is_array($logs) ? count($logs) : 0,
            'processed' => 0,
            'failed' => 0,
            'duplicates' => 0,
            'errors' => [],
        ];

        $normalizedRows = [];

        foreach ($logs as $index => $log) {
            $normalized = $this->normalizeLog($log, $deviceId);

            if ($normalized['error'] !== null) {
                $summary['failed']++;
                $summary['errors'][] = 'Log '.($index + 1).': '.$normalized['error'];

                continue;
            }

            $normalizedRows[] = [
                ...$normalized['data'],
                'source_index' => $index,
            ];
        }

        $facultyIds = Faculty::query()
            ->whereIn('biometric_id', array_values(array_unique(array_column($normalizedRows, 'biometric_id'))))
            ->pluck('biometric_id')
            ->mapWithKeys(static fn (string $biometricId): array => [$biometricId => true])
            ->all();

        $insertableRows = [];

        foreach ($normalizedRows as $row) {
            if (! isset($facultyIds[$row['biometric_id']])) {
                $summary['failed']++;
                $summary['errors'][] = 'Log '.($row['source_index'] + 1).': biometric ID does not match a faculty record.';

                continue;
            }

            unset($row['source_index']);
            $insertableRows[] = $row;
        }

        DB::transaction(function () use ($insertableRows, $batch, &$summary): void {
            $restoredFingerprints = $this->restoreSoftDeletedBiometricLogs($batch, $insertableRows);
            $timestamp = now();
            $rowsToInsert = [];

            foreach ($insertableRows as $row) {
                if (isset($restoredFingerprints[$this->logFingerprint($row)])) {
                    continue;
                }

                $rowsToInsert[] = [
                    ...$row,
                    'import_batch_id' => $batch->id,
                    'is_processed' => false,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            }

            $inserted = $rowsToInsert === []
                ? 0
                : BiometricLog::query()->insertOrIgnore($rowsToInsert);

            $restored = count($restoredFingerprints);
            $summary['processed'] = $inserted + $restored;
            $summary['duplicates'] = count($insertableRows) - $summary['processed'];
        });

        $status = $summary['processed'] > 0 ? 'pending' : ($summary['failed'] > 0 ? 'failed' : 'pending');

        $batch->update([
            'total_records' => $summary['total'],
            'processed_records' => $summary['processed'],
            'failed_records' => $summary['failed'],
            'duplicate_records' => $summary['duplicates'],
            'status' => $status,
            'completed_at' => $status === 'failed' ? now() : null,
            'error_log' => empty($summary['errors'])
                ? null
                : implode(PHP_EOL, array_slice($summary['errors'], 0, 100)),
        ]);

        $syncPayload = null;
        $autoSync = $payload['auto_sync'] ?? true;

        if ($autoSync && $summary['processed'] > 0) {
            SyncImportBatchJob::dispatch($batch->id);
            $syncPayload = ['status' => 'queued'];
        }

        $batch->refresh();

        return [
            'batch_id' => $batch->id,
            'status' => $batch->status,
            'received' => $summary['total'],
            'inserted' => $summary['processed'],
            'duplicates' => $summary['duplicates'],
            'failed' => $summary['failed'],
            'errors' => array_slice($summary['errors'], 0, self::MAX_ERRORS),
            'sync' => $syncPayload,
        ];
    }

    /**
     * @return array{data: array<string, mixed>, error: ?string}
     */
    private function normalizeLog(mixed $log, ?string $defaultDeviceId): array
    {
        $normalizedLog = $this->normalizeInputLog($log);

        if ($normalizedLog === null) {
            return [
                'data' => [],
                'error' => 'Invalid log entry format. Expected an object or array.',
            ];
        }

        $biometricId = $this->stringValue($this->valueFromKeys($normalizedLog, [
            'biometric_id',
            'biometricId',
            'user_id',
            'userId',
            'userid',
            'id',
            'pin',
        ]));

        if ($biometricId === '') {
            return [
                'data' => [],
                'error' => 'Missing biometric_id/user_id.',
            ];
        }

        $rawTimestamp = $this->valueFromKeys($normalizedLog, [
            'log_datetime',
            'logDateTime',
            'timestamp',
            'time',
            'datetime',
            'date',
        ]);

        $logDateTime = $this->parseDateTime($rawTimestamp);
        if (! $logDateTime) {
            return [
                'data' => [],
                'error' => 'Invalid or missing log datetime.',
            ];
        }

        $logType = $this->resolveLogType($normalizedLog);
        if (! $logType) {
            return [
                'data' => [],
                'error' => 'Missing or unrecognized log type/state.',
            ];
        }

        $deviceId = $this->stringValue($this->valueFromKeys($normalizedLog, [
            'device_id',
            'deviceId',
            'device_sn',
            'deviceSerial',
            'device_serial',
            'serial_number',
            'terminal_id',
        ]));

        $deviceId = $deviceId !== '' ? $deviceId : $defaultDeviceId;

        return [
            'data' => [
                'biometric_id' => $biometricId,
                'log_datetime' => $logDateTime,
                'log_type' => $logType,
                'device_id' => $deviceId,
            ],
            'error' => null,
        ];
    }

    private function normalizeInputLog(mixed $log): ?array
    {
        if (is_object($log)) {
            $log = get_object_vars($log);
        }

        if (! is_array($log)) {
            return null;
        }

        if (array_is_list($log)) {
            return [
                'uid' => $log[0] ?? null,
                'id' => $log[1] ?? null,
                'state' => $log[2] ?? null,
                'timestamp' => $log[3] ?? null,
                'type' => $log[4] ?? null,
            ];
        }

        return $log;
    }

    private function resolveLogType(array $log): ?string
    {
        $directType = $this->valueFromKeys($log, ['log_type', 'logType', 'type']);
        $normalized = $this->normalizeLogType($directType);

        if (in_array($normalized, ['IN', 'OUT'], true)) {
            return $normalized;
        }

        $state = $this->valueFromKeys($log, ['state', 'status', 'punch']);

        if ($state === null || $state === '') {
            return null;
        }

        if (! is_numeric($state)) {
            $normalized = $this->normalizeLogType($state);

            return in_array($normalized, ['IN', 'OUT'], true) ? $normalized : null;
        }

        $state = (int) $state;

        if (in_array($state, self::IN_STATE_CODES, true)) {
            return 'IN';
        }

        if (in_array($state, self::OUT_STATE_CODES, true)) {
            return 'OUT';
        }

        return null;
    }

    private function normalizeLogType(mixed $value): string
    {
        $normalized = strtolower(trim((string) $value));

        if ($normalized === '') {
            return '';
        }

        if (str_contains($normalized, 'out')) {
            return 'OUT';
        }

        if (str_contains($normalized, 'in')) {
            return 'IN';
        }

        return strtoupper($normalized);
    }

    private function stringValue(mixed $value): string
    {
        return trim((string) $value);
    }

    private function valueFromKeys(array $data, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data)) {
                return $data[$key];
            }
        }

        return null;
    }

    private function resolvePayloadDeviceId(array $payload): ?string
    {
        $deviceId = $this->stringValue($payload['device_id'] ?? '');

        return $deviceId !== '' ? $deviceId : null;
    }

    private function resolvePayloadSource(array $payload): string
    {
        $source = $this->stringValue($payload['source'] ?? 'zkteco-agent');
        $source = Str::slug($source, '-');

        return $source !== '' ? $source : 'zkteco-agent';
    }

    private function buildBatchName(string $source, array $payload, ?string $deviceId): string
    {
        $parts = [$source];

        if (! empty($payload['branch_id'])) {
            $parts[] = 'branch-'.$payload['branch_id'];
        }

        if ($deviceId) {
            $parts[] = Str::slug($deviceId, '-');
        }

        $parts[] = now()->format('Ymd_His');

        return implode('-', array_filter($parts)).'.json';
    }

    private function buildBatchPath(string $source, ?string $deviceId): string
    {
        $stamp = now()->format('Ymd_His');
        $deviceSegment = $deviceId ? Str::slug($deviceId, '-') : 'device';

        return "imports/biometric-logs/api/{$source}/{$deviceSegment}-{$stamp}.json";
    }

    /**
     * @param  array<int, array{biometric_id: string, log_datetime: string, log_type: string, device_id: ?string}>  $rows
     * @return array<string, true>
     */
    private function restoreSoftDeletedBiometricLogs(ImportBatch $batch, array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $softDeletedLogs = BiometricLog::onlyTrashed()
            ->whereIn('biometric_id', array_values(array_unique(array_column($rows, 'biometric_id'))))
            ->whereIn('log_datetime', array_values(array_unique(array_column($rows, 'log_datetime'))))
            ->whereIn('log_type', array_values(array_unique(array_column($rows, 'log_type'))))
            ->get()
            ->keyBy(fn (BiometricLog $log): string => $this->logFingerprint([
                'biometric_id' => $log->biometric_id,
                'log_datetime' => $log->log_datetime->format('Y-m-d H:i:s'),
                'log_type' => $log->log_type,
            ]));

        $restoredFingerprints = [];

        foreach ($rows as $row) {
            $fingerprint = $this->logFingerprint($row);
            $softDeletedLog = $softDeletedLogs->get($fingerprint);

            if (! $softDeletedLog || isset($restoredFingerprints[$fingerprint])) {
                continue;
            }

            $softDeletedLog->restore();
            $softDeletedLog->update([
                'device_id' => $row['device_id'],
                'import_batch_id' => $batch->id,
                'is_processed' => false,
            ]);
            $restoredFingerprints[$fingerprint] = true;
        }

        return $restoredFingerprints;
    }

    private function parseDateTime(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value)->format('Y-m-d H:i:s');
        }

        if (is_numeric($value)) {
            try {
                $parsed = ExcelDate::excelToDateTimeObject((float) $value);

                if ((int) $parsed->format('u') >= 500000) {
                    $parsed = $parsed->modify('+1 second');
                }

                return $parsed->format('Y-m-d H:i:s');
            } catch (\Throwable $e) {
                return null;
            }
        }

        $stringValue = preg_replace('/\s+/', ' ', trim((string) $value));
        if ($stringValue === '') {
            return null;
        }

        $candidateValues = array_values(array_unique(array_filter([
            $stringValue,
            $this->normalizeDateTimeString($stringValue),
        ])));

        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d H:i',
            'Y-m-d\TH:i:s',
            'Y-m-d\TH:i',
            'n/j/Y G:i:s',
            'n/j/Y G:i',
            'n/j/Y g:i:s A',
            'n/j/Y g:i A',
            'n/j/y G:i:s',
            'n/j/y G:i',
            'n/j/y g:i:s A',
            'n/j/y g:i A',
        ];

        foreach ($candidateValues as $candidateValue) {
            foreach ($formats as $format) {
                try {
                    $parsed = Carbon::createFromFormat($format, $candidateValue);

                    if ($parsed !== false) {
                        return $parsed->format('Y-m-d H:i:s');
                    }
                } catch (\Throwable $e) {
                }
            }

            try {
                return Carbon::parse($candidateValue)->format('Y-m-d H:i:s');
            } catch (\Throwable $e) {
            }
        }

        return null;
    }

    private function normalizeDateTimeString(string $value): string
    {
        $normalized = preg_replace('/\s+/', ' ', trim($value));
        $normalized = preg_replace('/(?<=\d)(am|pm)\b/i', ' $1', $normalized);
        $normalized = preg_replace_callback('/\b(am|pm)\b/i', static fn (array $matches): string => strtoupper($matches[1]), $normalized);

        if (
            preg_match('/\b(\d{1,2}):\d{2}(?::\d{2})?\s*(AM|PM)\b/', $normalized, $matches) === 1
            && (int) $matches[1] > 12
        ) {
            $normalized = trim((string) preg_replace('/\s*(AM|PM)\b/', '', $normalized, 1));
        }

        return $normalized;
    }

    /**
     * @param  array{biometric_id: string, log_datetime: string, log_type: string}  $row
     */
    private function logFingerprint(array $row): string
    {
        return implode('|', [
            $row['biometric_id'],
            $row['log_datetime'],
            $row['log_type'],
        ]);
    }
}
