import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { formatHours } from '@/Utils/formatHours';

const DAY_COLORS = {
    Mon: 'from-blue-500 to-blue-600',
    Tue: 'from-violet-500 to-violet-600',
    Wed: 'from-emerald-500 to-emerald-600',
    Thu: 'from-amber-500 to-amber-600',
    Fri: 'from-rose-500 to-rose-600',
    Sat: 'from-cyan-500 to-cyan-600',
    Sun: 'from-gray-400 to-gray-500',
};

const ROW_STYLES = {
    official: {
        labelText: 'text-emerald-700 dark:text-emerald-300',
        cardPanel: 'border-gray-200/80 bg-white dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-emerald-500/30',
    },
    internal: {
        labelText: 'text-amber-700 dark:text-amber-300',
        cardPanel: 'border-amber-200/80 bg-white dark:border-amber-500/30 dark:bg-gray-800/80 dark:hover:border-amber-400/50',
    },
};

const formatScheduleMeta = (item) => {
    const yearSection = [item.yearLevel, item.sectionName].filter(Boolean).join('-');

    return [item.programCode, yearSection].filter(Boolean).join(' ');
};

const sortByDayAndTime = (a, b, daysArr, toMin) => {
    const dayDifference = daysArr.indexOf(a.day) - daysArr.indexOf(b.day);

    if (dayDifference !== 0) {
        return dayDifference;
    }

    return toMin(a.startTime) - toMin(b.startTime);
};

const ScheduleCard = ({ item, onClick }) => {
    const variant = item.type === 'internal' ? 'internal' : 'official';
    const isInternal = variant === 'internal';
    const styles = ROW_STYLES[variant];
    const metaLabel = formatScheduleMeta(item);
    const shortDay = item.day ? item.day.substring(0, 3) : 'Day';

    return (
        <button
            type="button"
            onClick={() => onClick(item)}
            className={`flex w-full flex-col rounded-[26px] border px-3.5 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${styles.cardPanel} ${isInternal ? 'border-dashed' : ''}`}
        >
            <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${DAY_COLORS[shortDay] ?? 'from-gray-400 to-gray-500'} text-[11px] font-bold text-white shadow-sm`}>
                        {shortDay}
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                            {item.day || 'Unscheduled'}
                        </p>
                    </div>
                </div>
                {isInternal && (
                    <span className="inline-flex shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        Internal
                    </span>
                )}
            </div>

            <div className="mt-3 space-y-1">
                <h4 className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                    {item.subject || 'Operational Duty'}
                </h4>

                {metaLabel && (
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        {metaLabel}
                    </p>
                )}
            </div>

            <p className="mt-3 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {item.startTime} - {item.endTime}
            </p>
        </button>
    );
};

export default function Schedule({ weeklySchedule, internalSchedule, facultyName }) {
    const [selectedSchedule, setSelectedSchedule] = useState(null);

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

    const totalWeeklyHours = sortedSchedule.reduce(
        (sum, dayData) => sum + dayData.classes.reduce((classHours, item) => classHours + item.hours, 0),
        0,
    );

    const teachingDays = sortedSchedule.length;

    return (
        <AuthenticatedLayout>
            <Head title="Schedule & Attendance" />

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
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Schedule & Attendance
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {facultyName ? `${facultyName}'s` : 'Your'} weekly teaching schedule and attendance history.
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="rounded-2xl border border-gray-200/60 bg-white px-5 py-3 text-center shadow-sm dark:border-gray-700/60 dark:bg-gray-800/80">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Teaching Days</p>
                        <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{teachingDays}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200/60 bg-white px-5 py-3 text-center shadow-sm dark:border-gray-700/60 dark:bg-gray-800/80">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Weekly Hours</p>
                        <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{formatHours(totalWeeklyHours)}</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 rounded-3xl border border-gray-200/60 bg-white/90 p-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800/70">
                <div className="flex flex-wrap items-center gap-4">
                    <p className={`text-xs font-black uppercase tracking-[0.22em] ${ROW_STYLES.official.labelText}`}>
                        Official Schedule
                    </p>
                    <p className={`text-xs font-black uppercase tracking-[0.22em] ${ROW_STYLES.internal.labelText}`}>
                        Internal Schedule
                    </p>
                </div>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Official entries are the baseline schedule. Internal entries appear below only when there is an approved mirrored change.
                </p>
            </div>

            <div>
                {parallelColumns.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {parallelColumns.map((column) => (
                            <div
                                key={column.key}
                                className="flex flex-col rounded-3xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                            >
                                <div className="space-y-3">
                                    {column.officialItem ? (
                                        <ScheduleCard
                                            item={column.officialItem}
                                            onClick={handleCardClick}
                                        />
                                    ) : null}

                                    {column.internalItem ? (
                                        <ScheduleCard
                                            item={column.internalItem}
                                            onClick={handleCardClick}
                                        />
                                    ) : null}
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
                        <p className="mb-0.5 text-sm font-bold text-gray-600 dark:text-gray-300">No schedule found</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">You have no official or internal classes yet.</p>
                    </div>
                )}
            </div>

            <Modal show={!!selectedSchedule} onClose={() => setSelectedSchedule(null)} maxWidth="xl">
                {selectedSchedule && (
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
                )}
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
