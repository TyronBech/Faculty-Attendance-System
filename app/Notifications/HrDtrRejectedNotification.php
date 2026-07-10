<?php

namespace App\Notifications;

use App\Models\HrDtrStatus;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class HrDtrRejectedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly HrDtrStatus $hrDtrStatus,
        private readonly string $recipientType,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $record = $this->hrDtrStatus->dtrRecord;
        $faculty = $record?->faculty;
        $period = $this->periodLabel();

        return [
            'type' => 'hr_dtr_rejected',
            'title' => 'DTR rejected',
            'message' => $this->recipientType === 'faculty'
                ? "Your DTR for {$period} was rejected by HR."
                : ($faculty?->full_name ?? 'A faculty member')."'s DTR for {$period} was rejected.",
            'faculty_id' => $faculty?->id,
            'faculty_name' => $faculty?->full_name,
            'hr_dtr_status_id' => $this->hrDtrStatus->id,
            'dtr_record_id' => $record?->id,
            'period' => $period,
            'period_start' => $this->hrDtrStatus->period_start?->toDateString(),
            'period_end' => $this->hrDtrStatus->period_end?->toDateString(),
            'url' => $this->recipientType === 'faculty'
                ? route('faculty.dtr.index')
                : route('admin.hr.dtrs.index', ['status' => 'rejected']),
        ];
    }

    private function periodLabel(): string
    {
        if ($this->hrDtrStatus->period_start && $this->hrDtrStatus->period_end) {
            return $this->hrDtrStatus->period_start->format('M j').' - '.$this->hrDtrStatus->period_end->format('M j, Y');
        }

        $record = $this->hrDtrStatus->dtrRecord;

        return $record
            ? Carbon::create($record->year, $record->month, 1)->format('F Y')
            : 'the selected period';
    }
}
