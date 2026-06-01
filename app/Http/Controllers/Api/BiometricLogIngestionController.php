<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreBiometricLogsRequest;
use App\Models\Agent;
use App\Services\BiometricLogIngestionService;
use Illuminate\Http\JsonResponse;

class BiometricLogIngestionController extends Controller
{
    public function __construct(
        private BiometricLogIngestionService $ingestionService,
    ) {}

    /**
     * Ingest biometric logs pushed from a ZKTeco device agent.
     */
    public function store(StoreBiometricLogsRequest $request): JsonResponse
    {
        /** @var Agent $agent */
        $agent = $request->user();

        $result = $this->ingestionService->ingest($agent, $request->validated());

        $agent->update(['last_synced_at' => now()]);

        return response()->json([
            'message' => 'Biometric logs received.',
            'data' => $result,
        ], 200);
    }
}
