<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Services\FlssBackendClient;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use RuntimeException;

class AdminDashboardController extends Controller
{
    /**
     * Display the admin dashboard.
     */
    public function index(Request $request)
    {
        if ($request->user('admin')?->hasAnyRole(['hr_admin', 'hr_staff'])
            && ! $request->user('admin')?->hasAnyRole(['super_admin', 'admin'])) {
            return redirect()->route('admin.hr.dashboard');
        }

        $now = Carbon::now();

        return Inertia::render('Admin/Dashboard', [
            'stats'             => Faculty::getAdminDashboardStats(),
            'timedInFaculties'  => Faculty::getCurrentlyTimedIn(),
            'timedOutFaculties' => Faculty::getCurrentlyTimedOut(),
            'weeklyGraph'       => Faculty::getWeeklyTimedInGraph(),
            'currentDate'       => $now->format('l, F j, Y'),
            'greeting'          => $this->getGreeting(),
        ]);
    }

    /**
     * AJAX endpoint for real-time dashboard data updates.
     */
    public function liveStats(Request $request)
    {
        return response()->json([
            'stats'             => Faculty::getAdminDashboardStats(),
            'timedInFaculties'  => Faculty::getCurrentlyTimedIn(),
            'timedOutFaculties' => Faculty::getCurrentlyTimedOut(),
            'weeklyGraph'       => Faculty::getWeeklyTimedInGraph(),
        ]);
    }

    /**
     * Proxy external faculty schedules API using HMAC headers.
     */
    public function externalSchedules(Request $request, FlssBackendClient $client): JsonResponse
    {
        try {
            $query = array_filter($request->query(), fn($value) => $value !== null && $value !== '');
            $response = $client->getFacultySchedules($query);

            if ($response->successful()) {
                return response()->json($response->json(), $response->status());
            }

            return response()->json([
                'message' => 'External schedules request failed.',
                'status' => $response->status(),
                'external' => $response->json() ?? ['body' => $response->body()],
            ], 502);
        } catch (ConnectionException $e) {
            return response()->json([
                'message' => 'Unable to reach external schedules API.',
                'error' => $e->getMessage(),
            ], 503);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Return a time-aware greeting string.
     */
    private function getGreeting(): string
    {
        $hour = Carbon::now()->hour;

        if ($hour < 12) {
            return 'Good Morning';
        } elseif ($hour < 17) {
            return 'Good Afternoon';
        }

        return 'Good Evening';
    }
}
