export const SCHEDULE_WEEK_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

export function getScheduleWeekDayIndex(dayName) {
    return SCHEDULE_WEEK_DAYS.indexOf(dayName);
}

export function getCurrentScheduleWeekDayIndex(date = new Date()) {
    return (date.getDay() + 6) % 7;
}

export function getScheduleDayTimingState(dayName, date = new Date()) {
    const scheduleDayIndex = getScheduleWeekDayIndex(dayName);

    if (scheduleDayIndex === -1) {
        return 'unknown';
    }

    const currentDayIndex = getCurrentScheduleWeekDayIndex(date);

    if (scheduleDayIndex < currentDayIndex) {
        return 'past';
    }

    if (scheduleDayIndex === currentDayIndex) {
        return 'today';
    }

    return 'future';
}
