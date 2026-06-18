<?php

use App\Http\Controllers\Api\BiometricLogIngestionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function () {
    Route::post('/biometric-logs', [BiometricLogIngestionController::class, 'store'])
        ->name('api.biometric-logs.store');
});
