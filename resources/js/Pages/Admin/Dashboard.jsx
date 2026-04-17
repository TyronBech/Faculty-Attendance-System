import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    CHART_BAR_ACTIVE_COLOR,
    CHART_BAR_BASE_COLOR,
    DASHBOARD_ITEMS_PER_PAGE,
    STRINGS,
} from '@/Constants/admin';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
} from 'recharts';

/* ──────────────────────────────────────────────
   Icon components
   ────────────────────────────────────────────── */
const icons = {
    users: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
    ),
    login: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
    ),
    logout: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
        </svg>
    ),
    chart: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
    ),
};

/* ──────────────────────────────────────────────
   Stat card component
   ────────────────────────────────────────────── */
function StatCard({ stat, index }) {
    return (
        <div
            className="group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
            style={{ animationDelay: `${index * 100}ms` }}
        >
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
                        className={`mt-1 text-xs font-medium ${
                            stat.changeType === 'positive'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-400 dark:text-gray-500'
                        }`}
                    >
                        {stat.change}
                    </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] text-white shadow-lg shadow-red-900/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    {icons[stat.icon] ?? icons.chart}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Faculty list row component
   ────────────────────────────────────────────── */
function FacultyRow({ faculty, type }) {
    const isTimedIn = type === 'in';

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/40 px-4 py-3 transition-all duration-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/40">
            {/* Status dot */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isTimedIn
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
            }`}>
                <div className={`h-2.5 w-2.5 rounded-full ${isTimedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {faculty.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {faculty.department}
                </p>
            </div>

            {/* Time */}
            <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {isTimedIn ? faculty.timedInAt : faculty.lastActivity}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {isTimedIn ? 'Timed in' : 'Last seen'}
                </p>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Custom Bar Chart tooltip
   ────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 shadow-xl text-xs">
            <p className="font-bold text-gray-900 dark:text-white mb-1">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-500 dark:text-gray-400">Faculty Timed In:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{entry.value}</span>
                </div>
            ))}
            {payload[0]?.payload?.date && (
                <p className="mt-1 text-[11px] text-gray-400">{payload[0].payload.date}</p>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Main Admin Dashboard page
   ────────────────────────────────────────────── */
export default function AdminDashboard({
    stats,
    timedInFaculties,
    timedOutFaculties,
    weeklyGraph,
    currentDate,
    greeting,
}) {
    const { auth } = usePage().props;
    const userName = auth.display_name ?? auth.user.username ?? auth.user.email.split('@')[0];

    const [statsData, setStatsData] = useState(stats);
    const [timedIn, setTimedIn] = useState(timedInFaculties);
    const [timedOut, setTimedOut] = useState(timedOutFaculties);
    const [graphData, setGraphData] = useState(weeklyGraph);
    const [activeTab, setActiveTab] = useState('in');
    // Pagination for faculty lists
    const [inPage, setInPage] = useState(1);
    const [outPage, setOutPage] = useState(1);

    const totalInPages = Math.ceil(timedIn.length / DASHBOARD_ITEMS_PER_PAGE);
    const totalOutPages = Math.ceil(timedOut.length / DASHBOARD_ITEMS_PER_PAGE);

    const paginatedIn = timedIn.slice((inPage - 1) * DASHBOARD_ITEMS_PER_PAGE, inPage * DASHBOARD_ITEMS_PER_PAGE);
    const paginatedOut = timedOut.slice((outPage - 1) * DASHBOARD_ITEMS_PER_PAGE, outPage * DASHBOARD_ITEMS_PER_PAGE);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(route('admin.api.dashboard'));
                setStatsData(res.data.stats);
                setTimedIn(res.data.timedInFaculties);
                setTimedOut(res.data.timedOutFaculties);
                setGraphData(res.data.weeklyGraph);
            } catch (err) {
                console.error('Failed to refresh dashboard:', err);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);


    return (
        <AuthenticatedLayout>
            <Head title="Admin Dashboard" />

            {/* ── Welcome Banner ─────────────────────── */}
            <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#7a1315] via-[#9b1b1e] to-[#cc2127] px-6 py-10 sm:px-10 sm:py-14 shadow-2xl shadow-red-900/30">
                <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                <div className="relative flex flex-col gap-1">
                    <p className="text-sm font-medium tracking-wide text-white/70 uppercase">
                        {currentDate}
                    </p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        {greeting},{' '}
                        <span className="text-white opacity-90">{userName}</span>!
                    </h1>
                    <p className="mt-2 max-w-xl text-base text-white/70 leading-relaxed">
                        {STRINGS.dashboardDescription}
                    </p>
                </div>
            </section>

            {/* ── Stat Cards ────────────────────────────── */}
            <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {statsData.map((stat, i) => (
                    <StatCard key={stat.label} stat={stat} index={i} />
                ))}
            </section>

            {/* ── Analytics Grid ─────────────────────────── */}
            <section className="mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Card 1: Weekly Timed-In Graph */}
                    <div className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm flex flex-col">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    Weekly Attendance Overview
                                </h3>
                            </div>
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
                                Mon – Sat
                            </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Total faculty members who timed in each day this week.
                        </p>

                        {/* Summary row */}
                        <div className="mt-5 grid grid-cols-6 gap-3">
                            {graphData.map((day) => (
                                <div
                                    key={day.day}
                                    className={`text-center rounded-xl py-3 transition-all duration-200 ${
                                        day.isToday
                                            ? 'bg-gradient-to-b from-[#7a1315]/10 to-[#cc2127]/5 border border-[#7a1315]/20 dark:border-[#cc2127]/30'
                                            : 'bg-gray-50 dark:bg-gray-800/60'
                                    }`}
                                >
                                    <p className={`text-xs font-bold uppercase tracking-wider ${
                                        day.isToday ? 'text-[#7a1315] dark:text-[#cc2127]' : 'text-gray-400 dark:text-gray-500'
                                    }`}>
                                        {day.shortDay}
                                    </p>
                                    <p className={`mt-1 text-2xl font-extrabold ${
                                        day.isToday ? 'text-[#7a1315] dark:text-[#cc2127]' : 'text-gray-900 dark:text-white'
                                    }`}>
                                        {day.count}
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{day.date}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar Chart */}
                        <div className="mt-6 h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={graphData}
                                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke="currentColor"
                                        className="text-gray-100 dark:text-gray-700/50"
                                    />
                                    <XAxis
                                        dataKey="shortDay"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fontWeight: 700, fill: '#9ca3af' }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(122,19,21,0.05)' }} />
                                    <Bar
                                        dataKey="count"
                                        radius={[8, 8, 0, 0]}
                                        maxBarSize={48}
                                    >
                                        {graphData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.isToday ? CHART_BAR_ACTIVE_COLOR : CHART_BAR_BASE_COLOR}
                                                className="transition-all duration-300"
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Card 2: Timed In / Timed Out Faculty List */}
                    <div className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm flex flex-col">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    Faculty Status
                                </h3>
                            </div>
                        </div>

                        {/* Tab switcher */}
                        <div className="mt-4 flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
                            <button
                                onClick={() => { setActiveTab('in'); setInPage(1); }}
                                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                    activeTab === 'in'
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Timed In ({timedIn.length})
                                </span>
                            </button>
                            <button
                                onClick={() => { setActiveTab('out'); setOutPage(1); }}
                                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                    activeTab === 'out'
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                                    Timed Out ({timedOut.length})
                                </span>
                            </button>
                        </div>

                        {/* Faculty list */}
                        <div className="mt-4 flex-1 space-y-2">
                            {activeTab === 'in' ? (
                                paginatedIn.length > 0 ? (
                                    paginatedIn.map((f) => (
                                        <FacultyRow key={f.id} faculty={f} type="in" />
                                    ))
                                ) : (
                                    <EmptyState message="No faculty timed in" detail="No one has timed in yet today." icon="login" />
                                )
                            ) : (
                                paginatedOut.length > 0 ? (
                                    paginatedOut.map((f) => (
                                        <FacultyRow key={f.id} faculty={f} type="out" />
                                    ))
                                ) : (
                                    <EmptyState message="All faculty are timed in" detail="Everyone is currently on campus." icon="logout" />
                                )
                            )}
                        </div>

                        {/* Pagination for faculty list */}
                        {activeTab === 'in' && totalInPages > 1 && (
                            <ListPagination page={inPage} total={totalInPages} onChange={setInPage} />
                        )}
                        {activeTab === 'out' && totalOutPages > 1 && (
                            <ListPagination page={outPage} total={totalOutPages} onChange={setOutPage} />
                        )}
                    </div>
                </div>
            </section>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}

/* ──────────────────────────────────────────────
   Empty state component
   ────────────────────────────────────────────── */
function EmptyState({ message, detail, icon }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-3">
                {icons[icon] ?? icons.users}
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{detail}</p>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Simple list pagination
   ────────────────────────────────────────────── */
function ListPagination({ page, total, onChange }) {
    return (
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-4">
            <button
                onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Prev
            </button>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Page {page} of {total}
            </span>
            <button
                onClick={() => onChange(Math.min(total, page + 1))}
                disabled={page === total}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
                Next
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
            </button>
        </div>
    );
}
