import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { formatHours } from '@/Utils/formatHours';

const ROW_STYLES = {
    course: {
        panel: 'bg-white/95 dark:bg-gray-800/65',
        heading: 'text-gray-500 dark:text-gray-400',
    },
    official: {
        labelText: 'text-emerald-700 dark:text-emerald-300',
        panel: 'bg-slate-50/60 dark:bg-slate-950/15',
    },
    internal: {
        labelText: 'text-amber-700 dark:text-amber-300',
        panel: 'bg-slate-50/35 dark:bg-slate-950/10',
    },
};

const DAYS_MAP = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
};

const sortByDayAndTime = (a, b, daysArr, toMin) => {
    const dayDifference = daysArr.indexOf(a.day) - daysArr.indexOf(b.day);

    if (dayDifference !== 0) {
        return dayDifference;
    }

    return toMin(a.startTime) - toMin(b.startTime);
};

const ACTIVE_STYLES = {
    official: 'bg-emerald-200 dark:bg-emerald-500/40 ring-2 ring-emerald-500/70',
    internal: 'bg-emerald-200 dark:bg-emerald-500/40 ring-2 ring-emerald-500/70',
};

const EMPTY_SLOT_COPY = {
    official: {
        message: 'Internal schedule is currently active.',
        hint: 'No official baseline is linked to this entry.',
    },
    internal: {
        message: 'Official schedule is currently active.',
        hint: 'No internal adjustments.',
    },
};

const CourseCell = ({ item }) => {
    const yearSection = [item.yearLevel, item.sectionName].filter(Boolean).join('-');
    const programSectionLabel = [item.programCode, yearSection].filter(Boolean).join(' ');

    return (
        <div className={`flex h-full min-h-[124px] flex-col items-center justify-center gap-3 px-5 py-4 text-center ${ROW_STYLES.course.panel}`}>
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] lg:hidden ${ROW_STYLES.course.heading}`}>
                Course
            </p>
            {item.code && (
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    {item.code}
                </p>
            )}
            <h3 className="text-[15px] font-semibold leading-6 text-gray-900 dark:text-white">
                {item.subject || 'Operational Duty'}
            </h3>
            {programSectionLabel && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {programSectionLabel}
                </p>
            )}
        </div>
    );
};

const EmptyScheduleSlot = ({ title, variant, isPastDay }) => {
    const copy = EMPTY_SLOT_COPY[variant];

    return (
        <div className={`flex h-full min-h-[124px] flex-col items-center justify-center gap-3 px-5 py-4 ${isPastDay ? 'opacity-50' : ''}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 lg:hidden">
                {title}
            </p>
            <div className="flex h-full items-center justify-center text-center">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {copy.message}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {copy.hint}
                    </p>
                </div>
            </div>
        </div>
    );
};

const ScheduleSlot = ({ item, title, variant, isActive, onClick }) => {
    const [opacity, setOpacity] = useState(1);
    const [isCurrentlyHappening, setIsCurrentlyHappening] = useState(false);

    // Parse time string "HH:MM AM/PM" to minutes since midnight
    const parseTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return null;
        
        // Match time format: "HH:MM AM/PM" or "H:MM AM/PM"
        const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) {
            return null;
        }

        let [, hours, minutes, period] = match;
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);

        // Convert to 24-hour format
        if (period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        }
        if (period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    };

    // Calculate opacity: 0.4 if class is done or past, 1.0 otherwise
    // Also track if class is currently happening
    // Updates every 10 seconds to respond to time changes in real-time
    useEffect(() => {
        const updateStatus = () => {
            if (!item || !item.startTime || !item.endTime) {
                setOpacity(1);
                setIsCurrentlyHappening(false);
                return;
            }

            const now = new Date();
            const currentDayIndex = now.getDay();
            const scheduleDayIndex = DAYS_MAP[item.day] ?? -1;

            // Check if it's a past day of the week
            const isPastDay = scheduleDayIndex !== -1 && scheduleDayIndex < currentDayIndex;

            // Past days: 0.4 opacity
            if (isPastDay) {
                setOpacity(0.4);
                setIsCurrentlyHappening(false);
                return;
            }

            // Today: check if class is happening or has ended
            if (scheduleDayIndex === currentDayIndex) {
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const startMinutes = parseTime(item.startTime);
                const endMinutes = parseTime(item.endTime);

                // If time parsing failed, default to full opacity
                if (startMinutes === null || endMinutes === null) {
                    setOpacity(1);
                    setIsCurrentlyHappening(false);
                    return;
                }

                // Check if class is currently happening (between start and end time)
                const classIsHappening = currentMinutes >= startMinutes && currentMinutes < endMinutes;
                setIsCurrentlyHappening(classIsHappening);

                // Reduce opacity if class has ended
                if (currentMinutes >= endMinutes) {
                    setOpacity(0.4); // Class is done
                } else {
                    setOpacity(1); // Class is ongoing or hasn't started
                }
            } else {
                // Future days: 1.0 opacity
                setOpacity(1);
                setIsCurrentlyHappening(false);
            }
        };

        // Update immediately
        updateStatus();

        // Update every 10 seconds to respond to time changes in real-time
        const interval = setInterval(updateStatus, 10000);

        return () => clearInterval(interval);
    }, [item]);

    // Calculate isPastDay for EmptyScheduleSlot
    const today = new Date();
    const currentDayIndex = today.getDay();
    const scheduleDayIndex = item ? (DAYS_MAP[item.day] ?? -1) : -1;
    const isPastDay = scheduleDayIndex !== -1 && scheduleDayIndex < currentDayIndex;

    if (!item) {
        return <EmptyScheduleSlot title={title} variant={variant} isPastDay={isPastDay} />;
    }

    const roomLabel = item.room || item.comparison?.room || 'TBA';

    return (
        <button
            type="button"
            onClick={() => onClick(item)}
            className={`relative flex h-full min-h-[124px] w-full flex-col items-center justify-center px-5 py-4 text-center transition-all duration-200 hover:brightness-105 ${isActive ? ACTIVE_STYLES[variant] : ROW_STYLES[variant].panel}`}
            style={{ opacity }}
        >
            {/* Active indicator */}
            {isCurrentlyHappening && (
                <div className="absolute right-3 top-3 flex items-center gap-2">
                    <div className="relative h-2 w-2">
                        <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500"></div>
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></div>
                    </div>
                </div>
            )}

            <p className={`text-[11px] font-black uppercase tracking-[0.18em] lg:hidden ${ROW_STYLES[variant].labelText}`}>
                {title}
            </p>

            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {item.day || 'Unscheduled'}
            </p>

            <p className="mt-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                {item.startTime} - {item.endTime}
            </p>

            <div className="mt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Room: <span className="font-semibold text-gray-900 dark:text-white">{roomLabel}</span>
                </p>
            </div>
        </button>
    );
};

const StatCard = ({ icon, label, value }) => {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200/60 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                {icon}
            </div>
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
};

export default function Schedule({ weeklySchedule, internalSchedule, facultyName }) {
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, official, internal
    const [selectedDay, setSelectedDay] = useState('all');

    const handleCardClick = (item) => {
        setSelectedSchedule(item);
    };

    const toMin = (timeValue) => {
        if (!timeValue || timeValue === '--:--') {
            return 9999;
        }

        const [time, period] = timeValue.split(' ');

        if (!time || !period) {
            return 9999;
        }

        let [hours, minutes] = time.split(':').map(Number);

        if (period === 'PM' && hours !== 12) {
            hours += 12;
        }

        if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    };

    const daysArr = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const sortedSchedule = weeklySchedule.map((dayData) => ({
        ...dayData,
        classes: [...dayData.classes].sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
    }));

    const filteredInternalSchedule = (() => {
        const uniqueCourseEntries = new Map();
        const operationalEntries = [];

        internalSchedule.forEach((dayData) => {
            dayData.entries
                .filter((entry) => entry.isApproved)
                .forEach((entry) => {
                    const entryWithDay = { ...entry, day: dayData.day };

                    if (entryWithDay.code) {
                        const key = entryWithDay.originalScheduleDetailId
                            ? `detail-${entryWithDay.originalScheduleDetailId}`
                            : [
                                entryWithDay.day,
                                entryWithDay.code,
                                entryWithDay.sectionName || '',
                                entryWithDay.startTime,
                                entryWithDay.endTime,
                            ].join('|');

                        uniqueCourseEntries.set(key, entryWithDay);
                    } else {
                        operationalEntries.push(entryWithDay);
                    }
                });
        });

        const uniqueEntries = [...uniqueCourseEntries.values(), ...operationalEntries];

        return daysArr.map((day) => ({
            day,
            entries: uniqueEntries
                .filter((entry) => entry.day === day)
                .sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
        })).filter((dayData) => dayData.entries.length > 0);
    })();

    const officialScheduleItems = sortedSchedule
        .flatMap((dayData) => dayData.classes.map((item) => ({
            ...item,
            day: dayData.day,
            type: 'official',
        })))
        .sort((a, b) => sortByDayAndTime(a, b, daysArr, toMin));

    const internalScheduleItems = filteredInternalSchedule
        .flatMap((dayData) => dayData.entries.map((item) => ({
            ...item,
            day: dayData.day,
            type: 'internal',
        })))
        .sort((a, b) => sortByDayAndTime(a, b, daysArr, toMin));

    const officialClassIds = new Set(officialScheduleItems.map((item) => item.id));
    const mirroredInternalByOfficialId = new Map(
        internalScheduleItems
            .filter((item) => item.originalScheduleDetailId)
            .map((item) => [item.originalScheduleDetailId, item]),
    );

    const usedInternalIds = new Set();
    const parallelColumns = officialScheduleItems.map((officialItem) => {
        const mirroredInternalItem = mirroredInternalByOfficialId.get(officialItem.id) || null;

        if (mirroredInternalItem) {
            usedInternalIds.add(mirroredInternalItem.id);
        }

        return {
            key: mirroredInternalItem
                ? `pair-${officialItem.id}-${mirroredInternalItem.id}`
                : `official-${officialItem.id}`,
            officialItem,
            internalItem: mirroredInternalItem,
        };
    });

    internalScheduleItems.forEach((internalItem) => {
        const hasMatchingOfficial = internalItem.originalScheduleDetailId
            ? officialClassIds.has(internalItem.originalScheduleDetailId)
            : false;

        if (!usedInternalIds.has(internalItem.id) && !hasMatchingOfficial) {
            parallelColumns.push({
                key: `internal-${internalItem.id}`,
                officialItem: null,
                internalItem,
            });
        }
    });

    const comparisonRows = parallelColumns
        .map((column) => {
            const activeItem = column.internalItem || column.officialItem;

            return {
                ...column,
                activeItem,
                courseItem: column.officialItem || column.internalItem,
                activeVariant: column.internalItem ? 'internal' : 'official',
            };
        })
        .sort((a, b) => sortByDayAndTime(a.activeItem, b.activeItem, daysArr, toMin));

    const activeScheduleItems = comparisonRows
        .map((row) => row.activeItem)
        .filter(Boolean);

    const totalWeeklyHours = activeScheduleItems.reduce(
        (sum, item) => sum + Number(item.hours ?? item.requiredHours ?? 0),
        0,
    );
// Filter and search logic
    const filteredRows = comparisonRows.filter((row) => {
        const courseItem = row.courseItem;
        const activeItem = row.activeItem;

        // Filter by day
        if (selectedDay !== 'all' && activeItem?.day !== selectedDay) {
            return false;
        }

        // Search by course code, subject, room, or program
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const courseCode = (courseItem?.code || '').toLowerCase();
            const subject = (courseItem?.subject || '').toLowerCase();
            const roomLabel = (activeItem?.room || '').toLowerCase();
            const programCode = (courseItem?.programCode || '').toLowerCase();

            const matches = (
                courseCode.includes(query)
                || subject.includes(query)
                || roomLabel.includes(query)
                || programCode.includes(query)
            );

            return matches;
        }

        return true;
    });
    const teachingDays = new Set(activeScheduleItems.map((item) => item.day).filter(Boolean)).size;

    return (
        <AuthenticatedLayout>
            <Head title="Schedule" />

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link
                        href={route('faculty.dashboard')}
                        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Schedule</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {facultyName ? `${facultyName}'s` : 'Your'} weekly teaching schedule.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <StatCard
                        label="Teaching Days"
                        value={teachingDays}
                        icon={(
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25m10.5-2.25v2.25M3 18.75V7.5A2.25 2.25 0 0 1 5.25 5.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25M3 18.75A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75M3 18.75v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                            </svg>
                        )}
                    />
                    <StatCard
                        label="Weekly Hours"
                        value={formatHours(totalWeeklyHours)}
                        icon={(
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                        )}
                    />
                </div>
            </div>

            <div className="mb-6 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.5 5.5a7.5 7.5 0 0 0 10.5 10.5Z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search courses, code, room, or program..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm placeholder-gray-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:placeholder-gray-400 dark:focus:border-emerald-400"
                    />
                </div>

                {/* Day Filter */}
                <div className="flex gap-2">
                    <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-700 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-emerald-400"
                    >
                        <option value="all">All Days</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </select>
                </div>
            </div>

            <div>
                {filteredRows.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-200 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="hidden divide-x divide-gray-200 border-b border-gray-200 bg-gray-100 dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-700/40 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
                            <p className={`flex items-center justify-center px-5 py-4 text-xs font-black uppercase tracking-[0.22em] ${ROW_STYLES.course.heading}`}>
                                Course
                            </p>
                            <p className={`flex items-center justify-center px-5 py-4 text-xs font-black uppercase tracking-[0.22em] ${ROW_STYLES.official.labelText}`}>
                                Official Schedule
                            </p>
                            <p className={`flex items-center justify-center px-5 py-4 text-xs font-black uppercase tracking-[0.22em] ${ROW_STYLES.internal.labelText}`}>
                                Internal Schedule
                            </p>
                        </div>

                        {filteredRows.map((row, index) => (
                            <div
                                key={row.key}
                                className={`border-t border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80 ${
                                    index === filteredRows.length - 1 ? '' : ''
                                }`}
                            >
                                <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] lg:divide-x dark:divide-gray-700">
                                    <CourseCell item={row.courseItem} />
                                    <ScheduleSlot
                                        item={row.officialItem}
                                        title="Official Schedule"
                                        variant="official"
                                        isActive={row.activeVariant === 'official'}
                                        onClick={handleCardClick}
                                    />
                                    <ScheduleSlot
                                        item={row.internalItem}
                                        title="Internal Schedule"
                                        variant="internal"
                                        isActive={row.activeVariant === 'internal'}
                                        onClick={handleCardClick}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                        </div>
                        <p className="mb-0.5 text-sm font-bold text-gray-600 dark:text-gray-300">
                            {searchQuery || selectedDay !== 'all'
                                ? 'No schedules found'
                                : 'No schedule found'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {searchQuery || selectedDay !== 'all'
                                ? 'Try adjusting your search or day filter'
                                : 'You have no official or internal classes yet.'}
                        </p>
                    </div>
                )}
            </div>

            <Modal show={!!selectedSchedule} onClose={() => setSelectedSchedule(null)} maxWidth="xl">
                {selectedSchedule && (() => {
                    // Find the corresponding row to get paired schedule info
                    const correspondingRow = comparisonRows.find(row => 
                        row.officialItem?.id === selectedSchedule.id || 
                        row.internalItem?.id === selectedSchedule.id
                    );
                    const pairedSchedule = correspondingRow && (
                        selectedSchedule.type === 'official' 
                            ? correspondingRow.internalItem 
                            : correspondingRow.officialItem
                    );

                    return (
                    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-gray-800">
                        <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-[#7a1315] to-[#5a0d0f] p-6">
                            <div className="flex items-center gap-3">
                                <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${
                                    selectedSchedule.type === 'internal'
                                        ? 'bg-amber-400/20 text-amber-300 ring-amber-400/30'
                                        : 'bg-emerald-400/20 text-emerald-300 ring-emerald-400/30'
                                }`}>
                                    {selectedSchedule.type} load
                                </span>
                                {selectedSchedule.isChanged && (
                                    <span className="rounded-lg bg-orange-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-orange-300 ring-1 ring-inset ring-orange-500/30">
                                        Modified
                                    </span>
                                )}
                            </div>
                            <h2 className="mt-4 line-clamp-2 text-xl font-black leading-tight text-white">
                                {selectedSchedule.subject || 'Operational Duty'}
                            </h2>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <div className="mb-8">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700/50 dark:bg-gray-900/50">
                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Time Schedule</p>
                                    <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                        </svg>
                                        <span className="text-sm font-black tabular-nums">{selectedSchedule.startTime} - {selectedSchedule.endTime}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 after:h-px after:flex-1 after:bg-gray-100 after:content-[''] dark:text-gray-500 dark:after:bg-gray-700">
                                        Classification
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Class Code</span>
                                            <span className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">{selectedSchedule.code || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-start justify-between">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Venue / Room</span>
                                            <span className="text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{selectedSchedule.room || 'TBA'}</span>
                                        </div>
                                        {(selectedSchedule.programCode || selectedSchedule.sectionName) && (
                                            <div className="flex items-start justify-between">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Program / Section</span>
                                                <div className="text-right">
                                                    <p className="text-sm font-black uppercase text-gray-900 dark:text-white">{selectedSchedule.programCode || 'N/A'}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">{selectedSchedule.yearLevel}-{selectedSchedule.sectionName || 'N/A'}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(selectedSchedule.scheduleCode || selectedSchedule.effectiveFrom) && (
                                    <div>
                                        <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 after:h-px after:flex-1 after:bg-gray-100 after:content-[''] dark:text-gray-500 dark:after:bg-gray-700">
                                            Configuration
                                        </h3>
                                        <div className="space-y-4">
                                            {selectedSchedule.scheduleCode && (
                                                <div className="flex items-start justify-between">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Schedule Ref</span>
                                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-bold text-gray-900 dark:bg-gray-700 dark:text-white">{selectedSchedule.scheduleCode}</span>
                                                </div>
                                            )}
                                            {selectedSchedule.effectiveFrom && (
                                                <div className="flex items-start justify-between">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Active Period</span>
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                        {selectedSchedule.effectiveFrom} - {selectedSchedule.effectiveUntil || 'Present'}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSchedule.syncedAt && (
                                                <div className="flex items-start justify-between border-t border-dashed border-gray-50 pt-2 dark:border-gray-700/50">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Biometric Sync</span>
                                                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">{selectedSchedule.syncedAt}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedSchedule.comparison && (
                                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-5 dark:border-blue-800/30 dark:bg-blue-900/10">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                                Official Schedule Comparison
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Original Load</p>
                                                <p className="text-xs font-black uppercase tabular-nums text-gray-700 dark:text-gray-300">
                                                    {selectedSchedule.comparison.startTime}<br />
                                                    <span className="text-[10px] italic text-gray-400">to</span><br />
                                                    {selectedSchedule.comparison.endTime}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Official Venue</p>
                                                <p className="text-xs font-black uppercase italic text-gray-700 dark:text-gray-300">
                                                    {selectedSchedule.comparison.room}
                                                </p>
                                            </div>
                                            {selectedSchedule.comparison.day !== selectedSchedule.day && (
                                                <div className="col-span-2 space-y-1 border-t border-blue-100/50 pt-3 dark:border-blue-800/20">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Basis Day</p>
                                                    <p className="text-xs font-black uppercase text-amber-600 dark:text-amber-500">
                                                        {selectedSchedule.comparison.day}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {pairedSchedule && (
                                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/30 p-5 dark:border-amber-800/30 dark:bg-amber-900/10">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                                Internal Schedule Linked
                                            </h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Time</span>
                                                <span className="text-xs font-black uppercase tabular-nums text-gray-700 dark:text-gray-300">
                                                    {pairedSchedule.startTime} - {pairedSchedule.endTime}
                                                </span>
                                            </div>
                                            <div className="flex items-start justify-between">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Room</span>
                                                <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                                                    {pairedSchedule.room || 'TBA'}
                                                </span>
                                            </div>
                                            {pairedSchedule.day !== selectedSchedule.day && (
                                                <div className="border-t border-amber-100/50 pt-3 dark:border-amber-800/20">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Day</p>
                                                    <p className="text-xs font-black uppercase text-amber-600 dark:text-amber-500">
                                                        {pairedSchedule.day}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                            <button
                                type="button"
                                onClick={() => setSelectedSchedule(null)}
                                className="w-full rounded-2xl bg-gray-900 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-95 dark:bg-white dark:text-gray-900"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                    );
                })()}
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
