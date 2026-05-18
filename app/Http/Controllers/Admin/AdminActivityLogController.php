<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class AdminActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(10, min($perPage, 50));

        $search = trim((string) $request->query('search', ''));

        $activityLogs = Activity::query()
            ->with(['causer'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('description', 'like', "%{$search}%")
                        ->orWhere('log_name', 'like', "%{$search}%")
                        ->orWhere('subject_type', 'like', "%{$search}%")
                        ->orWhere('causer_type', 'like', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate($perPage)
            ->through(function (Activity $activity): array {
                $properties = $activity->properties;
                $causerName = null;
                if ($activity->causer) {
                    $causerName = $activity->causer->username
                        ?? $activity->causer->email
                        ?? ('ID '.$activity->causer->getKey());
                }

                return [
                    'id' => $activity->id,
                    'log_name' => $activity->log_name,
                    'description' => $activity->description,
                    'event' => $activity->event,
                    'action_label' => data_get($properties, 'action_label'),
                    'method' => data_get($properties, 'method'),
                    'route_name' => data_get($properties, 'route_name'),
                    'path' => data_get($properties, 'path'),
                    'subject_type' => $activity->subject_type,
                    'subject_id' => $activity->subject_id,
                    'causer_type' => $activity->causer_type,
                    'causer_id' => $activity->causer_id,
                    'causer_name' => $causerName,
                    'properties' => $properties,
                    'created_at' => optional($activity->created_at)->toDateTimeString(),
                ];
            })
            ->withQueryString();

        return Inertia::render('Admin/ActivityLogs', [
            'activityLogs' => $activityLogs,
            'filters' => [
                'search' => $search,
                'per_page' => $perPage,
            ],
        ]);
    }
}
