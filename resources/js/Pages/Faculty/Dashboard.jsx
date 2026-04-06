import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/Pagination';
import ScrollToTop from '@/Components/ScrollToTop';
import Dropdown from '@/Components/Dropdown';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { formatHours } from '@/Utils/formatHours';
import axios from 'axios';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

/* ──────────────────────────────────────────────
   Icon components (inline SVG — no extra deps)
   ────────────────────────────────────────────── */
const icons = {
    clock: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    book: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
    ),
    chart: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
    ),
    calendar: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    ),
};

/* ──────────────────────────────────────────────
   Status badge component
   ────────────────────────────────────────────── */

function statusStyle(status = '') {
    const s = status.toLowerCase();
    if (s === 'present' || s === 'on-time')
        return 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/40 ring-emerald-600/20';
    if (s.includes('late') && s.includes('early'))
        return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/40 ring-orange-500/20';
    if (s.includes('late') || s.includes('tardy'))
        return 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/40 ring-amber-600/20';
    if (s.includes('early') || s.includes('undertime'))
        return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/40 ring-orange-500/20';
    if (s === 'absent')
        return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/40 ring-red-600/20';
    if (s === 'holiday' || s === 'holiday present')
        return 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40 ring-blue-600/20';
    if (s.includes('missing') || s.includes('check'))
        return 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/40 ring-rose-600/20';
    if (s === 'overtime')
        return 'text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/40 ring-indigo-600/20';
    if (s.includes('undertime') && s.includes('overtime'))
        return 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/40 ring-purple-600/20';
    // default
    return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800 ring-gray-500/20';
}

function StatusBadge({ status }) {
    const styles = {
        completed:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-600/20',
        ongoing:
            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-amber-600/20 animate-pulse',
        upcoming:
            'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 ring-sky-600/20',
    };

    const labels = {
        completed: 'Completed',
        ongoing: 'Ongoing',
        upcoming: 'Upcoming',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status] ?? styles.upcoming}`}
        >
            {status === 'ongoing' && (
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            )}
            {labels[status] ?? status}
        </span>
    );
}

/* ──────────────────────────────────────────────
   Stat card component
   ────────────────────────────────────────────── */
function StatCard({ stat, index }) {
    return (
        <div
            className="group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            {/* Decorative gradient blob */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-[#7a1315]/10 to-[#cc2127]/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />

            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {stat.label}
                    </p>
                    <p className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                            {stat.value}
                        </span>
                        {stat.unit && (
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                                {stat.unit}
                            </span>
                        )}
                    </p>
                    <p
                        className={`mt-1 text-xs font-medium ${stat.changeType === 'positive'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-400 dark:text-gray-500'
                            }`}
                    >
                        {stat.change}
                    </p>
                </div>

                {/* Icon circle */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] text-white shadow-lg shadow-red-900/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    {icons[stat.icon] ?? icons.chart}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Schedule Card component
   ────────────────────────────────────────────── */
function ScheduleCard({ item }) {
    const isCurrent = item.status === 'ongoing';

    return (
        <div
            className={`group relative flex flex-col justify-between rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-200 ${isCurrent ? 'border-[#7a1315]/30 bg-gradient-to-r from-[#7a1315]/5 to-transparent dark:border-[#cc2127]/30 dark:from-[#cc2127]/10' : 'border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-700/50'}`}
        >
            {/* Top Section: Subject & Status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                    <div className={`mt-1 h-3 w-3 shrink-0 rounded-full bg-gradient-to-r ${isCurrent ? 'from-amber-400 to-amber-600' : 'from-blue-400 to-blue-600'} shadow-sm`} />
                    <div>
                        <h4 className="font-bold text-white leading-tight pr-2">
                            {item.subject}
                        </h4>
                        {item.code && (
                            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                {item.code}
                            </p>
                        )}
                        {(item.programCode || item.yearLevel || item.sectionName) && (
                            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-500">
                                {[item.programCode, (item.yearLevel || item.sectionName) ? [item.yearLevel, item.sectionName].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}
                            </p>
                        )}
                    </div>
                </div>
                <div className="shrink-0 ml-2">
                    <StatusBadge status={item.status} />
                </div>
            </div>

            {/* Bottom Section: Time & Room */}
            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                        <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {item.startTime} - {item.endTime}
                    </div>
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/50 text-xs font-semibold text-gray-600 dark:text-gray-300 shadow-sm">
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    {item.room}
                </div>
            </div>

            {/* Schedule Code & Effective Period */}
            {(item.scheduleCode || item.effectiveFrom || item.isChanged) && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {item.scheduleCode && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-300/50 dark:ring-gray-600/50">
                            {item.scheduleCode}
                        </span>
                    )}
                    {item.effectiveFrom && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {item.effectiveFrom} – {item.effectiveUntil}
                        </span>
                    )}
                    {item.isChanged && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-400/30" title={`Moved from ${item.originalDay}`}>
                            Changed
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Custom Recharts tooltip
   ────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    // Convert minutes-since-midnight to readable time
    const toTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 shadow-xl text-xs">
            <p className="font-bold text-gray-900 dark:text-white mb-1.5">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-gray-500 dark:text-gray-400">
                        {entry.name === 'checkIn' ? 'Check-In' : 'Check-Out'}:
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                        {toTime(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Main Faculty Dashboard page
   ────────────────────────────────────────────── */
export default function FacultyDashboard({ stats, todaySchedule, checkInTrend, monthlyAverages, currentDate, greeting, filters, recentAttendance }) {
    const { auth } = usePage().props;

    //Faculty Fullname
    const userName = auth.faculty ? `${auth.faculty.first_name} ${auth.faculty.last_name}` : 'Faculty Member';

    const [selectedRange, setSelectedRange] = useState(filters?.range ?? 'Last 6 months');
    const [isReloading, setIsReloading] = useState(false);

    // Recent Attendance Pagination state
    const [attendancePage, setAttendancePage] = useState(1);
    const [attendancePerPage, setAttendancePerPage] = useState(5);

    // Internal state for metrics that update via AJAX
    const [trendData, setTrendData] = useState(checkInTrend);
    const [averagesData, setAveragesData] = useState(monthlyAverages);

    const handleRangeChange = async (range) => {
        setSelectedRange(range);
        setIsReloading(true);

        try {
            const response = await axios.get(route('faculty.api.analytics'), {
                params: { range }
            });

            setTrendData(response.data.checkInTrend);
            setAveragesData(response.data.monthlyAverages);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setIsReloading(false);
        }
    };



    return (
        <AuthenticatedLayout>
            <Head title="Faculty Dashboard" />

            {/* ── Welcome Banner ─────────────────────── */}
            <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#7a1315] via-[#9b1b1e] to-[#cc2127] px-6 py-10 sm:px-10 sm:py-14 shadow-2xl shadow-red-900/30">
                {/* decorative circles */}
                <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                <div className="relative flex flex-col gap-1">
                    <p className="text-sm font-medium tracking-wide text-white/70 uppercase">
                        {currentDate}
                    </p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        {greeting},{' '}
                        <span className="text-white opacity-90">
                            {userName}
                        </span>
                        !
                    </h1>
                    <p className="mt-2 max-w-xl text-base text-white/70 leading-relaxed">
                        Here's an overview of your schedule and teaching activity. Stay on track and have a productive day.
                    </p>
                </div>
            </section>

            {/* ── Today's Schedule ────────────────────── */}
            <section className="mt-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Today's Schedule
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {todaySchedule.length} {todaySchedule.length === 1 ? 'class' : 'classes'}
                        </span>
                        <Link
                            href={route('faculty.schedule')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            See full schedule
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </Link>
                    </div>
                </div>

                {todaySchedule.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {todaySchedule.map((item) => (
                            <ScheduleCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-16 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-4">
                            {icons.calendar}
                        </div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                            No classes scheduled for today
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Enjoy your free day!
                        </p>
                    </div>
                )}
            </section>

            {/* ── Analytics Grid ─────────────────────────── */}
            <section className="mt-8">
                <div className="grid grid-cols-1 gap-5">

                    {/* Card 1: Average Check-In/Out Time */}
                    <div className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Average Check-In/Out Time</h3>
                            </div>

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        {selectedRange}
                                        <svg className="h-4 w-4 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content width="48" contentClasses="py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                    {['Last 3 months', 'Last 6 months', 'Last 12 months', 'This Year'].map((range) => (
                                        <button
                                            key={range}
                                            onClick={() => handleRangeChange(range)}
                                            className={`block w-full px-4 py-2 text-start text-sm font-medium transition-all duration-200 ${selectedRange === range
                                                ? 'bg-red-50 text-[#7a1315] dark:bg-gray-700 dark:text-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </Dropdown.Content>
                            </Dropdown>
                        </div>

                        <p className="my-5 text-sm text-gray-500 dark:text-gray-400">
                            Monitor daily attendance and track overall workforce performance trends.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-full items-end">
                            {/* Left side: Times */}
                            <div className="md:col-span-2 flex flex-col justify-end gap-10">
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-bold tracking-tighter text-gray-900 dark:text-white hover:scale-105 transition-transform origin-left">
                                            {averagesData.avgCheckIn?.replace(/\s[AP]M/, '') ?? '--:--'}
                                        </span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                                            {averagesData.avgCheckIn?.match(/[AP]M/)?.[0] ?? ''}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Avg. Monthly Check-In Time</p>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-bold tracking-tighter text-gray-900 dark:text-white hover:scale-105 transition-transform origin-left">
                                            {averagesData.avgCheckOut?.replace(/\s[AP]M/, '') ?? '--:--'}
                                        </span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                                            {averagesData.avgCheckOut?.match(/[AP]M/)?.[0] ?? ''}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Avg. Monthly Check-Out Time</p>
                                </div>
                            </div>

                            {/* Right side: Chart */}
                            <div className="md:col-span-3 w-full">
                                <ResponsiveContainer width="100%" height={176} minWidth={0}>
                                    <AreaChart
                                        data={trendData}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="gradientCheckIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="currentColor"
                                            className="text-gray-100 dark:text-gray-700/50"
                                        />
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }}
                                            dy={8}
                                        />
                                        <YAxis
                                            hide
                                            domain={['dataMin - 20', 'dataMax + 20']}
                                        />
                                        <Tooltip content={<ChartTooltip />} cursor={false} />
                                        <Area
                                            type="monotone"
                                            dataKey="checkIn"
                                            stroke="#60a5fa"
                                            strokeWidth={2.5}
                                            fill="url(#gradientCheckIn)"
                                            dot={{
                                                r: 4,
                                                fill: '#fff',
                                                stroke: '#60a5fa',
                                                strokeWidth: 2.5,
                                            }}
                                            activeDot={{
                                                r: 6,
                                                fill: '#60a5fa',
                                                stroke: '#fff',
                                                strokeWidth: 2,
                                            }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>


                </div>
            </section>



            {/* ── Recent Attendance Match ────────────────────── */}
            {recentAttendance && recentAttendance.length > 0 && (
                <section className="mt-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Recent Attendance Status
                            </h2>
                            <span className="hidden sm:inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Latest 20 matches
                            </span>
                        </div>
                        <Link
                            href={route('faculty.attendance')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            View full history
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </Link>
                    </div>

                    <div className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm flex flex-col">
                        <div className="flex-1 space-y-3">
                            {recentAttendance.slice((attendancePage - 1) * attendancePerPage, attendancePage * attendancePerPage).map((log, index) => {
                                const statusColor = statusStyle(log.status);

                                return (
                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/40 p-4 transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-700/40 group">
                                        <div className="flex items-center gap-4">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner ${statusColor.split(' ring-')[0]}`}>
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-gray-900 dark:text-white transition-colors group-hover:text-[#7a1315] dark:group-hover:text-red-400">
                                                        {log.date}
                                                    </h4>
                                                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${statusColor}`}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {log.dayOfWeek} • Rendered: {formatHours(log.hoursRendered)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 sm:ml-auto">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Schedule</p>
                                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{log.expectedTimeIn} - {log.expectedTimeOut}</p>
                                            </div>
                                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700/80 hidden sm:block"></div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actual</p>
                                                <p className={`text-xs font-bold transition-colors ${log.lateMinutes > 0 || log.undertimeMinutes > 0 ? 'text-amber-600 dark:text-amber-400 group-hover:text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                                    {log.timeIn} - {log.timeOut}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Pagination
                            currentPage={attendancePage}
                            totalItems={recentAttendance.length}
                            perPage={attendancePerPage}
                            onPageChange={setAttendancePage}
                            onPerPageChange={setAttendancePerPage}
                            showDateRange={false}
                            className="mt-4 pt-1"
                        />
                    </div>
                </section>
            )}
            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
