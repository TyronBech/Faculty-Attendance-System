<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Monthly Time Record</title>
    <style>
        @page {
            size: 210mm 297mm;
            margin: 5mm 6mm;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 6.5pt;
            line-height: 1.05;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page {
            width: 100%;
            margin: 0;
            padding: 0;
        }

        table { border-collapse: collapse; border-spacing: 0; }

        /* ── HEADER BANNER ── */
        .banner { width: 100%; margin-bottom: 1mm; }
        .banner-logo {
            width: 18mm;
            vertical-align: middle;
            text-align: center;
            padding-right: 2mm;
        }
        .banner-text {
            vertical-align: middle;
            text-align: center;
            padding: 0 1mm;
        }
        .banner-text .line1 { font-size: 6.5pt; }
        .banner-text .line2 { font-size: 8.5pt; font-weight: 700; margin-top: 0.2mm; }
        .banner-text .line3 { font-size: 7pt; font-weight: 700; margin-top: 0.2mm; }
        .banner-text .line4 { font-size: 8pt; font-weight: 700; margin-top: 0.3mm; }
        .banner-form {
            width: 24mm;
            vertical-align: top;
            text-align: right;
            font-size: 6pt;
            line-height: 1.2;
        }

        /* ── META FIELDS ── */
        .meta { font-size: 7.5pt; margin: 0.5mm 0 0; }
        .meta-val { font-weight: 700; }

        /* ── MAIN TWO-COLUMN WRAPPER ── */
        .main-wrap { width: 100%; table-layout: fixed; margin-top: 1mm; }
        .col-left  { width: 57%; vertical-align: top; padding-right: 2mm; }
        .col-right { width: 43%; vertical-align: top; }

        /* ── TIME LOGS TABLE ── */
        .logs-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
        .logs-table th,
        .logs-table td {
            border: 1px solid #000;
            text-align: center;
            vertical-align: middle;
            font-size: 6pt;
            padding: 0px 1px;
            line-height: 1.0;
            height: 6mm;
            word-wrap: break-word;
            overflow: hidden;
        }
        .logs-table th { font-weight: 700; }
        .logs-table .section-hdr {
            font-size: 7.5pt;
            font-weight: 700;
            text-align: center;
            height: auto;
            padding: 1.5px 2px;
        }
        .logs-table .sub-hdr {
            font-size: 6.5pt;
            font-weight: 700;
            height: auto;
            padding: 1.5px 1px;
        }
        .logs-table .day-cell { font-weight: 700; font-size: 6.5pt; width: 7%; }
        .logs-table .col-time { width: 10%; }
        .logs-table .col-mins { width: 8%; font-size: 5.5pt; }

        .holiday-cell { font-style: italic; font-size: 6.5pt; }

        .txt-red   { color: red; }
        .txt-blue  { color: blue; }
        .txt-green { color: green; }

        /* ── SUMMARY TABLE ── */
        .summary-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 1.5mm; }
        .summary-table th,
        .summary-table td {
            border: 1px solid #000;
            font-size: 6.5pt;
            padding: 1.5px 3px;
            vertical-align: middle;
        }
        .summary-table .section-hdr {
            text-align: center;
            font-weight: 700;
            font-size: 7.5pt;
            padding: 1.5px 3px;
        }
        .summary-table .label-col { width: 70%; }
        .summary-table .val-col   { width: 30%; text-align: center; }

        /* ── MANUAL ENTRY TABLE ── */
        .manual-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
        .manual-table th,
        .manual-table td {
            border: 1px solid #000;
            font-size: 6.5pt;
            padding: 1px 3px;
            vertical-align: middle;
        }
        .manual-table .section-hdr {
            text-align: center;
            font-weight: 700;
            font-size: 7.5pt;
            padding: 1.5px 3px;
        }
        .manual-table .empty-row td { height: 6mm; }

        /* ── CERT / SIGNATURES ── */
        .cert {
            font-size: 6pt;
            font-style: italic;
            margin-top: 1.5mm;
            line-height: 1.25;
            text-align: justify;
        }
        .sig-line       { border-bottom: 1px solid #000; width: 70%; margin: 5mm auto 0.5mm; }
        .sig-label      { text-align: center; font-size: 6pt; }
        .verified       { font-size: 6pt; font-style: italic; margin-top: 1.5mm; }
        .in-charge-line { border-bottom: 1px solid #000; width: 70%; margin: 5mm auto 0.5mm; }
        .in-charge-label{ text-align: center; font-size: 6.5pt; font-weight: 700; }

        /* ── NOTICES / LEGEND / BIOMETRIC ── */
        .notice-box { font-size: 5.5pt; line-height: 1.3; margin-top: 1.2mm; text-align: justify; }
        .legend     { font-size: 5.5pt; line-height: 1.35; }
        .biometric  { font-size: 5.5pt; line-height: 1.35; }
        .date-printed { font-size: 5.5pt; font-weight: 700; margin-top: 1mm; }

        /* Bottom strip */
        .bottom-strip { width: 100%; margin-top: 1mm; }
        .bottom-strip td { vertical-align: top; font-size: 5.5pt; line-height: 1.35; }
    </style>
</head>
<body>
@php
    $totalDays = count($rows);
    $employeeNo = $faculty->faculty_code ?: ($faculty->biometric_id ?: ('ID-'.$faculty->id));
    $isPartTime = in_array(strtolower((string) ($faculty->employment_type ?? '')), ['part-time', 'part_time'], true);
    $pupLogoPath = public_path('images/PUP Taguig Logo.jpg');
    $dtrLogoDataUri = '';
    if (is_file($pupLogoPath)) {
        $dtrLogoDataUri = 'data:image/jpeg;base64,'.base64_encode((string) file_get_contents($pupLogoPath));
    }

    $manualList = $manualEntries ?? [];
    $filledManual = count($manualList);
    $manualBlank = max(0, $totalDays - 7 - $filledManual);
@endphp
<div class="page">

    {{-- ══ HEADER ══ --}}
    <table class="banner">
        <tr>
            <td class="banner-logo">
                @if ($dtrLogoDataUri !== '')
                    <img src="{{ $dtrLogoDataUri }}"
                         style="width:20mm;height:20mm;display:block;margin:0 auto;object-fit:contain;" alt="PUP Logo">
                @endif
            </td>
            <td class="banner-text">
                <div class="line1">Republic of the Philippines</div>
                <div class="line2">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</div>
                <div class="line3">OFFICE OF THE VICE PRESIDENT FOR ADMINISTRATION</div>
                <div class="line3">Human Resources Management Department</div>
                <div class="line4">
                    Monthly Time Record
                    @if ($isPartTime)
                        <span style="font-style:italic;">(Part-Time)</span>
                    @endif
                </div>
            </td>
            <td class="banner-form">
                <div style="font-style:italic;">Civil Service Form No. 48</div>
                <div>Daily Time Record</div>
            </td>
        </tr>
    </table>

    {{-- ══ META ══ --}}
    <div class="meta">For the Period of: <span class="meta-val">{{ $periodLabel }}</span></div>
    <div class="meta">Employee Name:
        <span class="meta-val">
            {{ strtoupper($faculty->last_name) }}, {{ strtoupper($faculty->first_name) }}
            {{ $faculty->middle_name ? strtoupper(substr($faculty->middle_name, 0, 1)).'.' : '' }}
            ({{ $employeeNo }})
        </span>
    </div>
    <div class="meta" style="margin-bottom:0;">Department:
        <span style="font-weight:400;text-transform:uppercase;">{{ $faculty->department?->name ?? '' }}</span>
    </div>

    {{-- ══ MAIN TWO-COLUMN ══ --}}
    <table class="main-wrap">
    <tr>

        {{-- LEFT: TIME LOGS --}}
        <td class="col-left">
            <table class="logs-table">
                <tbody>
                <tr><th colspan="8" class="section-hdr">TIME LOGS</th></tr>
                <tr>
                    <th class="day-cell sub-hdr" rowspan="2">Day</th>
                    <th colspan="2" class="sub-hdr">Morning</th>
                    <th colspan="2" class="sub-hdr">Afternoon</th>
                    <th colspan="2" class="sub-hdr">Night</th>
                    <th class="col-mins sub-hdr" rowspan="2">Minutes<br>Tardy&nbsp;/&nbsp;UT</th>
                </tr>
                <tr>
                    <th class="col-time sub-hdr">IN</th>
                    <th class="col-time sub-hdr">OUT</th>
                    <th class="col-time sub-hdr">IN</th>
                    <th class="col-time sub-hdr">OUT</th>
                    <th class="col-time sub-hdr">IN</th>
                    <th class="col-time sub-hdr">OUT</th>
                </tr>
                @for ($d = 0; $d < $totalDays; $d++)
                    @php
                        $r = $rows[$d];
                        $isHoliday = $r['is_holiday'] ?? false;
                        $hasTimes = ! empty($r['morning_in']) || ! empty($r['morning_out'])
                            || ! empty($r['afternoon_in']) || ! empty($r['afternoon_out'])
                            || ! empty($r['night_in']) || ! empty($r['night_out']);
                        $tardy = (int) ($r['tardy_minutes'] ?? 0);
                        $ut = (int) ($r['undertime_minutes'] ?? 0);
                        $isManual = $r['is_manual'] ?? false;
                        $tdClass = $isManual ? 'txt-blue' : '';
                    @endphp
                    <tr>
                        <td class="day-cell">{{ $r['day'] }}</td>
                        @if ($isHoliday && ! $hasTimes)
                            <td colspan="7" class="holiday-cell txt-green">HOLIDAY</td>
                        @else
                            <td class="{{ $tdClass }}">{{ $r['morning_in'] ?? '' }}</td>
                            <td class="{{ $tdClass }}">{{ $r['morning_out'] ?? '' }}</td>
                            <td class="{{ $tdClass }}">{{ $r['afternoon_in'] ?? '' }}</td>
                            <td class="{{ $tdClass }}">{{ $r['afternoon_out'] ?? '' }}</td>
                            <td class="{{ $tdClass }}">{{ $r['night_in'] ?? '' }}</td>
                            <td class="{{ $tdClass }}">{{ $r['night_out'] ?? '' }}</td>
                            <td class="txt-red">
                                @if ($tardy > 0 && $ut > 0)
                                    {{ $tardy }} / {{ $ut }}
                                @elseif ($tardy > 0)
                                    {{ $tardy }}
                                @elseif ($ut > 0)
                                    {{ $ut }}
                                @endif
                            </td>
                        @endif
                    </tr>
                @endfor
                </tbody>
            </table>

            {{-- CERT --}}
            <div class="cert">
                I certify on my honor that the above is a true and correct report of the hours of work
                performed, record of which was made daily at the time of arrival and departure from office.
            </div>
            <div class="sig-line"></div>
            <div class="sig-label">&nbsp;</div>
            <div class="verified">VERIFIED as to the prescribed office hours:</div>
            <div class="in-charge-line"></div>
            <div class="in-charge-label">In Charge</div>
        </td>

        {{-- RIGHT: SUMMARY + MANUAL ENTRY --}}
        <td class="col-right">

            {{-- SUMMARY --}}
            <table class="summary-table">
                <tr><th colspan="2" class="section-hdr">SUMMARY</th></tr>
                <tr>
                    <td class="label-col">No. of Days Absent:</td>
                    <td class="val-col">{{ $summary['daysAbsent'] ?? 0 }}</td>
                </tr>
                <tr>
                    <td class="label-col">No. of Times Tardy:</td>
                    <td class="val-col">{{ $summary['timesLate'] ?? 0 }} ({{ $summary['totalLateMinutes'] ?? 0 }} mins.)</td>
                </tr>
                <tr>
                    <td class="label-col">No. of Times Under Time:</td>
                    <td class="val-col">{{ $summary['timesUndertime'] ?? 0 }} ({{ $summary['totalUndertimeMinutes'] ?? 0 }} mins.)</td>
                </tr>
                <tr>
                    <td class="label-col">No. of Nights Rendered:</td>
                    <td class="val-col">{{ $summary['timesNight'] ?? 0 }} ({{ $summary['totalNightMinutes'] ?? 0 }} mins.)</td>
                </tr>
                <tr>
                    <td class="label-col">No. of Overtime Rendered:</td>
                    <td class="val-col">{{ $summary['timesOvertime'] ?? 0 }} ({{ $summary['totalOvertimeMinutes'] ?? 0 }} mins.)</td>
                </tr>
                <tr>
                    <td class="label-col">No. of Overtime Nights Rendered:</td>
                    <td class="val-col">{{ $summary['timesOvertimeNight'] ?? 0 }} ({{ $summary['totalOvertimeNightMinutes'] ?? 0 }} mins.)</td>
                </tr>
            </table>

            {{-- MANUAL ENTRY: rows padded to match logs table height --}}
            <table class="manual-table">
                <tr><th colspan="2" class="section-hdr">MANUAL ENTRY</th></tr>
                <tr>
                    <th style="width:36%;">Date</th>
                    <th style="width:64%;">Reason</th>
                </tr>
                @foreach ($manualList as $entry)
                    <tr><td>{{ $entry['date'] }}</td><td>{{ $entry['reason'] }}</td></tr>
                @endforeach
                @for ($i = 0; $i < $manualBlank; $i++)
                    <tr class="empty-row"><td></td><td></td></tr>
                @endfor
            </table>

            {{-- NOTICES --}}
            <div class="notice-box">
                All employees are required to submit their duly signed Monthly Time
                Record within five (5) days after the end of each month to the Human
                Resource Management Department.
            </div>
            <div class="notice-box">
                You are allowed to login/logout only at the biometric device that is nearest
                to your assigned office unless you are performing an official task
                instructed by your supervisor that requires logging at other biometric
                devices.
            </div>
            <div class="notice-box">
                Absences, Tardiness and Under time are automatically computed in the
                system. Half day is considered as tardy or under time.
            </div>
            <div class="date-printed">
                Date Printed: {{ $generatedAt ?? now()->format('l, F j, Y') }}
            </div>

        </td>
    </tr>
    </table>

    {{-- BOTTOM STRIP: Legend left, Biometric right --}}
    <table class="bottom-strip">
        <tr>
            <td style="width:50%;">
                <div class="legend">
                    <strong>Legend:</strong><br>
                    <strong>Text Color</strong><br>
                    <span class="txt-red">RED</span> &nbsp;– Tardy/Under Time<br>
                    <span class="txt-blue">BLUE</span> – Manual Entry<br>
                    <span class="txt-green">GREEN</span> – Holiday/Suspended Office Hours
                </div>
            </td>
            <td style="width:50%;">
                <div class="biometric">
                    <strong>Biometric Device Location:</strong><br>
                    1 – Main Building (A. Mabini Campus)<br>
                    2 – NALLRC (A. Mabini Campus)<br>
                    3 – CEA / COC / ITech (NDC Campus)<br>
                    4 – Hasmin (M. H. Del Pilar Campus)
                </div>
            </td>
        </tr>
    </table>

</div>
</body>
</html>
