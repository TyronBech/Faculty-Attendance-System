<?php

namespace Tests\Unit;

use App\Models\Faculty;
use App\Support\MonthlyDtrBarcode;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MonthlyDtrBarcodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_encodes_faculty_key_and_print_date(): void
    {
        if (! function_exists('imagecreate') && ! extension_loaded('imagick')) {
            $this->markTestSkipped('GD or Imagick required for barcode generation');
        }

        $faculty = Faculty::factory()->create([
            'faculty_code' => 'FC-042',
        ]);

        $printedAt = Carbon::parse('2026-04-01 08:00:00');
        $result = MonthlyDtrBarcode::build($faculty, $printedAt);

        $this->assertSame('FC-042|2026-04-01', $result['value']);
        $this->assertNotSame('', $result['img']);
        $this->assertStringStartsWith('data:image/png;base64,', $result['img']);
    }
}
