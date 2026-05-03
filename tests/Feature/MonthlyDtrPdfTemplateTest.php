<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Support\MonthlyDtrBarcode;
use Carbon\Carbon;
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

        $rows = [
            [
                'day' => 1,
                'official_morning_in' => '8:00AM',
                'official_morning_out' => '10:00AM',
                'official_morning_absent' => false,
                'official_afternoon_in' => '',
                'official_afternoon_out' => '',
                'official_afternoon_absent' => false,
                'official_night_in' => '',
                'official_night_out' => '',
                'official_night_absent' => false,
                'tardy_minutes' => 0,
                'undertime_minutes' => 0,
                'total_hours_rendered' => 2,
                'required_hours' => 2,
                'status' => 'present',
                'has_absent_slot' => false,
                'is_holiday' => false,
                'is_manual' => false,
            ],
            [
                'day' => 2,
                'official_morning_in' => '10:30AM',
                'official_morning_out' => '1:30PM',
                'official_morning_absent' => true,
                'official_afternoon_in' => '',
                'official_afternoon_out' => '',
                'official_afternoon_absent' => false,
                'official_night_in' => '',
                'official_night_out' => '',
                'official_night_absent' => false,
                'tardy_minutes' => 0,
                'undertime_minutes' => 0,
                'total_hours_rendered' => 0,
                'required_hours' => 3,
                'status' => 'absent',
                'has_absent_slot' => true,
                'is_holiday' => false,
                'is_manual' => false,
            ],
        ];

        $printedAt = Carbon::parse('2026-04-01 10:00:00');
        $barcode = MonthlyDtrBarcode::build($faculty, $printedAt);

        $html = view('pdf.monthly-dtr', [
            'faculty' => $faculty,
            'rows' => $rows,
            'summary' => [],
            'manualEntries' => [],
            'periodLabel' => 'March 2026',
            'generatedAt' => $printedAt->format('l, F d, Y'),
            'barcodeImg' => $barcode['img'],
            'barcodeValue' => $barcode['value'],
        ])->render();

        $this->assertStringContainsString('TIME LOGS', $html);
        $this->assertStringContainsString('Total Hours', $html);
        $this->assertStringContainsString('Required', $html);
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
        $this->assertStringContainsString($printedAt->format('l, F d, Y'), $html);
        $this->assertStringContainsString('<td class="val-col">2.00</td>', $html);
        $this->assertStringContainsString('<td class="val-col">5.00</td>', $html);
        $this->assertStringContainsString('<td class="val-col">1</td>', $html);
        $this->assertStringContainsString('<td class="val-col">3.00</td>', $html);
        if ($barcode['img'] !== '') {
            $this->assertStringContainsString('data:image/png;base64,', $html);
            $this->assertStringContainsString('FC-001|2026-04-01', $html);
        }
    }
}
