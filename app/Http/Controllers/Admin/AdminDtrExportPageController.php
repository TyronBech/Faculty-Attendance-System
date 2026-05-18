<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\TemporaryFacultySchedule;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class AdminDtrExportPageController extends Controller
{
    public function index()
    {
        $activeFaculty = Faculty::getActiveFacultyList();
        $temporaryFacultyIds = Schema::hasTable('temporary_faculty_schedules')
            ? TemporaryFacultySchedule::query()
                ->whereNotNull('faculty_id')
                ->distinct()
                ->pluck('faculty_id')
                ->map(fn ($id): int => (int) $id)
                ->all()
            : [];
        $now = Carbon::now();

        return Inertia::render('Admin/DtrExport', [
            'facultyOptions' => collect($activeFaculty)
                ->map(fn (array $faculty): array => $faculty + [
                    'has_temporary_substitution' => in_array((int) $faculty['id'], $temporaryFacultyIds, true),
                ])
                ->values()
                ->all(),
            'dtrExportDefaults' => [
                'faculty_id' => $activeFaculty[0]['id'] ?? null,
                'month' => $now->month,
                'year' => $now->year,
            ],
            'dtrExportYears' => array_values(array_reverse(range($now->year - 5, $now->year + 1))),
        ]);
    }
}
