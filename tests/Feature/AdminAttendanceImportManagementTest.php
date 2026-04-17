<?php

namespace Tests\Feature;

use App\Models\BiometricLog;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\ImportBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\TestCase;

class AdminAttendanceImportManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_delete_an_unsynced_import_batch(): void
    {
        Storage::fake('local');

        $admin = $this->createAdminUser();
        $faculty = $this->createFaculty('BIO-1001');
        $batch = ImportBatch::create([
            'file_name' => 'mistaken-upload.csv',
            'file_path' => 'imports/biometric-logs/mistaken-upload.csv',
            'status' => 'pending',
            'started_at' => now(),
        ]);

        Storage::put($batch->file_path, 'sample');

        $log = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => '2026-03-22 08:00:00',
            'log_type' => 'IN',
            'import_batch_id' => $batch->id,
            'is_processed' => false,
        ]);

        $this->actingAs($admin, 'admin')
            ->deleteJson(route('admin.attendance-imports.destroy', $batch))
            ->assertOk()
            ->assertJson([
                'message' => 'Import batch deleted successfully.',
            ]);

        $this->assertSoftDeleted('import_batches', ['id' => $batch->id]);
        $this->assertSoftDeleted('biometric_logs', ['id' => $log->id]);
        Storage::assertExists($batch->file_path);
    }

    public function test_admin_can_edit_and_delete_unsynced_logs(): void
    {
        $admin = $this->createAdminUser();
        $faculty = $this->createFaculty('BIO-2001');
        $batch = ImportBatch::create([
            'file_name' => 'editable.csv',
            'file_path' => 'imports/biometric-logs/editable.csv',
            'status' => 'pending',
            'started_at' => now(),
            'total_records' => 1,
            'processed_records' => 1,
        ]);

        $log = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => '2026-03-22 08:00:00',
            'log_type' => 'IN',
            'device_id' => 'DEVICE-01',
            'import_batch_id' => $batch->id,
            'is_processed' => false,
        ]);

        $this->actingAs($admin, 'admin')
            ->patchJson(route('admin.attendance-imports.logs.update', ['batch' => $batch->id, 'log' => $log->id]), [
                'biometric_id' => $faculty->biometric_id,
                'log_datetime' => '2026-03-22 17:15',
                'log_type' => 'OUT',
                'device_id' => 'DEVICE-02',
            ])
            ->assertOk()
            ->assertJson([
                'message' => 'Imported log updated successfully.',
            ]);

        $this->assertDatabaseHas('biometric_logs', [
            'id' => $log->id,
            'log_datetime' => '2026-03-22 17:15:00',
            'log_type' => 'OUT',
            'device_id' => 'DEVICE-02',
        ]);

        $this->actingAs($admin, 'admin')
            ->deleteJson(route('admin.attendance-imports.logs.destroy', ['batch' => $batch->id, 'log' => $log->id]))
            ->assertOk()
            ->assertJson([
                'message' => 'Imported log deleted successfully.',
            ]);

        $this->assertSoftDeleted('biometric_logs', ['id' => $log->id]);
        $this->assertSame(0, (int) $batch->fresh()->total_records);
    }

    public function test_synced_logs_and_batches_cannot_be_modified_or_deleted(): void
    {
        Storage::fake('local');

        $admin = $this->createAdminUser();
        $faculty = $this->createFaculty('BIO-3001');
        $batch = ImportBatch::create([
            'file_name' => 'synced.csv',
            'file_path' => 'imports/biometric-logs/synced.csv',
            'status' => 'completed',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        Storage::put($batch->file_path, 'sample');

        $log = BiometricLog::create([
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => '2026-03-22 08:00:00',
            'log_type' => 'IN',
            'import_batch_id' => $batch->id,
            'is_processed' => true,
        ]);

        $this->actingAs($admin, 'admin')
            ->patchJson(route('admin.attendance-imports.logs.update', ['batch' => $batch->id, 'log' => $log->id]), [
                'biometric_id' => $faculty->biometric_id,
                'log_datetime' => '2026-03-22 08:30',
                'log_type' => 'IN',
            ])
            ->assertStatus(409);

        $this->actingAs($admin, 'admin')
            ->deleteJson(route('admin.attendance-imports.logs.destroy', ['batch' => $batch->id, 'log' => $log->id]))
            ->assertStatus(409);

        $this->actingAs($admin, 'admin')
            ->deleteJson(route('admin.attendance-imports.destroy', $batch))
            ->assertStatus(409);

        $this->assertDatabaseHas('biometric_logs', ['id' => $log->id]);
        $this->assertDatabaseHas('import_batches', ['id' => $batch->id]);
        Storage::assertExists($batch->file_path);
    }

    public function test_admin_can_import_excel_standard_datetime_cells_from_xlsx(): void
    {
        Storage::fake('local');

        $admin = $this->createAdminUser();
        $faculty = $this->createFaculty('BIO-4001');
        $upload = $this->makeSpreadsheetUpload([
            ['BIO-4001', ExcelDate::PHPToExcel(new \DateTimeImmutable('2026-04-01 08:02:00')), 'IN', 'DEVICE-01'],
        ], true);

        $this->actingAs($admin, 'admin')
            ->post(route('admin.attendance-imports.store'), [
                'file' => $upload,
            ])
            ->assertRedirect(route('admin.attendance-imports.index'));

        $this->assertDatabaseHas('biometric_logs', [
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => '2026-04-01 08:02:00',
            'log_type' => 'IN',
            'device_id' => 'DEVICE-01',
        ]);
    }

    public function test_admin_can_import_excel_datetime_strings_with_meridiem_mismatch(): void
    {
        Storage::fake('local');

        $admin = $this->createAdminUser();
        $faculty = $this->createFaculty('BIO-5001');
        $upload = $this->makeSpreadsheetUpload([
            ['BIO-5001', '3/24/2026 15:31:15 PM', 'OUT', 'DEVICE-03'],
        ]);

        $this->actingAs($admin, 'admin')
            ->post(route('admin.attendance-imports.store'), [
                'file' => $upload,
            ])
            ->assertRedirect(route('admin.attendance-imports.index'));

        $this->assertDatabaseHas('biometric_logs', [
            'biometric_id' => $faculty->biometric_id,
            'log_datetime' => '2026-03-24 15:31:15',
            'log_type' => 'OUT',
            'device_id' => 'DEVICE-03',
        ]);
    }

    public function test_downloaded_template_uses_excel_datetime_cells_for_sample_logs(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin, 'admin')
            ->get(route('admin.attendance-imports.template'));

        $response->assertOk();

        $binaryResponse = $response->baseResponse;
        $this->assertInstanceOf(BinaryFileResponse::class, $binaryResponse);

        $downloadedFile = $binaryResponse->getFile();
        $this->assertNotNull($downloadedFile);

        $spreadsheet = IOFactory::load($downloadedFile->getPathname());
        $sheet = $spreadsheet->getActiveSheet();

        $this->assertSame('log_datetime', $sheet->getCell('B9')->getValue());
        $this->assertIsNumeric($sheet->getCell('B10')->getValue());
        $this->assertSame('m/d/yyyy h:mm', $sheet->getStyle('B10')->getNumberFormat()->getFormatCode());

        $spreadsheet->disconnectWorksheets();
    }

    private function createAdminUser(): User
    {
        return User::create([
            'username' => 'admin.user',
            'email' => 'admin@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);
    }

    private function createFaculty(string $biometricId): Faculty
    {
        $department = Department::factory()->create();
        $user = User::create([
            'username' => 'faculty.'.strtolower(str_replace('-', '', $biometricId)),
            'email' => strtolower($biometricId).'@example.com',
            'password' => 'password',
            'is_active' => true,
        ]);

        return Faculty::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'faculty_code' => 'FC'.substr(preg_replace('/\D/', '', $biometricId), -4),
            'biometric_id' => $biometricId,
            'first_name' => 'Test',
            'last_name' => 'Faculty',
            'is_active' => true,
        ]);
    }

    private function makeSpreadsheetUpload(array $rows, bool $formatDateColumnAsExcelDate = false): UploadedFile
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $sheet->fromArray([
            ['Attendance Log Import Template'],
            ['Purpose: Test spreadsheet upload.'],
            ['Fill one log entry per row starting at row 10.'],
            [],
            ['Column', 'Purpose / Format'],
            ['biometric_id', 'Required'],
            ['log_datetime', 'Required'],
            ['log_type', 'Required'],
            ['biometric_id', 'log_datetime', 'log_type', 'device_id'],
        ], null, 'A1');

        foreach ($rows as $index => $row) {
            $rowNumber = 10 + $index;
            $sheet->setCellValue("A{$rowNumber}", $row[0]);
            $sheet->setCellValue("B{$rowNumber}", $row[1]);

            if ($formatDateColumnAsExcelDate) {
                $sheet->getStyle("B{$rowNumber}")->getNumberFormat()->setFormatCode('m/d/yyyy h:mm');
            }

            $sheet->setCellValue("C{$rowNumber}", $row[2]);
            $sheet->setCellValue("D{$rowNumber}", $row[3]);
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'attendance-import-test-').'.xlsx';
        (new Xlsx($spreadsheet))->save($tempPath);
        $spreadsheet->disconnectWorksheets();

        return new UploadedFile(
            $tempPath,
            'attendance-import.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );
    }
}
