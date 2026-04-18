import assert from 'node:assert/strict';

import {
    getCurrentScheduleWeekDayIndex,
    getScheduleDayTimingState,
    getScheduleWeekDayIndex,
} from '../resources/js/Utils/scheduleDayStatus.js';

const tests = [
    [
        'schedule week order follows Monday through Sunday',
        () => {
            assert.equal(getScheduleWeekDayIndex('Monday'), 0);
            assert.equal(getScheduleWeekDayIndex('Saturday'), 5);
            assert.equal(getScheduleWeekDayIndex('Sunday'), 6);
        },
    ],
    [
        'browser Sunday index is normalized to the end of the schedule week',
        () => {
            assert.equal(getCurrentScheduleWeekDayIndex(new Date('2026-04-18T12:00:00')), 5);
            assert.equal(getCurrentScheduleWeekDayIndex(new Date('2026-04-19T12:00:00')), 6);
        },
    ],
    [
        'Sunday is treated as future on Saturday and today on Sunday',
        () => {
            const saturday = new Date('2026-04-18T12:00:00');
            const sunday = new Date('2026-04-19T12:00:00');

            assert.equal(getScheduleDayTimingState('Sunday', saturday), 'future');
            assert.equal(getScheduleDayTimingState('Sunday', sunday), 'today');
        },
    ],
    [
        'earlier weekdays remain past days later in the same week',
        () => {
            const tuesday = new Date('2026-04-21T12:00:00');

            assert.equal(getScheduleDayTimingState('Monday', tuesday), 'past');
            assert.equal(getScheduleDayTimingState('Wednesday', tuesday), 'future');
        },
    ],
];

for (const [name, run] of tests) {
    run();
    console.log(`PASS ${name}`);
}
