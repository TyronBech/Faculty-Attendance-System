<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class FlssBackendClient
{
    /**
     * Send a signed request to FLSS backend using HMAC SHA-256.
     */
    public function request(string $method, string $url, array $query = [], ?array $payload = null): Response
    {
        $apiKey = (string) config('services.flss_backend.key');

        if ($apiKey === '') {
            throw new RuntimeException('FLSS backend API key is not configured.');
        }

        $method = strtoupper($method);
        $timestamp = (string) now()->timestamp;
        $nonce = '';
        $body = $payload ? json_encode($payload, JSON_UNESCAPED_SLASHES) : '';

        if ($body === false) {
            throw new RuntimeException('Unable to encode request payload for FLSS backend.');
        }

        $signedUrl = $this->buildSignedUrl($url, $query);
        $message = $method . '|' . $signedUrl . '|' . $body . '|' . $timestamp . '|' . $nonce;
        $signature = hash_hmac('sha256', $message, $apiKey);

        $request = Http::withHeaders([
            'X-HMAC-Signature' => $signature,
            'X-HMAC-Timestamp' => $timestamp,
            'X-HMAC-Nonce' => $nonce,
        ])->acceptJson();

        $request = $request->withOptions([
            'verify' => $this->resolveSslVerificationOption(),
        ]);

        if ($body !== '') {
            $request = $request->withBody($body, 'application/json');
        }

        $response = $request->send($method, $signedUrl);

        if ($response instanceof Response) {
            return $response;
        }

        /** @var Response $resolved */
        $resolved = $response->wait();
        return $resolved;
    }

    /**
     * Call the configured faculty schedules endpoint.
     */
    public function getFacultySchedules(array $query = []): Response
    {
        $url = (string) config('services.flss_backend.faculty_schedules_url');

        if ($url === '') {
            throw new RuntimeException('FLSS faculty schedules URL is not configured.');
        }

        return $this->request('GET', $url, $query);
    }

    /**
     * Call the configured rooms endpoint.
     */
    public function getRooms(array $query = []): Response
    {
        $url = (string) config('services.flss_backend.rooms_url');

        if ($url === '') {
            throw new RuntimeException('FLSS rooms URL is not configured.');
        }

        return $this->request('GET', $url, $query);
    }

    /**
     * Call the configured temporary faculty schedules endpoint.
     */
    public function getTemporaryFacultySchedules(array $query = []): Response
    {
        $url = (string) config('services.flss_backend.temporary_schedules_url');

        if ($url === '') {
            throw new RuntimeException('FLSS temporary faculty schedules URL is not configured.');
        }

        return $this->request('GET', $url, $query);
    }

    private function buildSignedUrl(string $url, array $query = []): string
    {
        if (empty($query)) {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';
        return $url . $separator . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    private function resolveSslVerificationOption(): bool|string
    {
        if (config('services.flss_backend.skip_ssl_verification', false)) {
            return false;
        }

        $configuredBundle = trim((string) config('services.flss_backend.ca_bundle', ''));
        if ($configuredBundle === '') {
            return true;
        }

        $bundlePath = $this->resolvePath($configuredBundle);
        if (! is_file($bundlePath)) {
            throw new RuntimeException("Configured FLSS CA bundle was not found at [{$bundlePath}].");
        }

        return $bundlePath;
    }

    private function resolvePath(string $path): string
    {
        if (preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1 || str_starts_with($path, DIRECTORY_SEPARATOR)) {
            return $path;
        }

        return base_path($path);
    }
}
