<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\AdminDtrExportController;
use App\Models\Faculty;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MonthlyDtrPdfTemplateTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_dtr_blade_renders_expected_structure(): void
    {
        $faculty = Faculty::factory()->create([
            'last_name' => 'Dela Cruz',
            'first_name' => 'Juan',
            'middle_name' => 'Santos',
            'faculty_code' => 'FC-001',
        ]);

        $faculty->load('department:id,name');

        $controller = new AdminDtrExportController;
        $rows = $controller->buildRows([], 3, 2026);

        $html = view('pdf.monthly-dtr', [
            'faculty' => $faculty,
            'rows' => $rows,
            'summary' => [
                'daysAbsent' => 1,
                'timesLate' => 2,
                'totalLateMinutes' => 15,
                'timesUndertime' => 1,
                'totalUndertimeMinutes' => 30,
                'timesNight' => 0,
                'totalNightMinutes' => 0,
                'timesOvertime' => 0,
                'totalOvertimeMinutes' => 0,
                'timesOvertimeNight' => 0,
                'totalOvertimeNightMinutes' => 0,
                'totalHoursRendered' => 0,
            ],
            'manualEntries' => [],
            'periodLabel' => 'March 2026',
            'generatedAt' => 'Monday, April 1, 2026',
        ])->render();

        $this->assertStringContainsString('TIME LOGS', $html);
        $this->assertStringContainsString('SUMMARY', $html);
        $this->assertStringContainsString('MANUAL ENTRY', $html);
        $this->assertStringContainsString('DELA CRUZ', $html);
        $this->assertStringContainsString('JUAN', $html);
        $this->assertStringContainsString('FC-001', $html);
        $this->assertStringContainsString('Human Resources Management Department', $html);
        $this->assertStringContainsString('VERIFIED as to the prescribed office hours', $html);
        $this->assertStringContainsString('Civil Service Form No. 48', $html);
        $this->assertStringContainsString('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES', $html);
        $this->assertStringContainsString('data:image/jpeg;base64,', $html);
        $this->assertStringContainsString('210mm', $html);
        $this->assertStringContainsString('Date Printed:', $html);
        $this->assertStringContainsString('Monday, April 1, 2026', $html);
    }
}
