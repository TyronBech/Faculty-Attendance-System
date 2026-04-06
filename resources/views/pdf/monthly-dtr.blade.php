<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Daily Time Record</title>
    <style>
        @page {
            size: 105mm 297mm;
            margin: 0;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
            width: auto;
            height: auto;
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page {
            width: 105mm;
            min-height: 297mm;
            padding: 4mm 3mm;
        }

        .content-wrap {
            width: 95mm;
            margin: 0 auto;
            padding: 0 4mm 0 1mm;
        }

        table {
            border-collapse: collapse;
            border-spacing: 0;
        }

        .header-table {
            width: 100%;
            table-layout: fixed;
            margin-bottom: 2px;
        }

        .header-left {
            width: 24mm;
            vertical-align: top;
            padding-top: 2px;
        }

        .header-middle {
            vertical-align: top;
            padding-top: 3px;
        }

        .header-right {
            width: 32mm;
            text-align: right;
            vertical-align: top;
            padding-top: 3px;
            white-space: nowrap;
        }

        .dtr-table {
            width: 100%;
            border: 1px solid #000;
            table-layout: fixed;
            margin: 0 auto;
        }

        .dtr-table th,
        .dtr-table td {
            border: 1px solid #000;
            text-align: center;
            font-size: 8px;
            padding: 1px 2px;
            height: 15px;
        }

        .day-col {
            width: 9mm;
        }

        .time-col {
            width: 15mm;
        }
    </style>
</head>
<body>
@php
    $code       = $faculty->faculty_code ?: ($faculty->biometric_id ?: $faculty->id);
    $totalDays  = count($rows);
    $monthYear  = \Carbon\Carbon::create($rows[0]['day'] ? now()->year : now()->year, now()->month, 1);
@endphp
<div class="page">
<div class="content-wrap">

    {{-- ── HEADER ──────────────────────────────────────────────── --}}
    <table class="header-table">
        <tr>
            <td class="header-left">
                <img src="{{ public_path('images/PUP Taguig Logo.jpg') }}"
                     style="width:20mm; height:20mm; display:block;" alt="PUP">
            </td>
            <td class="header-middle">
                <div style="font-size:9px; font-weight:700;">PUP TAGUIG</div>
            </td>
            <td class="header-right">
                <div style="font-size:7.5px; font-style:italic;">Civil Service Form No. 48</div>
            </td>
        </tr>
    </table>

    {{-- ── TITLE ───────────────────────────────────────────────── --}}
    <div style="text-align:center; font-size:12px; font-weight:700; margin:4px 0 1px;">
        DAILY TIME RECORD
    </div>
    <div style="text-align:center; font-size:8px; margin-bottom:3px;">---o0o---</div>

    {{-- ── NAME ────────────────────────────────────────────────── --}}
    <div style="text-align:center; font-size:10px; font-weight:700; border-bottom:1px solid #000; display:inline-block; width:100%; padding-bottom:1px; margin-bottom:1px;">
        {{ strtoupper($faculty->last_name) }}, {{ strtoupper($faculty->first_name) }} {{ $faculty->middle_name ? strtoupper(substr($faculty->middle_name, 0, 1)) . '.' : '' }}
    </div>
    <div style="text-align:center; font-size:7px; font-style:italic; margin-bottom:4px;">(Name)</div>

    {{-- ── MONTH & HOURS INFO ──────────────────────────────────── --}}
    <table style="width:100%; margin:0 auto 3px;">
        <tr>
            <td style="font-size:8px; vertical-align:top; width:55%;">
                <div>For the month of: <strong style="font-size:9px;">{{ $periodLabel }}</strong></div>
            </td>
            <td style="font-size:7px; vertical-align:top; text-align:left;">
                <div style="font-style:italic;">Regular days</div>
                <div style="font-style:italic;">Saturdays</div>
            </td>
        </tr>
        <tr>
            <td style="font-size:7.5px; font-style:italic;">Official hours for arrival<br>and departure</td>
            <td></td>
        </tr>
    </table>

    {{-- ── DTR TABLE ───────────────────────────────────────────── --}}
    <table class="dtr-table">
        <colgroup>
            <col class="day-col">
            <col class="time-col">
            <col class="time-col">
            <col class="time-col">
            <col class="time-col">
            <col class="time-col">
            <col class="time-col">
        </colgroup>
        {{-- Column headers --}}
        <tr>
            <th rowspan="2" style="width:22px; font-size:7px; font-weight:700;">Day</th>
            <th colspan="2" style="font-size:8px; font-weight:700;">A.M.</th>
            <th colspan="2" style="font-size:8px; font-weight:700;">P.M.</th>
            <th colspan="2" style="font-size:8px; font-weight:700;"></th>
        </tr>
        <tr>
            <th style="font-size:6.5px; font-weight:400;">Arrival</th>
            <th style="font-size:6.5px; font-weight:400;">Depar-<br>ture</th>
            <th style="font-size:6.5px; font-weight:400;">Arrival</th>
            <th style="font-size:6.5px; font-weight:400;">Depar-<br>ture</th>
            <th style="font-size:6.5px; font-weight:400;">Arrival</th>
            <th style="font-size:6.5px; font-weight:400;">Depar-<br>ture</th>
        </tr>

    {{-- Day rows --}}
    @for ($d = 0; $d < $totalDays; $d++)
        @php
            $r   = $rows[$d];
            $st  = $r['status'] ?? 'none';
            $isHoliday = $r['is_holiday'] ?? false;
            $holidayLabel = $r['holiday_label'] ?? '';
            $hasTimes = !empty($r['morning_in'])
                || !empty($r['morning_out'])
                || !empty($r['afternoon_in'])
                || !empty($r['afternoon_out'])
                || !empty($r['night_in'])
                || !empty($r['night_out']);
        @endphp
        <tr>
            <td style="font-size:8px; font-weight:700;">
                <div>{{ $r['day'] }}</div>
                @if ($isHoliday)
                    <div style="font-size:6px; font-style:italic;">{{ $holidayLabel ?: 'HOLIDAY' }}</div>
                @endif
            </td>
            @if ($isHoliday && ! $hasTimes)
                <td colspan="6" style="font-size:7px; font-style:italic;">HOLIDAY</td>
            @else
                <td style="font-size:7.5px;">{{ $r['morning_in'] }}</td>
                <td style="font-size:7.5px;">{{ $r['morning_out'] }}</td>
                <td style="font-size:7.5px;">{{ $r['afternoon_in'] }}</td>
                    <td style="font-size:7.5px;">{{ $r['afternoon_out'] }}</td>
                    <td style="font-size:7.5px;">{{ $r['night_in'] }}</td>
                    <td style="font-size:7.5px;">{{ $r['night_out'] }}</td>
                @endif
            </tr>
        @endfor

        {{-- TOTAL row --}}
        <tr>
            <td colspan="6" style="font-size:8px; font-weight:700; text-align:right; padding-right:8px; height:16px;">
                Total Hours Attended
            </td>
            <td style="font-size:8px; font-weight:700; text-align:center;">
                {{ number_format((float) ($summary['totalHoursRendered'] ?? 0), 2) }}
            </td>
        </tr>
    </table>

    {{-- ── CERTIFICATION ───────────────────────────────────────── --}}
    <div style="font-size:7.5px; font-style:italic; line-height:1.35; margin-top:6px; padding:0 2px;">
        I certify on my honor that the above is a true and correct report of the
        hours of work performed, record of which was made daily at the time of
        arrival and departure from office.
    </div>

    {{-- ── SIGNATURE LINE ──────────────────────────────────────── --}}
    <div style="margin-top:20px; width:60%; margin-left:auto; margin-right:auto; border-bottom:1px solid #000;"></div>
    <div style="text-align:center; font-size:7px; margin-top:2px; margin-bottom:8px;"></div>

    {{-- ── NOTED SECTION ───────────────────────────────────────── --}}
    <div style="font-size:7.5px; margin-top:3px;">
        NOTED as to the prescribed office hours:
    </div>

    <div style="font-size:7.5px; margin-top:4px;">
        Noted:
    </div>

    <div style="margin-top:16px; width:60%; margin-left:auto; margin-right:auto; border-bottom:1px solid #000;"></div>
    <div style="text-align:center; font-size:8px; font-weight:700; margin-top:2px;">In Charge</div>

    <div style="text-align:center; font-size:7px; margin-top:4px;">(SEE INSTRUCTION ON BACK)</div>

</div>
</div>
</body>
</html>
