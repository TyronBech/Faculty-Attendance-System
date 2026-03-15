<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\BiometricLog;
use App\Models\Faculty;
use App\Models\ImportBatch;
use App\Models\InternalSchedule;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use RuntimeException;
use SplFileObject;

class AdminAttendanceImportController extends Controller
{
    /** Grace period (in minutes) before a check-in is considered late. */
    private const GRACE_PERIOD_MINUTES = 5;

    /** Buffer (in minutes) around a schedule window when matching biometric logs. */
    private const LOG_WINDOW_BUFFER_MINUTES = 120;

    public function index(Request $request)
    {
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(5, min($perPage, 50));

        $batches = ImportBatch::query()
            ->with(['importedBy:id,email'])
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/AttendanceImports', [
            'batches' => $batches,
            'filters' => [
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:20480'],
        ]);

        $file = $validated['file'];
        $storedPath = $file->store('imports/biometric-logs');

        $batch = ImportBatch::create([
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'status' => 'processing',
            'imported_by' => Auth::id(),
            'started_at' => now(),
        ]);

        try {
            $parsedRows = $this->parseImportFile(Storage::path($storedPath));

            $totalRecords = count($parsedRows);
            $processedRecords = 0;
            $failedRecords = 0;
            $duplicateRecords = 0;
            $errors = [];

            DB::beginTransaction();

            foreach ($parsedRows as $row) {
                if ($row['biometric_id'] === '' || $row['log_datetime'] === '' || $row['log_type'] === '') {
                    $failedRecords++;
                    $errors[] = "Line {$row['line']}: biometric_id, log_datetime, and log_type are required.";
                    continue;
                }

                $parsedDateTime = $this->parseDateTime($row['log_datetime']);
                if (! $parsedDateTime) {
                    $failedRecords++;
                    $errors[] = "Line {$row['line']}: invalid log_datetime format '{$row['log_datetime']}'. Use YYYY-MM-DD HH:MM:SS.";
                    continue;
                }

                try {
                    BiometricLog::create([
                        'biometric_id' => $row['biometric_id'],
                        'log_datetime' => $parsedDateTime,
                        'log_type' => $row['log_type'],
                        'device_id' => $row['device_id'] !== '' ? $row['device_id'] : null,
                        'import_batch_id' => $batch->id,
                        'is_processed' => false,
                    ]);

                    $processedRecords++;
                } catch (QueryException $e) {
                    if ($this->isDuplicateKeyException($e)) {
                        $duplicateRecords++;
                        continue;
                    }

                    $failedRecords++;
                    $errors[] = "Line {$row['line']}: failed to insert record.";
                }
            }

            DB::commit();

            $status = ($processedRecords === 0 && $failedRecords > 0) ? 'failed' : 'completed';

            $batch->update([
                'total_records' => $totalRecords,
                'processed_records' => $processedRecords,
                'failed_records' => $failedRecords,
                'duplicate_records' => $duplicateRecords,
                'status' => $status,
                'completed_at' => now(),
                'error_log' => empty($errors) ? null : implode(PHP_EOL, array_slice($errors, 0, 100)),
            ]);

            return redirect()
                ->route('admin.attendance-imports.index')
                ->with('success', "Import complete. Processed: {$processedRecords}, Failed: {$failedRecords}, Duplicates: {$duplicateRecords}.");
        } catch (RuntimeException $e) {
            $batch->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_log' => $e->getMessage(),
            ]);

            return redirect()
                ->route('admin.attendance-imports.index')
                ->with('error', $e->getMessage());
        } catch (\Throwable $e) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            $batch->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_log' => 'Unexpected import error. Please check the file format and try again.',
            ]);

            return redirect()
                ->route('admin.attendance-imports.index')
                ->with('error', 'Import failed due to an unexpected error.');
        }
    }

    public function details(Request $request, ImportBatch $batch): JsonResponse
    {
        $perPage = max(10, min((int) $request->query('per_page', 50), 100));

        $logsQuery = BiometricLog::query()
            ->where('import_batch_id', $batch->id)
            ->with(['faculty:id,biometric_id,first_name,middle_name,last_name'])
            ->orderBy('log_datetime')
            ->orderBy('id');

        // Pre-load the set of known biometric IDs to determine which logs have unrecognised faculty.
        $knownBiometricIds = Faculty::query()->pluck('biometric_id')->flip();

        $paginated = $logsQuery->paginate($perPage)->through(function (BiometricLog $log) use ($knownBiometricIds): array {
            $facultyExists = $knownBiometricIds->has($log->biometric_id);

            return [
                'id' => $log->id,
                'faculty_name' => $log->faculty?->full_name ?? null,
                'faculty_exists' => $facultyExists,
                'biometric_id' => $log->biometric_id,
                'log_datetime' => optional($log->log_datetime)->format('Y-m-d H:i:s'),
                'log_type' => $log->log_type,
                'is_processed' => (bool) $log->is_processed,
            ];
        });

        $counts = BiometricLog::where('import_batch_id', $batch->id)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as synced')
            ->first();

        $totalLogs = (int) ($counts->total ?? 0);
        $syncedLogs = (int) ($counts->synced ?? 0);

        // Count unsynced logs whose biometric_id has no matching faculty record.
        // Uses the already-loaded $knownBiometricIds collection to avoid an extra DB round-trip.
        // Only unprocessed logs are counted so that the frontend's syncable-count arithmetic
        // (unsyncedLogs − unrecognizedLogs) remains accurate even when a faculty is soft-deleted
        // after their logs were already synced.
        $unrecognizedLogs = BiometricLog::where('import_batch_id', $batch->id)
            ->where('is_processed', false)
            ->whereNotIn('biometric_id', $knownBiometricIds->keys())
            ->count();

        return response()->json([
            'batch' => [
                'id' => $batch->id,
                'file_name' => $batch->file_name,
                'status' => $batch->status,
                'error_log' => $batch->error_log,
                'total_logs' => $totalLogs,
                'synced_logs' => $syncedLogs,
                'unsynced_logs' => $totalLogs - $syncedLogs,
                'unrecognized_logs' => $unrecognizedLogs,
            ],
            'logs' => $paginated,
        ]);
    }

    public function sync(ImportBatch $batch): JsonResponse
    {
        if (in_array($batch->status, ['failed', 'processing'], true)) {
            return response()->json([
                'message' => "Cannot sync a batch with status '{$batch->status}'.",
            ], 409);
        }

        // Only recognized, unsynced logs are candidates for attendance sync.
        $candidateLogs = BiometricLog::query()
            ->where('import_batch_id', $batch->id)
            ->where('is_processed', false)
            ->whereIn('biometric_id', Faculty::query()->select('biometric_id'))
            ->with(['faculty:id,biometric_id'])
            ->orderBy('log_datetime')
            ->orderBy('id')
            ->get();

        if ($candidateLogs->isEmpty()) {
            return response()->json([
                'message' => 'This batch is already fully synced.',
                'synced_count' => 0,
                'attendance_records_count' => 0,
            ]);
        }

        $logsToMarkProcessed = [];
        $syncedCount = 0;
        $skippedCount = 0;
        $attendanceRecordsCount = 0;

        DB::transaction(function () use (
            $candidateLogs,
            &$logsToMarkProcessed,
            &$syncedCount,
            &$skippedCount,
            &$attendanceRecordsCount
        ): void {
            $groupedByFacultyAndDate = $candidateLogs->groupBy(function (BiometricLog $log): string {
                $facultyId = $log->faculty?->id;
                $date = $log->log_datetime?->toDateString();

                return ($facultyId ?? '0') . '|' . ($date ?? '');
            });

            foreach ($groupedByFacultyAndDate as $groupKey => $logsGroup) {
                [$facultyId, $date] = array_pad(explode('|', (string) $groupKey, 2), 2, null);

                if (! $facultyId || ! $date) {
                    $skippedCount += $logsGroup->count();
                    continue;
                }

                $faculty = Faculty::find($facultyId);
                if (! $faculty) {
                    $skippedCount += $logsGroup->count();
                    continue;
                }

                $syncResult = $this->createOrUpdateAttendanceRecordsFromBiometricLogs(
                    $faculty,
                    $date
                );

                if (! $syncResult['synced']) {
                    $skippedCount += $logsGroup->count();
                    continue;
                }

                $attendanceRecordsCount += $syncResult['attendance_records_count'];
                $syncedCount += $logsGroup->count();
                $logsToMarkProcessed = array_merge(
                    $logsToMarkProcessed,
                    $logsGroup->pluck('id')->all()
                );
            }

            if (! empty($logsToMarkProcessed)) {
                BiometricLog::query()
                    ->whereIn('id', array_values(array_unique($logsToMarkProcessed)))
                    ->update([
                        'is_processed' => true,
                        'updated_at' => now(),
                    ]);
            }
        });

        if ($syncedCount > 0) {
            $logLabel = $syncedCount === 1 ? 'entry was' : 'entries were';
            $recordLabel = $attendanceRecordsCount === 1 ? 'record was' : 'records were';
            $message = "{$syncedCount} biometric log {$logLabel} successfully synced and {$attendanceRecordsCount} attendance {$recordLabel} updated.";
            if ($skippedCount > 0) {
                $message .= " {$skippedCount} " . ($skippedCount === 1 ? 'log was' : 'logs were') . ' skipped (no matching active schedule found).';
            }
        } else {
            $message = $skippedCount > 0
                ? "No logs were synced. {$skippedCount} " . ($skippedCount === 1 ? 'log was' : 'logs were') . ' skipped because no matching active schedule entries could be found.'
                : 'This batch is already fully synced.';
        }

        return response()->json([
            'message' => $message,
            'synced_count' => $syncedCount,
            'skipped_count' => $skippedCount,
            'attendance_records_count' => $attendanceRecordsCount,
        ]);
    }

    /**
     * Create/update attendance records for a faculty on a target date based on imported biometric logs.
     *
     * Rules:
     * - Official times come from active schedule_details on that date/day, with approved
     *   ScheduleChangeRequests applied (moved-away classes excluded; changed times used).
     * - Operational times come from the InternalSchedule row whose start time most closely
     *   matches the official detail; falls back to official times when no row exists.
     * - Actual times are resolved per-detail by matching biometric logs to each detail's
     *   operational time window (±120 min buffer) so that multiple schedule blocks in
     *   a single day receive independent actual-time and metrics values.
     * - Late/undertime/overtime are computed per-detail inline against operational times.
     */
    private function createOrUpdateAttendanceRecordsFromBiometricLogs(Faculty $faculty, string $date): array
    {
        $targetDate = Carbon::parse($date);
        $dayOfWeek = $targetDate->format('l');

        $activeScheduleIds = $faculty->schedules()
            ->where('status', 'active')
            ->whereDate('effective_from', '<=', $targetDate->toDateString())
            ->whereDate('effective_until', '>=', $targetDate->toDateString())
            ->pluck('id');

        if ($activeScheduleIds->isEmpty()) {
            return ['synced' => false, 'attendance_records_count' => 0];
        }

        $officialDetails = ScheduleDetail::query()
            ->whereIn('schedule_id', $activeScheduleIds)
            ->where('day', $dayOfWeek)
            ->orderBy('start_time')
            ->get();

        if ($officialDetails->isEmpty()) {
            return ['synced' => false, 'attendance_records_count' => 0];
        }

        // ── Apply approved ScheduleChangeRequests ────────────────────────────
        // Details moved to a different day are skipped; changed times override
        // the official detail's start/end times.
        $approvedChanges = ScheduleChangeRequest::query()
            ->where('faculty_id', $faculty->id)
            ->where('status', 'approved')
            ->whereIn('schedule_detail_id', $officialDetails->pluck('id'))
            ->where('effective_date', '<=', $targetDate->toDateString())
            ->orderBy('effective_date', 'desc')
            ->get()
            ->groupBy('schedule_detail_id')
            ->map(fn ($group) => $group->first());

        $dayLogs = BiometricLog::query()
            ->where('biometric_id', $faculty->biometric_id)
            ->whereDate('log_datetime', $targetDate->toDateString())
            ->orderBy('log_datetime', 'asc')
            ->get();

        $recordsCreatedOrUpdated = 0;

        foreach ($officialDetails as $detail) {
            $change = $approvedChanges->get($detail->id);

            // If a change request moved this class to a different day, skip it.
            if ($change && $change->requested_day_of_week !== $dayOfWeek) {
                continue;
            }

            // Determine official times (apply change-request override when present).
            if ($change) {
                $officialTimeIn = Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($change->requested_time_in)->format('H:i:s'));
                $officialTimeOut = Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($change->requested_time_out)->format('H:i:s'));
            } else {
                $officialTimeIn = Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($detail->start_time)->format('H:i:s'));
                $officialTimeOut = $detail->end_time
                    ? Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($detail->end_time)->format('H:i:s'))
                    : $officialTimeIn->copy()->addHours(max(1, (int) ($detail->hours_required ?? 1)));
            }

            // Select the InternalSchedule row whose device_time_in most closely matches
            // the official start time, ensuring the correct block is chosen when
            // multiple operational rows exist for the same faculty/schedule/day.
            $internalSchedule = InternalSchedule::query()
                ->where('faculty_id', $faculty->id)
                ->where('schedule_id', $detail->schedule_id)
                ->where('day_of_week', $dayOfWeek)
                ->where('is_operational', true)
                ->orderByRaw('ABS(TIMESTAMPDIFF(MINUTE, TIME(device_time_in), TIME(?)))', [$officialTimeIn->format('H:i:s')])
                ->first();

            if ($internalSchedule) {
                $operationalTimeIn = Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($internalSchedule->device_time_in)->format('H:i:s'));
                $operationalTimeOut = $internalSchedule->device_time_out
                    ? Carbon::parse($targetDate->toDateString() . ' ' . Carbon::parse($internalSchedule->device_time_out)->format('H:i:s'))
                    : $operationalTimeIn->copy()->addHours(max(1, (int) ($detail->hours_required ?? 1)));
                $operationalDayOfWeek = $internalSchedule->day_of_week;
            } else {
                $operationalTimeIn = $officialTimeIn->copy();
                $operationalTimeOut = $officialTimeOut->copy();
                $operationalDayOfWeek = $detail->day;
            }

            // ── Match biometric logs to this detail's time window ────────────
            // Use a ±buffer window around the operational start/end times so
            // that each schedule block receives its own actual-time values and
            // the same log is not blindly duplicated across all detail records.
            $windowStart = $operationalTimeIn->copy()->subMinutes(self::LOG_WINDOW_BUFFER_MINUTES);
            $windowEnd = $operationalTimeOut->copy()->addMinutes(self::LOG_WINDOW_BUFFER_MINUTES);

            $windowLogs = $dayLogs->filter(function (BiometricLog $log) use ($windowStart, $windowEnd): bool {
                $logTime = Carbon::parse($log->log_datetime);

                return $logTime->between($windowStart, $windowEnd);
            });

            $actualTimeIn = $windowLogs->first(function (BiometricLog $log): bool {
                return strtoupper(trim((string) $log->log_type)) === 'IN';
            })?->log_datetime;

            $actualTimeOut = $windowLogs->reverse()->first(function (BiometricLog $log): bool {
                return strtoupper(trim((string) $log->log_type)) === 'OUT';
            })?->log_datetime;

            // ── Compute per-detail metrics inline ───────────────────────────
            $lateMinutes = 0;
            $undertimeMinutes = 0;
            $overtimeMinutes = 0;
            $status = $actualTimeIn ? 'Present' : 'Absent';

            if ($actualTimeIn) {
                if ($actualTimeIn->greaterThan($operationalTimeIn->copy()->addMinutes(self::GRACE_PERIOD_MINUTES))) {
                    $status = 'Late';
                    $lateMinutes = (int) $operationalTimeIn->copy()->addMinutes(self::GRACE_PERIOD_MINUTES)->diffInMinutes($actualTimeIn);
                }
            }

            if ($actualTimeIn && $actualTimeOut) {
                if ($actualTimeOut->lessThan($operationalTimeOut)) {
                    $status = ($status === 'Late') ? 'Late & Early-Out' : 'Early-Out';
                    $undertimeMinutes = (int) $actualTimeOut->diffInMinutes($operationalTimeOut);
                }

                if ($actualTimeOut->greaterThan($operationalTimeOut)) {
                    $overtimeMinutes = (int) $operationalTimeOut->diffInMinutes($actualTimeOut);
                }
            }

            if ($actualTimeIn && ! $actualTimeOut) {
                $status = 'Missing Check-Out';
            }

            $totalHoursRendered = 0;
            if ($actualTimeIn && $actualTimeOut && $actualTimeOut->greaterThan($actualTimeIn)) {
                $totalHoursRendered = round($actualTimeIn->diffInMinutes($actualTimeOut) / 60, 2);
            }

            AttendanceRecord::updateOrCreate(
                [
                    'faculty_id' => $faculty->id,
                    'attendance_date' => $targetDate->toDateString(),
                    'schedule_detail_id' => $detail->id,
                ],
                [
                    'internal_schedule_id' => $internalSchedule?->id,
                    'day_of_week' => $detail->day,
                    'official_time_in' => $officialTimeIn,
                    'official_time_out' => $officialTimeOut,
                    'operational_day_of_week' => $operationalDayOfWeek,
                    'operational_time_in' => $operationalTimeIn,
                    'operational_time_out' => $operationalTimeOut,
                    'actual_time_in' => $actualTimeIn,
                    'actual_time_out' => $actualTimeOut,
                    'late_minutes' => $lateMinutes,
                    'undertime_minutes' => $undertimeMinutes,
                    'overtime_minutes' => $overtimeMinutes,
                    'night_minutes' => 0,
                    'overtime_night_minutes' => 0,
                    'total_hours_rendered' => $totalHoursRendered,
                    'required_hours' => (float) ($internalSchedule?->required_hours ?? $detail->hours_required ?? 0),
                    'status' => $status,
                    'remarks' => 'Synced from biometric import',
                    'is_manual_entry' => false,
                    'processed_at' => now(),
                ]
            );

            $recordsCreatedOrUpdated++;
        }

        return ['synced' => true, 'attendance_records_count' => $recordsCreatedOrUpdated];
    }

    public function downloadTemplate()
    {
        return $this->downloadXlsxTemplate();
    }

    private function downloadXlsxTemplate()
    {
        $fileName = 'biometric_logs_import_template.xlsx';

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Biometric Logs Template');

        $sheet->setCellValue('A1', 'Attendance Log Import Template');
        $sheet->setCellValue('A2', 'Purpose: Use this sheet to bulk import biometric attendance logs for faculty.');
        $sheet->setCellValue('A3', 'Fill one log entry per row starting at row 10. Do not change the column names in row 9.');

        $sheet->fromArray([
            ['Column', 'Purpose / Format'],
            ['biometric_id', 'Required. Faculty biometric ID. Must match an existing faculties.biometric_id value.'],
            ['log_datetime', 'Required. Date and time of the log. Recommended format: YYYY-MM-DD HH:MM:SS.'],
            ['log_type', 'Required. Log type from the device (e.g., IN or OUT).'],
            ['device_id', 'Optional. Identifier of the biometric device used to record the log.'],
        ], null, 'A5');

        $sheet->fromArray([
            ['biometric_id', 'log_datetime', 'log_type', 'device_id'],
            ['BIO-0001', '2026-03-01 08:02:15', 'IN', 'DEVICE-01'],
            ['BIO-0001', '2026-03-01 17:11:54', 'OUT', 'DEVICE-01'],
            ['BIO-0002', '2026-03-01 08:09:40', 'IN', 'DEVICE-02'],
            ['BIO-0002', '2026-03-01 17:04:11', 'OUT', 'DEVICE-02'],
        ], null, 'A9');

        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(9);
        $sheet->getStyle('A5:B5')->getFont()->setBold(true);
        $sheet->getStyle('A9:D9')->getFont()->setBold(true);

        foreach (['A', 'B', 'C', 'D'] as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'attendance_template_') . '.xlsx';

        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return response()->download($tempPath, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function downloadCsvTemplate()
    {
        $fileName = 'biometric_logs_import_template.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename={$fileName}",
        ];

        $callback = static function (): void {
            $output = fopen('php://output', 'wb');

            fwrite($output, "\xEF\xBB\xBF");

            fputcsv($output, ['biometric_id', 'log_datetime', 'log_type', 'device_id']);
            fputcsv($output, ['BIO-0001', '2026-03-01 08:02:15', 'IN', 'DEVICE-01']);
            fputcsv($output, ['BIO-0001', '2026-03-01 17:11:54', 'OUT', 'DEVICE-01']);
            fputcsv($output, ['BIO-0002', '2026-03-01 08:09:40', 'IN', 'DEVICE-02']);
            fputcsv($output, ['BIO-0002', '2026-03-01 17:04:11', 'OUT', 'DEVICE-02']);

            fclose($output);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function parseImportFile(string $fullPath): array
    {
        $extension = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));

        if (in_array($extension, ['xlsx', 'xls'], true)) {
            return $this->parseSpreadsheet($fullPath);
        }

        return $this->parseCsv($fullPath);
    }

    private function parseSpreadsheet(string $fullPath): array
    {
        if (! is_file($fullPath)) {
            throw new RuntimeException('Uploaded file could not be found.');
        }

        try {
            $spreadsheet = IOFactory::load($fullPath);
        } catch (\Throwable $e) {
            throw new RuntimeException('Invalid spreadsheet file. Please use the provided template.');
        }

        $sheet = $spreadsheet->getActiveSheet();
        $sheetRows = $sheet->toArray(null, true, true, true);

        if (empty($sheetRows)) {
            throw new RuntimeException('Invalid spreadsheet: missing header row.');
        }

        $requiredColumns = ['biometric_id', 'log_datetime', 'log_type'];
        $headerRowNumber = null;
        $columnIndex = [];

        foreach ($sheetRows as $rowNumber => $rowData) {
            $rowValues = array_values($rowData);
            $normalizedHeader = array_map(static function ($column): string {
                return strtolower(trim((string) $column));
            }, $rowValues);

            $hasAllRequired = true;
            foreach ($requiredColumns as $requiredColumn) {
                if (! in_array($requiredColumn, $normalizedHeader, true)) {
                    $hasAllRequired = false;
                    break;
                }
            }

            if ($hasAllRequired) {
                $headerRowNumber = (int) $rowNumber;
                $columnIndex = array_flip($normalizedHeader);
                break;
            }
        }

        if (! $headerRowNumber) {
            throw new RuntimeException('Invalid spreadsheet template. Missing required columns: biometric_id, log_datetime, log_type.');
        }

        $rows = [];

        foreach ($sheetRows as $rowNumber => $rowData) {
            if ((int) $rowNumber <= $headerRowNumber) {
                continue;
            }

            $rowValues = array_values($rowData);
            $nonEmptyValues = array_filter($rowValues, static fn ($value) => $value !== null && trim((string) $value) !== '');

            if (count($nonEmptyValues) === 0) {
                continue;
            }

            $rows[] = [
                'line' => (int) $rowNumber,
                'biometric_id' => trim((string) ($rowValues[$columnIndex['biometric_id']] ?? '')),
                'log_datetime' => $rowValues[$columnIndex['log_datetime']] ?? '',
                'log_type' => trim((string) ($rowValues[$columnIndex['log_type']] ?? '')),
                'device_id' => isset($columnIndex['device_id'])
                    ? trim((string) ($rowValues[$columnIndex['device_id']] ?? ''))
                    : '',
            ];
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $rows;
    }

    private function parseCsv(string $fullPath): array
    {
        if (! is_file($fullPath)) {
            throw new RuntimeException('Uploaded file could not be found.');
        }

        $file = new SplFileObject($fullPath, 'r');
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY);

        $requiredColumns = ['biometric_id', 'log_datetime', 'log_type'];
        $headerLine = null;
        $columnIndex = [];

        $line = 1;
        while (! $file->eof()) {
            $row = $file->fgetcsv();

            if (! is_array($row)) {
                $line++;
                continue;
            }

            $normalizedHeader = array_map(static function ($column): string {
                $value = (string) $column;

                // Strip UTF-8 BOM if present to ensure header names match required columns
                if (strncmp($value, "\xEF\xBB\xBF", 3) === 0) {
                    $value = substr($value, 3);
                }

                return strtolower(trim($value));
            }, $row);

            $hasAllRequired = true;
            foreach ($requiredColumns as $requiredColumn) {
                if (! in_array($requiredColumn, $normalizedHeader, true)) {
                    $hasAllRequired = false;
                    break;
                }
            }

            if ($hasAllRequired) {
                $headerLine = $line;
                $columnIndex = array_flip($normalizedHeader);
                break;
            }

            $line++;
        }

        if (! $headerLine) {
            throw new RuntimeException('Invalid CSV template. Missing required columns: biometric_id, log_datetime, log_type.');
        }

        $rows = [];

        $line = $headerLine + 1;

        while (! $file->eof()) {
            $row = $file->fgetcsv();

            if (! is_array($row)) {
                $line++;
                continue;
            }

            $nonEmptyValues = array_filter($row, static fn ($value) => $value !== null && trim((string) $value) !== '');
            if (count($nonEmptyValues) === 0) {
                $line++;
                continue;
            }

            $rows[] = [
                'line' => $line,
                'biometric_id' => trim((string) ($row[$columnIndex['biometric_id']] ?? '')),
                'log_datetime' => trim((string) ($row[$columnIndex['log_datetime']] ?? '')),
                'log_type' => trim((string) ($row[$columnIndex['log_type']] ?? '')),
                'device_id' => isset($columnIndex['device_id'])
                    ? trim((string) ($row[$columnIndex['device_id']] ?? ''))
                    : '',
            ];

            $line++;
        }

        return $rows;
    }

    private function parseDateTime(mixed $value): ?string
    {
        if (is_numeric($value)) {
            try {
                return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d H:i:s');
            } catch (\Throwable $e) {
                return null;
            }
        }

        $stringValue = trim((string) $value);
        if ($stringValue === '') {
            return null;
        }

        $formats = ['Y-m-d H:i:s', 'Y-m-d H:i'];

        foreach ($formats as $format) {
            try {
                $parsed = Carbon::createFromFormat($format, $stringValue);

                if ($parsed !== false) {
                    return $parsed->format('Y-m-d H:i:s');
                }
            } catch (\Throwable $e) {
            }
        }

        try {
            return Carbon::parse($stringValue)->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
        }

        return null;
    }

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $errorInfo = $exception->errorInfo ?? null;

        if (is_array($errorInfo) && count($errorInfo) >= 2) {
            $sqlState   = (string) $errorInfo[0];
            $driverCode = (string) $errorInfo[1];

            // MySQL / MariaDB duplicate entry
            if ($sqlState === '23000' && $driverCode === '1062') {
                return true;
            }

            // PostgreSQL unique violation
            if ($sqlState === '23505') {
                return true;
            }
        }

        // Fallback for drivers that do not reliably populate errorInfo
        $message = strtolower((string) $exception->getMessage());

        return str_contains($message, 'duplicate entry')
            || str_contains($message, 'unique constraint')
            || str_contains($message, 'unique violation');
    }
}
