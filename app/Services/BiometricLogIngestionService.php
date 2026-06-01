<?php

namespace App\Services;

use App\Jobs\SyncImportBatchJob;
use App\Models\Agent;
use App\Models\BiometricLog;
use App\Models\ImportBatch;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
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

        DB::transaction(function () use ($logs, $deviceId, $batch, &$summary): void {
            foreach ($logs as $index => $log) {
                $normalized = $this->normalizeLog($log, $deviceId);

                if ($normalized['error'] !== null) {
                    $summary['failed']++;
                    $summary['errors'][] = 'Log '.($index + 1).': '.$normalized['error'];

                    continue;
                }

                try {
                    BiometricLog::create([
                        'biometric_id' => $normalized['data']['biometric_id'],
                        'log_datetime' => $normalized['data']['log_datetime'],
                        'log_type' => $normalized['data']['log_type'],
                        'device_id' => $normalized['data']['device_id'],
                        'import_batch_id' => $batch->id,
                        'is_processed' => false,
                    ]);

                    $summary['processed']++;
                } catch (QueryException $e) {
                    if ($this->isDuplicateKeyException($e)) {
                        $restored = $this->restoreSoftDeletedBiometricLog(
                            $batch,
                            $normalized['data']['biometric_id'],
                            $normalized['data']['log_datetime'],
                            $normalized['data']['log_type'],
                            $normalized['data']['device_id']
                        );

                        if ($restored) {
                            $summary['processed']++;
                        } else {
                            $summary['duplicates']++;
                        }

                        continue;
                    }

                    $summary['failed']++;
                    $summary['errors'][] = 'Log '.($index + 1).': failed to insert record.';
                }
            }
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

    private function restoreSoftDeletedBiometricLog(
        ImportBatch $batch,
        string $biometricId,
        string $parsedDateTime,
        string $logType,
        ?string $deviceId,
    ): bool {
        $softDeletedLog = BiometricLog::withTrashed()
            ->where('biometric_id', $biometricId)
            ->where('log_datetime', $parsedDateTime)
            ->where('log_type', $logType)
            ->whereNotNull('deleted_at')
            ->first();

        if (! $softDeletedLog) {
            return false;
        }

        $softDeletedLog->restore();

        $softDeletedLog->update([
            'device_id' => $deviceId,
            'import_batch_id' => $batch->id,
            'is_processed' => false,
        ]);

        return true;
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

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $errorInfo = $exception->errorInfo ?? null;

        if (is_array($errorInfo) && count($errorInfo) >= 2) {
            $sqlState = (string) $errorInfo[0];
            $driverCode = (string) $errorInfo[1];

            if ($sqlState === '23000' && $driverCode === '1062') {
                return true;
            }

            if ($sqlState === '23505') {
                return true;
            }
        }

        $message = strtolower((string) $exception->getMessage());

        return str_contains($message, 'duplicate entry')
            || str_contains($message, 'unique constraint')
            || str_contains($message, 'unique violation');
    }
}
