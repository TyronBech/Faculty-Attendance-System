<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\UploadedFile;

class ScreenshotTimestampDetector
{
    /**
     * @return array{
     *     detected_at: Carbon|null,
     *     source: string,
     *     client_modified_at: Carbon|null,
     *     original_name: string
     * }
     */
    public function detect(
        UploadedFile $file,
        ?string $attendanceDate,
        ?string $manualTime,
        ?int $clientLastModifiedAt = null,
    ): array {
        $originalName = $file->getClientOriginalName();
        $clientModifiedAt = $this->resolveClientModifiedAt($clientLastModifiedAt);
        $metadataTimestamp = $this->extractMetadataTimestamp($file);
        $filenameTimestamp = $this->extractFilenameTimestamp($originalName, $attendanceDate);
        $manualTimestamp = $this->resolveManualTimestamp($attendanceDate, $manualTime);

        if ($metadataTimestamp) {
            return $this->buildDetectionResult($metadataTimestamp, 'metadata', $clientModifiedAt, $originalName);
        }

        if ($clientModifiedAt) {
            return $this->buildDetectionResult($clientModifiedAt, 'client_file_modified_at', $clientModifiedAt, $originalName);
        }

        if ($filenameTimestamp) {
            return $this->buildDetectionResult($filenameTimestamp, 'filename', $clientModifiedAt, $originalName);
        }

        if ($manualTimestamp) {
            return $this->buildDetectionResult($manualTimestamp, 'manual', $clientModifiedAt, $originalName);
        }

        return $this->buildDetectionResult(null, 'unavailable', $clientModifiedAt, $originalName);
    }

    private function buildDetectionResult(
        ?Carbon $detectedAt,
        string $source,
        ?Carbon $clientModifiedAt,
        string $originalName,
    ): array {
        return [
            'detected_at' => $detectedAt,
            'source' => $source,
            'client_modified_at' => $clientModifiedAt,
            'original_name' => $originalName,
        ];
    }

    private function resolveClientModifiedAt(?int $clientLastModifiedAt): ?Carbon
    {
        if (! $clientLastModifiedAt || $clientLastModifiedAt < 1) {
            return null;
        }

        return Carbon::createFromTimestampMs($clientLastModifiedAt, config('app.timezone'));
    }

    private function extractMetadataTimestamp(UploadedFile $file): ?Carbon
    {
        $realPath = $file->getRealPath();

        if (! $realPath || ! function_exists('exif_read_data')) {
            return null;
        }

        $metadata = @exif_read_data($realPath);

        if (! is_array($metadata)) {
            return null;
        }

        foreach (['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'] as $field) {
            $value = $metadata[$field] ?? null;

            if (! is_string($value) || trim($value) === '') {
                continue;
            }

            try {
                return Carbon::createFromFormat('Y:m:d H:i:s', $value, config('app.timezone'));
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }

    private function extractFilenameTimestamp(string $originalName, ?string $attendanceDate): ?Carbon
    {
        $filename = pathinfo($originalName, PATHINFO_FILENAME);

        $patterns = [
            '/(?P<date>\d{4}-\d{2}-\d{2})[\s_\-]*(?:at[\s_\-]*)?(?P<time>\d{2}[:.\-]\d{2}(?:[:.\-]\d{2})?)/i',
            '/(?P<date>\d{8})[\s_\-]+(?P<time>\d{6})/i',
            '/(?P<date>\d{4}\d{2}\d{2})[\s_\-]*(?P<time>\d{2}\d{2}\d{2})/i',
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $filename, $matches)) {
                continue;
            }

            $date = $this->normalizeDateSegment($matches['date'] ?? null);
            $time = $this->normalizeTimeSegment($matches['time'] ?? null);

            if (! $date || ! $time) {
                continue;
            }

            return Carbon::createFromFormat('Y-m-d H:i:s', "{$date} {$time}", config('app.timezone'));
        }

        if ($attendanceDate && preg_match('/(?P<time>\d{2}[:.\-]\d{2}(?:[:.\-]\d{2})?)/', $filename, $matches)) {
            $time = $this->normalizeTimeSegment($matches['time'] ?? null);

            if ($time) {
                return Carbon::createFromFormat('Y-m-d H:i:s', "{$attendanceDate} {$time}", config('app.timezone'));
            }
        }

        return null;
    }

    private function normalizeDateSegment(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        if (preg_match('/^\d{8}$/', $value)) {
            return substr($value, 0, 4).'-'.substr($value, 4, 2).'-'.substr($value, 6, 2);
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }

        return null;
    }

    private function normalizeTimeSegment(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        if (preg_match('/^\d{6}$/', $value)) {
            return substr($value, 0, 2).':'.substr($value, 2, 2).':'.substr($value, 4, 2);
        }

        $normalized = str_replace(['.', '-'], ':', $value);

        if (preg_match('/^\d{2}:\d{2}$/', $normalized)) {
            return "{$normalized}:00";
        }

        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $normalized)) {
            return $normalized;
        }

        return null;
    }

    private function resolveManualTimestamp(?string $attendanceDate, ?string $manualTime): ?Carbon
    {
        if (! $attendanceDate || ! $manualTime) {
            return null;
        }

        return Carbon::createFromFormat('Y-m-d H:i', "{$attendanceDate} {$manualTime}", config('app.timezone'));
    }
}
