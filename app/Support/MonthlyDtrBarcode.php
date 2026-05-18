<?php

namespace App\Support;

use App\Models\Faculty;
use Carbon\CarbonInterface;
use Milon\Barcode\DNS1D;

final class MonthlyDtrBarcode
{
    /**
     * @return array{img: string, value: string}
     */
    public static function build(Faculty $faculty, CarbonInterface $printedAt): array
    {
        $facultyKey = self::facultyKey($faculty);
        $date = $printedAt->format('Y-m-d');
        $value = $facultyKey.'|'.$date;

        $png = (new DNS1D)->getBarcodePNG($value, 'C128', 1.2, 40);

        if (! is_string($png) || $png === '') {
            return ['img' => '', 'value' => $value];
        }

        return [
            'img' => 'data:image/png;base64,'.$png,
            'value' => $value,
        ];
    }

    public static function facultyKey(Faculty $faculty): string
    {
        return (string) ($faculty->faculty_code ?: ($faculty->biometric_id ?: ('ID-'.$faculty->id)));
    }
}
