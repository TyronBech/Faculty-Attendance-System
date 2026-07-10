<?php

namespace App\Services;

use App\Models\Faculty;
use App\Models\User;
use App\Notifications\HrDtrCutoffReminderNotification;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class HrDtrCutoffReminderService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function upcomingReminders(?Carbon $date = null): array
    {
        $today = ($date ?? Carbon::now())->copy()->startOfDay();

        return collect([7, 3])
            ->flatMap(fn (int $daysBefore): Collection => $this->cutoffDatesForReminder($today, $daysBefore)
                ->map(fn (Carbon $cutoffDate): array => [
                    'title' => 'DTR cutoff reminder',
                    'message' => "Your DTR cutoff is in {$daysBefore} days ({$cutoffDate->format('F j, Y')}). Please review your attendance before HR processing.",
                    'cutoffDate' => $cutoffDate->toDateString(),
                    'cutoffLabel' => $cutoffDate->format('F j, Y'),
                    'daysBefore' => $daysBefore,
                ]))
            ->values()
            ->all();
    }

    /**
     * @return array{faculty_notified: int, admin_notified: int}
     */
    public function sendDueReminders(?Carbon $date = null): array
    {
        $today = ($date ?? Carbon::now())->copy()->startOfDay();
        $summary = [
            'faculty_notified' => 0,
            'admin_notified' => 0,
        ];

        foreach ([7, 3] as $daysBefore) {
            foreach ($this->cutoffDatesForReminder($today, $daysBefore) as $cutoffDate) {
                $facultyUsers = Faculty::query()
                    ->where('is_active', true)
                    ->whereNotNull('user_id')
                    ->with('user:id,email,username')
                    ->get()
                    ->pluck('user')
                    ->filter()
                    ->reject(fn (User $user): bool => $this->alreadyNotified($user, $cutoffDate, $daysBefore, 'faculty'))
                    ->values();

                $adminUsers = User::role(['super_admin', 'admin', 'hr_admin', 'hr_staff'], 'admin')
                    ->get()
                    ->reject(fn (User $user): bool => $this->alreadyNotified($user, $cutoffDate, $daysBefore, 'admin'))
                    ->values();

                Notification::send(
                    $facultyUsers,
                    new HrDtrCutoffReminderNotification($cutoffDate, $daysBefore, 'faculty')
                );
                Notification::send(
                    $adminUsers,
                    new HrDtrCutoffReminderNotification($cutoffDate, $daysBefore, 'admin')
                );

                $summary['faculty_notified'] += $facultyUsers->count();
                $summary['admin_notified'] += $adminUsers->count();
            }
        }

        return $summary;
    }

    /**
     * @return Collection<int, Carbon>
     */
    private function cutoffDatesForReminder(Carbon $today, int $daysBefore): Collection
    {
        $targetDate = $today->copy()->addDays($daysBefore);
        $daysInMonth = $targetDate->daysInMonth;
        $cutoffDays = collect(HrDtrSyncService::syncDays())
            ->map(fn (int $day): int => min($day, $daysInMonth))
            ->unique()
            ->values();

        if (! $cutoffDays->contains($targetDate->day)) {
            return collect();
        }

        return collect([$targetDate]);
    }

    private function alreadyNotified(User $user, Carbon $cutoffDate, int $daysBefore, string $recipientType): bool
    {
        return $user->notifications()
            ->where('type', HrDtrCutoffReminderNotification::class)
            ->where('data->cutoff_date', $cutoffDate->toDateString())
            ->where('data->days_before', $daysBefore)
            ->where('data->recipient_type', $recipientType)
            ->exists();
    }
}
