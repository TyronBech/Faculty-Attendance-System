<?php

namespace App\Http\Controllers\Faculty;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\Holiday;
use App\Models\AttendanceRecord;
use App\Models\OnlineAttendanceRequest;
use App\Models\ScheduleChangeRequest;
use App\Models\ScheduleDetail;
use App\Services\AttendanceReconciliationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FacultyDashboardController extends Controller
{
    /**
     * Display the faculty dashboard.
     *
     * The controller stays thin — all data logic lives in the Faculty model.
     */
    public function index(Request $request, AttendanceReconciliationService $service)
    {
        /** @var Faculty|null $faculty */
        $faculty = $request->user()->faculty;

        // Fallback for users without a faculty profile
        if (!$faculty) {
            return Inertia::render('Faculty/Dashboard', [
                'stats' => [],
                'todaySchedule' => [],
                'recentAttendance' => [],
                'checkInTrend' => [],
                'monthlyAverages' => ['avgCheckIn' => '--:--', 'avgCheckOut' => '--:--'],
                'currentDate' => Carbon::now()->format('l, F j, Y'),
                'greeting' => $this->getGreeting(),
            ]);
        }

        // Determine trend range (months)
        $range = $request->query('range', 'Last 6 months');
        $months = 6;

        switch ($range) {
            case 'Last 3 months':
                $months = 3;
                break;
            case 'Last 12 months':
                $months = 12;
                break;
            case 'This Year':
                $months = (int) Carbon::now()->month;
                break;
            default:
                $months = 6;
                break;
        }

        // Fetch the 20 most recent actual attendance records directly from the table based on internal schedule logic
        $recentAttendance = $faculty->getRecentAttendance(20);

        return Inertia::render('Faculty/Dashboard', [
            'stats' => $faculty->getDashboardStats(),
            'todaySchedule' => $faculty->getTodayScheduleDetails(),
            'recentAttendance' => $recentAttendance,
            'checkInTrend' => $faculty->getCheckInTrend($months),
            'monthlyAverages' => $faculty->getMonthlyAverages(),
            'currentDate' => Carbon::now()->format('l, F j, Y'),
            'greeting' => $this->getGreeting(),
            'filters' => [
                'range' => $range
            ]
        ]);
    }

    /**
     * AJAX endpoint for dashboard analytics.
     */
    public function getAnalyticsData(Request $request)
    {
        $faculty = $request->user()->faculty;
        if (!$faculty)
            return response()->json([], 404);

        $range = $request->query('range', 'Last 6 months');
        $months = match ($range) {
            'Last 3 months' => 3,
            'Last 12 months' => 12,
            'This Year' => (int) Carbon::now()->month,
            default => 6,
        };

        return response()->json([
            'checkInTrend' => $faculty->getCheckInTrend($months),
            'monthlyAverages' => $faculty->getMonthlyAverages(),
        ]);
    }

    /**
     * Display the full biometric logs page.
     */


    /**
     * Display the schedule & attendance page.
     */
    public function schedule(Request $request)
    {
        $faculty = $request->user()->faculty;

        if (!$faculty) {
            return Inertia::render('Faculty/Schedule', [
                'weeklySchedule' => [],
                'internalSchedule' => [],
                'facultyName' => '',
            ]);
        }

        return Inertia::render('Faculty/Schedule', [
            'weeklySchedule' => $faculty->getWeeklySchedule(),
            'internalSchedule' => $faculty->getWeeklyInternalSchedule(),
            'facultyName' => $faculty->full_name,
        ]);
    }

    /**
     * Display the new matched attendance page.
     * Evaluates attendance records dynamically using the service.
     */
    public function attendance(Request $request)
    {
        $faculty = $request->user()->faculty;

        $attendanceLogs = [];

        if ($faculty) {
            $records = AttendanceRecord::where('faculty_id', $faculty->id)
                ->with(['scheduleDetail', 'justifications'])
                ->orderBy('attendance_date', 'desc')
                ->get();

            // Get all approved online attendance requests for this faculty
            $onlineRequests = OnlineAttendanceRequest::where('faculty_id', $faculty->id)
                ->where('status', 'approved')
                ->with('scheduleDetail')
                ->get();

            // Create indexes for matching
            $onlineByDateAndSchedule = $onlineRequests->keyBy(fn($req) => $req->attendance_date->toDateString() . '-' . ($req->schedule_detail_id ?? ''));
            $onlineByDate = $onlineRequests->keyBy(fn($req) => $req->attendance_date->toDateString());
            
            // Get all approved schedule change requests to handle moved classes
            $approvedChangeRequests = ScheduleChangeRequest::where('faculty_id', $faculty->id)
                ->where('status', 'approved')
                ->with('scheduleDetail')
                ->get();

            $matchedOnlineIds = [];
            
            // Get all active schedules and their details to map subjects to internal blocks
            $activeSchedules = $faculty->schedules()->where('status', 'active')->get();
            $activeScheduleIds = $activeSchedules->pluck('id');
            $allDetails = ScheduleDetail::whereIn('schedule_id', $activeScheduleIds)->get();
            $detailsByScheduleAndDay = $allDetails->groupBy(fn($d) => $d->schedule_id . '-' . $d->day);
            $holidays = Holiday::all();

            $attendanceLogs = $records->map(function ($record) use ($onlineByDateAndSchedule, $onlineByDate, &$matchedOnlineIds, $approvedChangeRequests, $detailsByScheduleAndDay, $holidays) {
                $detail = $record->scheduleDetail;
                $date = $record->attendance_date;
                $dayName = $date->format('l');

                // Check if there's an approved online attendance request for this record
                $scheduleDetailId = $record->schedule_detail_id ?? $detail?->id ?? '';
                $dateStr = $date->toDateString();
                
                // Try matching by date+schedule_detail_id first, then by date only
                $onlineRequest = $onlineByDateAndSchedule->get($dateStr . '-' . $scheduleDetailId) 
                    ?? $onlineByDate->get($dateStr);
                    
                if ($onlineRequest) {
                    $matchedOnlineIds[] = $onlineRequest->id;
                }

                // Build subjects array from the linked schedule detail or online request
                $subjects = [];
                $resolvedDetail = $detail ?: ($onlineRequest ? $onlineRequest->scheduleDetail : null);

                if ($resolvedDetail && ($resolvedDetail->course_code || $resolvedDetail->subject_desc)) {
                    $subjects[] = [
                        'code' => $resolvedDetail->course_code ?? '',
                        'desc' => (trim($resolvedDetail->subject_desc) !== '') ? $resolvedDetail->subject_desc : 'Operational Duty',
                        'program_code' => $resolvedDetail->program_code,
                        'year_level' => $resolvedDetail->year_level,
                        'section_name' => $resolvedDetail->section_name,
                    ];
                } 

                // If subjects are still empty, try matching based on the date and faculty's internal schedule mapping
                if (empty($subjects)) {
                    // Try to find matching official subjects for this day and time
                    // 1. Check for staying official details (not moved away) that match the attendance record's time
                    $foundMatch = false;
                    foreach ($detailsByScheduleAndDay as $key => $todayDetails) {
                        [$sId, $dDay] = explode('-', $key);
                        if ($dDay !== $dayName) continue;

                        $staying = $todayDetails->reject(function ($d) use ($approvedChangeRequests) {
                            return $approvedChangeRequests->contains('schedule_detail_id', $d->id);
                        });

                        // Match by time: find a schedule detail whose time overlaps with the attendance record
                        foreach ($staying as $d) {
                            // Only add if times match or no specific time is recorded
                            $timeMatches = true;
                            if ($record->operational_time_in && $record->operational_time_out && $d->start_time && $d->end_time) {
                                // Check if the schedule detail time overlaps with the attendance record's operational time
                                $timeMatches = !($record->operational_time_out <= $d->start_time || $record->operational_time_in >= $d->end_time);
                            }

                            if ($timeMatches) {
                                $subjects[] = [
                                    'code' => $d->course_code ?? '',
                                    'desc' => $d->subject_desc ?: 'Operational Duty',
                                    'program_code' => $d->program_code,
                                    'year_level' => $d->year_level,
                                    'section_name' => $d->section_name,
                                ];
                                $foundMatch = true;
                                break; // Only add the first matching subject for this day
                            }
                        }
                        
                        if ($foundMatch) break; // Stop searching if we found a match
                    }

                    // 2. Check for classes moved INTO this day (if no match found yet)
                    if (!$foundMatch) {
                        $movedIn = $approvedChangeRequests->filter(function ($req) use ($dayName) {
                            return $req->requested_day_of_week === $dayName;
                        });

                        foreach ($movedIn as $req) {
                            $d = $req->scheduleDetail;
                            if ($d) {
                                // Check time match for moved classes too
                                $timeMatches = true;
                                if ($record->operational_time_in && $record->operational_time_out && $d->start_time && $d->end_time) {
                                    $timeMatches = !($record->operational_time_out <= $d->start_time || $record->operational_time_in >= $d->end_time);
                                }

                                if ($timeMatches) {
                                    $subjects[] = [
                                        'code' => $d->course_code ?? '',
                                        'desc' => $d->subject_desc ?: 'Operational Duty',
                                        'program_code' => $d->program_code,
                                        'year_level' => $d->year_level,
                                        'section_name' => $d->section_name,
                                    ];
                                    $foundMatch = true;
                                    break; // Only add the first matching subject
                                }
                            }
                        }
                    }
                }

                // Final fallback if absolutely no subjects were found for this day
                if (empty($subjects)) {
                    $subjects[] = [
                        'code' => '',
                        'desc' => 'Operational Duty',
                        'program_code' => null,
                        'year_level' => null,
                        'section_name' => null,
                    ];
                }

                // Format hours rendered
                $totalMinutes = (int) round((float) $record->total_hours_rendered * 60);
                $hours = intdiv($totalMinutes, 60);
                $mins = $totalMinutes % 60;
                $totalHours = ($hours > 0 ? $hours . 'h ' : '') . $mins . 'm';

                // Find undertime justification if any
                $undertimeJustification = $record->justifications
                    ->where('type', 'undertime')
                    ->first();

                $missingTimeJustification = $record->justifications
                    ->where('type', 'missing_time')
                    ->first();

                // Holiday check
                $isHoliday = $holidays->contains(function ($h) use ($date) {
                    if ($h->is_recurring) {
                        return $h->holiday_date->format('n') === $date->format('n') && $h->holiday_date->format('j') === $date->format('j');
                    }
                    return $h->holiday_date->toDateString() === $date->toDateString();
                });

                // Calculate undertime minutes on the fly for UI consistency if DB column is out of sync
                $undertimeMinutes = $isHoliday ? 0 : ($record->undertime_minutes ?? 0);
                if (!$isHoliday && $record->actual_time_out && $record->operational_time_out && $undertimeMinutes == 0) {
                    if ($record->actual_time_out->lt($record->operational_time_out)) {
                        $undertimeMinutes = $record->actual_time_out->diffInMinutes($record->operational_time_out);
                    }
                }

                // Dynamically adjust status for UI consistency if DB status is out of sync
                $displayStatus = $record->status;
                $hasActualTimeIn = $record->actual_time_in !== null;

                // Override display status for holidays
                if ($isHoliday) {
                    $displayStatus = $hasActualTimeIn ? 'Holiday Present' : 'Holiday';
                }

                $isUndertime = ($undertimeMinutes > 0 && $record->actual_time_out !== null);
                $isOvertime = ($record->overtime_minutes > 0 && $record->actual_time_out !== null);

                // If no actual time-in, set to Absent (unless it's already Holiday or No Schedule)
                if (!$hasActualTimeIn && !in_array(strtolower($displayStatus), ['holiday', 'no schedule', 'holiday present'])) {
                    $displayStatus = 'Absent';
                } elseif ($hasActualTimeIn && ($isUndertime || $isOvertime) && !$isHoliday) {
                    // Override status if has actual time-in and has undertime or overtime
                    if ($isUndertime && $isOvertime) {
                        $displayStatus = 'UNDERTIME / OVERTIME';
                    } elseif ($isUndertime) {
                        $displayStatus = 'UNDERTIME';
                    } elseif ($isOvertime) {
                        $displayStatus = 'OVERTIME';
                    }
                }

                // Use online attendance time if available
                $actualTimeIn = $record->actual_time_in;
                $actualTimeOut = $record->actual_time_out;
                $isOnlineAttendance = false;

                if ($onlineRequest) {
                    $isOnlineAttendance = true;
                    if ($onlineRequest->time_in) {
                        $actualTimeIn = Carbon::parse($onlineRequest->time_in);
                    }
                    if ($onlineRequest->time_out) {
                        $actualTimeOut = Carbon::parse($onlineRequest->time_out);
                    }
                }

                return [
                    'id' => $record->id,
                    'date' => $record->attendance_date->format('M d, Y'),
                    'raw_date' => $record->attendance_date->toDateString(),
                    'dayOfWeek' => $record->attendance_date->format('l'),
                    'status' => $displayStatus,
                    'expected_time_in' => $record->operational_time_in
                        ? $record->operational_time_in->format('h:i A')
                        : ($record->official_time_in ? Carbon::parse($record->official_time_in)->format('h:i A') : '--:--'),
                    'expected_time_out' => $record->operational_time_out
                        ? $record->operational_time_out->format('h:i A')
                        : ($record->official_time_out ? Carbon::parse($record->official_time_out)->format('h:i A') : '--:--'),
                    'actual_time_in' => $actualTimeIn
                        ? $actualTimeIn->format('h:i A') : '--:--',
                    'actual_time_out' => $actualTimeOut
                        ? $actualTimeOut->format('h:i A') : '--:--',
                    'late_minutes' => $isHoliday ? 0 : ($record->late_minutes ?? 0),
                    'undertime_minutes' => (int) $undertimeMinutes,
                    'undertime_justification' => $undertimeJustification?->justification,
                    'undertime_status' => $undertimeJustification?->status,
                    'missing_time_justification' => $missingTimeJustification?->justification,
                    'missing_time_status' => $missingTimeJustification?->status,
                    'updated_at' => ($undertimeJustification || $missingTimeJustification)
                        ? ($undertimeJustification?->updated_at ?? $missingTimeJustification->updated_at)->toIso8601String()
                        : ($record->updated_at ? $record->updated_at->toIso8601String() : null),
                    'overtime_minutes' => $isHoliday ? 0 : ($record->overtime_minutes ?? 0),
                    'night_minutes' => $record->night_minutes ?? 0,
                    'overtime_night_minutes' => $record->overtime_night_minutes ?? 0,
                    'required_hours' => ($isHoliday) ? 0 : (($record->required_hours <= 0 && $record->operational_time_out && $record->operational_time_in)
                        ? (float) max(0, (int) round($record->operational_time_out->diffInMinutes($record->operational_time_in) / 60))
                        : (float) $record->required_hours),
                    'total_hours' => $totalHours,
                    'online_attendance' => $isOnlineAttendance,
                    'is_holiday' => $isHoliday,
                    'subjects' => $subjects,
                ];
            })->toArray();
            
            // Add unmatched approved online attendance requests
            $unmatchedOnline = $onlineRequests->filter(fn($req) => !in_array($req->id, $matchedOnlineIds));
            
            $onlineOnlyLogs = $unmatchedOnline->map(function ($req) {
                $detail = $req->scheduleDetail;
                $subjects = ($detail && ($detail->course_code || $detail->subject_desc)) ? [[
                    'code' => $detail->course_code ?? '',
                    'desc' => (trim($detail->subject_desc) !== '') ? $detail->subject_desc : 'Operational Duty',
                    'program_code' => $detail->program_code ?? null,
                    'year_level' => $detail->year_level ?? null,
                    'section_name' => $detail->section_name ?? null,
                ]] : [[
                    'code' => '',
                    'desc' => 'Operational Duty',
                    'program_code' => null,
                    'year_level' => null,
                    'section_name' => null,
                ]];
                
                $timeIn = $req->time_in ? Carbon::parse($req->time_in) : null;
                $timeOut = $req->time_out ? Carbon::parse($req->time_out) : null;
                $hours = 0;
                if ($timeIn && $timeOut) {
                    $hours = round($timeIn->diffInMinutes($timeOut) / 60, 2);
                }
                $totalMinutes = (int) round($hours * 60);
                $h = intdiv($totalMinutes, 60);
                $m = $totalMinutes % 60;
                $totalHours = ($h > 0 ? $h . 'h ' : '') . $m . 'm';
                
                return [
                    'id' => 'online-' . $req->id,
                    'date' => $req->attendance_date->format('M d, Y'),
                    'raw_date' => $req->attendance_date->toDateString(),
                    'dayOfWeek' => $req->attendance_date->format('l'),
                    'status' => 'Present (Online)',
                    'expected_time_in' => $detail && $detail->start_time 
                        ? Carbon::parse($detail->start_time)->format('h:i A') 
                        : '--:--',
                    'expected_time_out' => $detail && $detail->end_time 
                        ? Carbon::parse($detail->end_time)->format('h:i A') 
                        : '--:--',
                    'actual_time_in' => $timeIn ? $timeIn->format('h:i A') : '--:--',
                    'actual_time_out' => $timeOut ? $timeOut->format('h:i A') : '--:--',
                    'late_minutes' => 0,
                    'undertime_minutes' => 0,
                    'undertime_justification' => null,
                    'undertime_status' => null,
                    'missing_time_justification' => null,
                    'missing_time_status' => null,
                    'updated_at' => $req->updated_at ? $req->updated_at->toIso8601String() : null,
                    'overtime_minutes' => 0,
                    'night_minutes' => 0,
                    'overtime_night_minutes' => 0,
                    'required_hours' => (float) $hours,
                    'total_hours' => $totalHours,
                    'online_attendance' => true,
                    'subjects' => $subjects,
                ];
            })->toArray();
            
            $attendanceLogs = array_merge($attendanceLogs, $onlineOnlyLogs);
        }

        return Inertia::render('Faculty/Attendance', [
            'attendanceLogs' => $attendanceLogs,
        ]);
    }

    /**
     * Return a time-aware greeting string.
     */
    private function getGreeting(): string
    {
        $hour = Carbon::now()->hour;

        if ($hour < 12) {
            return 'Good Morning';
        } elseif ($hour < 17) {
            return 'Good Afternoon';
        }

        return 'Good Evening';
    }

    /**
     * Submit undertime justification.
     */
    public function submitUndertimeJustification(Request $request, $id)
    {
        $request->validate([
            'justification' => 'required|string|max:1000',
        ]);

        $faculty = $request->user()->faculty;
        if (!$faculty)
            abort(403);

        $record = \App\Models\AttendanceRecord::where('faculty_id', $faculty->id)
            ->findOrFail($id);

        // Check if there is actually undertime (dynamically check if DB is out of sync)
        $hasUndertime = ($record->undertime_minutes > 0);
        if (!$hasUndertime && $record->actual_time_out && $record->operational_time_out) {
            $hasUndertime = $record->actual_time_out->lt($record->operational_time_out);
        }

        if (!$hasUndertime) {
            return back()->with('error', 'No undertime to justify for this record.');
        }

        $justification = $record->justifications()
            ->where('type', 'undertime')
            ->first();

        if ($justification && in_array($justification->status, ['approved', 'rejected'])) {
            return back()->with('error', 'Cannot edit a justification that has already been reviewed.');
        }

        $isUpdate = $justification && $justification->status === 'pending';

        if ($isUpdate && $justification->updated_at) {
            $diffInMinutes = now()->diffInMinutes($justification->updated_at);
            if ($diffInMinutes > 15) {
                return back()->with('error', 'The 15-minute window to edit this justification has expired.');
            }
        }

        $record->justifications()->updateOrCreate(
            ['type' => 'undertime'],
            [
                'faculty_id' => $faculty->id,
                'justification' => $request->justification,
                'status' => 'pending',
            ]
        );

        return back()->with('success', $isUpdate ? 'Justification updated successfully.' : 'Justification submitted. Pending approval from Head.');
    }

    /**
     * Submit missing time justification.
     */
    public function submitMissingTimeJustification(Request $request, $id)
    {
        $request->validate([
            'justification' => 'required|string|max:1000',
        ]);

        $faculty = $request->user()->faculty;
        if (!$faculty)
            abort(403);

        $record = \App\Models\AttendanceRecord::where('faculty_id', $faculty->id)
            ->findOrFail($id);

        // Check if there is actually a missing time in or out
        $isMissing = !$record->actual_time_in || !$record->actual_time_out
            || $record->actual_time_in->format('H:i:s') === '00:00:00' // Assuming --:-- might be stored as midnight in some cases, but actually controller shows format check
        ;

        // Re-check based on what we send to frontend
        $actualIn = $record->actual_time_in ? $record->actual_time_in->format('h:i A') : '--:--';
        $actualOut = $record->actual_time_out ? $record->actual_time_out->format('h:i A') : '--:--';
        $isMissing = ($actualIn === '--:--' || $actualOut === '--:--');

        if (!$isMissing) {
            return back()->with('error', 'No missing time in or out to justify for this record.');
        }

        $justification = $record->justifications()
            ->where('type', 'missing_time')
            ->first();

        if ($justification && in_array($justification->status, ['approved', 'rejected'])) {
            return back()->with('error', 'Cannot edit a justification that has already been reviewed.');
        }

        $isUpdate = $justification && $justification->status === 'pending';

        if ($isUpdate && $justification->updated_at) {
            $diffInMinutes = now()->diffInMinutes($justification->updated_at);
            if ($diffInMinutes > 15) {
                return back()->with('error', 'The 15-minute window to edit this justification has expired.');
            }
        }

        $record->justifications()->updateOrCreate(
            ['type' => 'missing_time'],
            [
                'faculty_id' => $faculty->id,
                'justification' => $request->justification,
                'status' => 'pending',
            ]
        );

        return back()->with('success', $isUpdate ? 'Justification updated successfully.' : 'Justification submitted. Pending approval from Head.');
    }
}
