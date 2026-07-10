<?php

namespace App\Notifications;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class HrDtrCutoffReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Carbon $cutoffDate,
        private readonly int $daysBefore,
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
        $cutoffLabel = $this->cutoffDate->format('F j, Y');
        $when = $this->daysBefore === 1 ? 'tomorrow' : "in {$this->daysBefore} days";

        return [
            'type' => 'hr_dtr_cutoff_reminder',
            'title' => 'DTR cutoff reminder',
            'message' => $this->recipientType === 'faculty'
                ? "Your DTR cutoff is {$when} ({$cutoffLabel}). Please review your attendance before HR processing."
                : "HR DTR cutoff is {$when} ({$cutoffLabel}). Pending DTRs will be prepared for review.",
            'cutoff_date' => $this->cutoffDate->toDateString(),
            'days_before' => $this->daysBefore,
            'recipient_type' => $this->recipientType,
            'url' => $this->recipientType === 'faculty'
                ? route('faculty.dashboard')
                : route('admin.hr.dashboard'),
        ];
    }
}
