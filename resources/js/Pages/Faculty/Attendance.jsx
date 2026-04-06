import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage, useForm } from '@inertiajs/react';
import { useState } from 'react';
import Pagination from '@/Components/Pagination';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import toast from 'react-hot-toast';

// ── Status badge colour helper ──────────────────────────────────────────────
function statusStyle(status = '') {
    const s = status.toLowerCase();
    if (s === 'present' || s === 'on-time')
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (s.includes('late') && s.includes('early'))
        return 'bg-orange-50 text-orange-700 ring-orange-500/20 dark:bg-orange-900/30 dark:text-orange-400';
    if (s.includes('late') || s.includes('tardy'))
        return 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400';
    if (s.includes('early') || s.includes('undertime'))
        return 'bg-orange-50 text-orange-700 ring-orange-500/20 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'absent')
        return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400';
    if (s === 'holiday' || s === 'holiday present')
        return 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400';
    if (s.includes('missing') || s.includes('check'))
        return 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-400';
    if (s === 'overtime')
        return 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-900/30 dark:text-indigo-400';
    // default
    return 'bg-gray-50 text-gray-700 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300';
}

export default function FacultyAttendance({ attendanceLogs }) {
    const { auth } = usePage().props;
    const userName = auth.faculty ? `${auth.faculty.first_name} ${auth.faculty.last_name}` : 'Faculty Member';

    // Pagination & Filtering Logic
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [sourceFilter, setSourceFilter] = useState('all');

    // Missing Time Justification Modal
    const [showMissingTimeModal, setShowMissingTimeModal] = useState(false);
    const [selectedMissingTimeLog, setSelectedMissingTimeLog] = useState(null);

    const missingTimeForm = useForm({
        justification: '',
    });

    const canEditJustification = (log, type) => {
        if (!log) return false;
        const statusField = type === 'missing_time' ? 'missing_time_status' : 'missing_time_status';
        if (!log[statusField]) return true; // Can always add new
        if (log[statusField] !== 'pending' || !log.updated_at) return false;

        // Use the ISO string from the backend
        const updatedTime = new Date(log.updated_at).getTime();
        const now = new Date().getTime();
        return (now - updatedTime) <= 15 * 60 * 1000;
    };

    const openMissingTimeModal = (log) => {
        setSelectedMissingTimeLog(log);
        missingTimeForm.setData('justification', log.missing_time_justification || '');
        missingTimeForm.clearErrors();
        setShowMissingTimeModal(true);
    };

    const submitMissingTimeJustification = (e) => {
        e.preventDefault();
        missingTimeForm.post(route('faculty.attendance.missing-justify', selectedMissingTimeLog.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowMissingTimeModal(false);
            },
        });
    };

    const [summaryFilter, setSummaryFilter] = useState('all');

    // Filter logs based on date picker and source
    const baseFilteredLogs = attendanceLogs.filter(log => {
        if (sourceFilter === 'online' && !log.online_attendance) return false;
        if (sourceFilter === 'biometric' && log.online_attendance) return false;

        if (!dateRange.start && !dateRange.end) return true;

        let valid = true;
        const logDate = new Date(log.raw_date).getTime();
        if (dateRange.start && logDate < new Date(dateRange.start).getTime()) valid = false;
        if (dateRange.end && logDate > new Date(dateRange.end).getTime()) valid = false;
        return valid;
    });

    // ── Summary stats (over filtered window) ───────────────────────────────
    const summary = baseFilteredLogs.reduce((acc, log) => {
        const s = (log.status || '').toLowerCase();
        if (s === 'absent') acc.daysAbsent++;
        if (s.includes('late') || s.includes('tardy')) {
            acc.timesLate++;
            acc.totalLateMinutes += log.late_minutes || 0;
        }
        if (s.includes('early') || s.includes('undertime')) {
            acc.timesUndertime++;
            acc.totalUndertimeMinutes += log.undertime_minutes || 0;
        }
        if ((log.night_minutes || 0) > 0) {
            acc.timesNight++;
            acc.totalNightMinutes += log.night_minutes;
        }
        if ((log.overtime_minutes || 0) > 0) {
            acc.timesOvertime++;
            acc.totalOvertimeMinutes += log.overtime_minutes;
        }
        if ((log.overtime_night_minutes || 0) > 0) {
            acc.timesOvertimeNight++;
            acc.totalOvertimeNightMinutes += log.overtime_night_minutes;
        }
        return acc;
    }, {
        daysAbsent: 0,
        timesLate: 0, totalLateMinutes: 0,
        timesUndertime: 0, totalUndertimeMinutes: 0,
        timesNight: 0, totalNightMinutes: 0,
        timesOvertime: 0, totalOvertimeMinutes: 0,
        timesOvertimeNight: 0, totalOvertimeNightMinutes: 0,
    });

    const filteredLogs = baseFilteredLogs.filter((log) => {
        if (summaryFilter === 'all') return true;
        const s = (log.status || '').toLowerCase();
        if (summaryFilter === 'absent' && s === 'absent') return true;
        if (summaryFilter === 'late' && (s.includes('late') || s.includes('tardy'))) return true;
        if (summaryFilter === 'undertime' && (s.includes('early') || s.includes('undertime'))) return true;
        if (summaryFilter === 'night' && (log.night_minutes || 0) > 0) return true;
        if (summaryFilter === 'overtime' && (log.overtime_minutes || 0) > 0) return true;
        if (summaryFilter === 'overtimeNight' && (log.overtime_night_minutes || 0) > 0) return true;
        return false;
    });

    const fmtMins = (m) => {
        if (!m || m <= 0) return '0m';
        const d = Math.floor(m / 1440);
        const h = Math.floor((m % 1440) / 60);
        const rem = m % 60;

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (rem > 0 || (d === 0 && h === 0)) parts.push(`${rem}m`);

        return parts.join(' ');
    };

    const paginatedLogs = filteredLogs.slice(
        (currentPage - 1) * perPage,
        currentPage * perPage
    );

    // Count missing logs that have no justification submitted yet
    const pendingMissingLogsCount = attendanceLogs.filter(log =>
        (log.actual_time_in === '--:--' || log.actual_time_out === '--:--') &&
        !log.missing_time_status
    ).length;

    return (
        <AuthenticatedLayout>
            <Head title="Attendance History" />

            {pendingMissingLogsCount > 0 && (
                <div className="mb-6 flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-900/20 dark:border-rose-800/50 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300">Action Required: Missing Time Logs</h3>
                            <p className="text-xs text-rose-700 dark:text-rose-400/80 mt-0.5">
                                You have <span className="font-bold underline">{pendingMissingLogsCount}</span> {pendingMissingLogsCount === 1 ? 'record' : 'records'} with missing time-in or time-out. Please provide a justification to avoid deductions.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <Link
                    href={route('faculty.dashboard')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back to Dashboard
                </Link>
            </div>

            <div className="mb-8 relative isolate overflow-hidden rounded-3xl bg-white dark:bg-gray-800/60 p-8 shadow-sm border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-xl">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[#7a1315]/10 to-[#cc2127]/5 blur-3xl transition-transform duration-700" />
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {sourceFilter === 'online' ? 'Online Attendance History' : sourceFilter === 'biometric' ? 'Biometric Attendance History' : 'Attendance Match History'}
                </h1>
                <p className="mt-2 max-w-2xl text-base text-gray-500 dark:text-gray-400">
                    {sourceFilter === 'online'
                        ? 'Your approved online attendance records aligned with your internal work schedule.'
                        : sourceFilter === 'biometric'
                            ? 'Your matched attendance status from raw biometric logs aligned with your internal work schedule.'
                            : 'Your matched attendance status spanning your entire history. This uses your raw biometric logs and approved online attendance aligned with your internal work schedule.'}
                </p>

                {/* Source filter */}
                <div className="mt-5 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source:</span>
                    {[
                        { value: 'all', label: 'All' },
                        { value: 'biometric', label: 'Biometric' },
                        { value: 'online', label: 'Online' },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setSourceFilter(opt.value); setCurrentPage(1); }}
                            className={
                                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ' +
                                (sourceFilter === opt.value
                                    ? 'bg-[#7a1315] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600')
                            }
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredLogs.length}
                perPage={perPage}
                onPageChange={setCurrentPage}
                onPerPageChange={(size) => {
                    setPerPage(size);
                    setCurrentPage(1);
                }}
                showDateRange={true}
                dateRange={dateRange}
                onDateRangeChange={(newRange) => {
                    setDateRange(newRange);
                    setCurrentPage(1);
                }}
                className="px-6 border-t border-gray-200/60 dark:border-slate-700/80"
            />

            {/* ── Summary Panel ────────────────────────────────────────── */}
            <div className="mb-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40 flex justify-between items-center">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        Summary
                        {summaryFilter !== 'all' && (
                            <span className="ml-2 text-[10px] bg-[#7a1315] text-white px-2 py-0.5 rounded-full capitalize">
                                Filtering: {summaryFilter.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                        )}
                    </h2>
                    {summaryFilter !== 'all' && (
                        <button
                            onClick={() => { setSummaryFilter('all'); setCurrentPage(1); }}
                            className="text-[10px] font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors uppercase tracking-wider"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-gray-100 dark:divide-gray-700/50">
                    {[
                        { id: 'absent', label: 'Days Absent', value: summary.daysAbsent, sub: null, color: 'text-red-600 dark:text-red-400' },
                        { id: 'late', label: 'Times Tardy', value: summary.timesLate, sub: fmtMins(summary.totalLateMinutes), color: 'text-amber-600 dark:text-amber-400' },
                        { id: 'undertime', label: 'Under Time', value: summary.timesUndertime, sub: fmtMins(summary.totalUndertimeMinutes), color: 'text-orange-600 dark:text-orange-400' },
                        { id: 'night', label: 'Nights Rendered', value: summary.timesNight, sub: fmtMins(summary.totalNightMinutes), color: 'text-violet-600 dark:text-violet-400' },
                        { id: 'overtime', label: 'Overtime Rendered', value: summary.timesOvertime, sub: fmtMins(summary.totalOvertimeMinutes), color: 'text-emerald-600 dark:text-emerald-400' },
                        { id: 'overtimeNight', label: 'OT Nights', value: summary.timesOvertimeNight, sub: fmtMins(summary.totalOvertimeNightMinutes), color: 'text-indigo-600 dark:text-indigo-400' },
                    ].map(({ id, label, value, sub, color }) => (
                        <div
                            key={id}
                            onClick={() => { setSummaryFilter(summaryFilter === id ? 'all' : id); setCurrentPage(1); }}
                            className={`px-4 py-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-slate-700/40 relative group ${summaryFilter === id ? 'bg-gray-50/80 dark:bg-slate-700/60 ring-inset ring-2 ring-gray-200 dark:ring-slate-600' : ''}`}
                            title={`Click to filter table by ${label}`}
                        >
                            {summaryFilter === id && (
                                <div className="absolute top-2 right-2 flex space-x-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7a1315] dark:bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7a1315] dark:bg-red-500"></span>
                                    </span>
                                </div>
                            )}
                            <p className={`text-xs font-semibold leading-tight transition-colors ${summaryFilter === id ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>{label}</p>
                            <p className={`mt-1 text-2xl font-extrabold tabular-nums transition-transform duration-300 group-hover:scale-105 origin-left ${color}`}>{value}</p>
                            {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">({sub})</p>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/80 shadow-sm ring-1 ring-gray-900/5 sm:rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700/80">
                        <thead className="bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Date
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Subject
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Schedule (In - Out)
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Actual (In - Out)
                                </th>
                                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Deductions & Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-widest">
                                    Rendered
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700/80 bg-transparent">
                            {paginatedLogs.length > 0 ? (
                                paginatedLogs.map((log, index) => (
                                    <tr key={index} className="transition-all duration-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 group">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                                            <div className="font-bold text-gray-900 dark:text-white group-hover:text-[#7a1315] dark:group-hover:text-red-400 transition-colors">{log.date}</div>
                                            <div className="text-xs text-gray-500 dark:text-slate-400">{log.dayOfWeek}</div>
                                        </td>
                                        {/* Subject column */}
                                        <td className="px-6 py-4 text-sm">
                                            {log.subjects && log.subjects.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {log.subjects.map((s, i) => (
                                                        <div key={i}>
                                                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-300/50 dark:ring-amber-500/30 ${!s.code ? 'hidden' : ''}`}>
                                                                {s.code}
                                                            </span>
                                                            {s.desc && (
                                                                <div className="mt-0.5 text-[11px] text-gray-900 dark:text-white leading-tight" title={s.desc}>
                                                                    {s.desc}
                                                                </div>
                                                            )}
                                                            {(s.program_code || s.year_level || s.section_name) && (
                                                                <div className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-500">
                                                                    {[s.program_code, (s.year_level || s.section_name) ? [s.year_level, s.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 dark:text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wider ring-1 ring-inset ${statusStyle(log.status)}`}>
                                                    {log.status}
                                                </span>
                                                {log.online_attendance && (
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30">
                                                        Online
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-600 dark:text-slate-300">
                                            {log.expected_time_in} <span className="text-gray-300 dark:text-slate-500 mx-1">-</span> {log.expected_time_out}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                                            <span className={log.late_minutes > 0 ? 'text-amber-600 dark:text-amber-400' : (!log.actual_time_in || log.actual_time_in === '--:--' ? (log.is_holiday ? 'text-gray-400' : 'text-rose-500 animate-pulse') : '')}>
                                                {log.actual_time_in}
                                            </span>
                                            <span className="text-gray-300 dark:text-slate-500 mx-1">-</span>
                                            <span className={log.undertime_minutes > 0 ? 'text-red-600 dark:text-red-400' : (!log.actual_time_out || log.actual_time_out === '--:--' ? (log.is_holiday ? 'text-gray-400' : 'text-rose-500 animate-pulse') : '')}>
                                                {log.actual_time_out}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-center">
                                            {(log.late_minutes === 0 && log.undertime_minutes === 0 && (log.is_holiday || (log.actual_time_in !== '--:--' && log.actual_time_out !== '--:--'))) ? (
                                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15" />
                                                    </svg>
                                                </span>
                                            ) : (
                                                <div className="flex flex-col gap-1 items-center">
                                                    {log.late_minutes > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">{fmtMins(log.late_minutes)} Late</span>}
                                                    {log.undertime_minutes > 0 && log.status !== 'ABSENT' && (log.actual_time_in !== '--:--' || log.actual_time_out !== '--:--') && (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300">{fmtMins(log.undertime_minutes)} Early</span>
                                                            {!log.is_holiday && (log.undertime_status ? (
                                                                <button type="button" disabled className={`mt-0.5 group flex items-center gap-1 text-[11px] font-extrabold uppercase transition-colors ${log.undertime_status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : log.undertime_status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                    <span>{log.undertime_status}</span>
                                                                    <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                                                    </svg>
                                                                </button>
                                                            ) : (
                                                                <Link href={route('faculty.undertime-requests.index')} className="mt-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors flex items-center gap-1">
                                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                                    </svg>
                                                                    Request Undertime
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!log.is_holiday && (log.actual_time_in === '--:--' || log.actual_time_out === '--:--') && (
                                                        <div className="flex flex-col items-center gap-1 mt-1">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300">
                                                                Missing {log.actual_time_in === '--:--' ? 'In' : ''}{log.actual_time_in === '--:--' && log.actual_time_out === '--:--' ? ' & ' : ''}{log.actual_time_out === '--:--' ? 'Out' : ''}
                                                            </span>
                                                            {log.missing_time_status ? (
                                                                <button type="button" onClick={() => openMissingTimeModal(log)} className={`mt-0.5 group flex items-center gap-1 text-[11px] font-extrabold uppercase transition-colors ${log.missing_time_status === 'approved' ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-800' : log.missing_time_status === 'rejected' ? 'text-red-600 dark:text-red-400 hover:text-red-800' : 'text-amber-600 dark:text-amber-400 hover:text-amber-800'}`}>
                                                                    <span>{log.missing_time_status}</span>
                                                                    <svg className="h-3 w-3 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                                                    </svg>
                                                                </button>
                                                            ) : (
                                                                <button type="button" onClick={() => openMissingTimeModal(log)} className="mt-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline transition-colors flex items-center gap-1">
                                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                                    </svg>
                                                                    Justify Missing Time
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <div className="inline-flex items-baseline gap-1 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200/50 dark:border-slate-700/50">
                                                <span className="text-sm font-black text-gray-900 dark:text-white drop-shadow-sm">{log.total_hours}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-gray-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 dark:bg-slate-800 ring-1 ring-gray-100 dark:ring-slate-700 mb-4">
                                                <svg className="h-8 w-8 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                            </div>
                                            <h3 className="mt-2 text-base font-bold text-gray-900 dark:text-white">
                                                {summaryFilter !== 'all'
                                                    ? `No ${summaryFilter.replace(/([A-Z])/g, ' $1').trim().replace(/^[a-z]/, m => m.toUpperCase())} Records`
                                                    : sourceFilter === 'online'
                                                        ? 'No Online Attendance'
                                                        : sourceFilter === 'biometric'
                                                            ? 'No Biometric Records'
                                                            : 'No Attendance Records'
                                                }
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-sm">
                                                {summaryFilter !== 'all'
                                                    ? `You don't have any records matching the "${summaryFilter.replace(/([A-Z])/g, ' $1').trim()}" filter for this period.`
                                                    : sourceFilter === 'online'
                                                        ? 'You don\'t have any approved online attendance records for this period.'
                                                        : sourceFilter === 'biometric'
                                                            ? 'You don\'t have any matched schedules mapped to your biometrics for this period.'
                                                            : 'You don\'t have any attendance records for this period.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredLogs.length}
                    perPage={perPage}
                    onPageChange={setCurrentPage}
                    onPerPageChange={(size) => {
                        setPerPage(size);
                        setCurrentPage(1);
                    }}
                    showDateRange={true}
                    dateRange={dateRange}
                    onDateRangeChange={(newRange) => {
                        setDateRange(newRange);
                        setCurrentPage(1);
                    }}
                    className="px-6 border-t border-gray-200/60 dark:border-slate-700/80"
                />

            </div>

            {/* Missing Time Justification Modal */}
            <Modal show={showMissingTimeModal} onClose={() => setShowMissingTimeModal(false)} maxWidth="md">
                <form onSubmit={submitMissingTimeJustification} className="p-6">
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mt-2">
                        {!canEditJustification(selectedMissingTimeLog, 'missing_time')
                            ? 'View Justification'
                            : (selectedMissingTimeLog?.missing_time_status ? 'Edit Justification' : 'Justify Missing Time')}
                    </h2>
                    {selectedMissingTimeLog && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            You have missing logs (<span className="font-bold text-rose-600 dark:text-rose-400">{selectedMissingTimeLog.actual_time_in === '--:--' ? 'Time In' : ''}{selectedMissingTimeLog.actual_time_in === '--:--' && selectedMissingTimeLog.actual_time_out === '--:--' ? ' and ' : ''}{selectedMissingTimeLog.actual_time_out === '--:--' ? 'Time Out' : ''}</span>) on <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedMissingTimeLog.date}</span>.
                            {canEditJustification(selectedMissingTimeLog, 'missing_time') && !selectedMissingTimeLog?.missing_time_status && ' Please provide a reason to request approval from the Head of Academic Program.'}
                            {canEditJustification(selectedMissingTimeLog, 'missing_time') && selectedMissingTimeLog?.missing_time_status === 'pending' && <span className="block mt-1 font-medium text-amber-600 dark:text-amber-500">You can edit your justification for up to 15 minutes after submitting.</span>}
                        </p>
                    )}

                    <div className="mt-6">
                        <InputLabel value="Reason / Justification" htmlFor="justification" className="mb-2" />
                        <textarea
                            id="justification"
                            rows={4}
                            className={`block w-full rounded-xl shadow-sm sm:text-sm resize-none ${!canEditJustification(selectedMissingTimeLog, 'missing_time') ? 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 focus:border-transparent focus:ring-0 cursor-not-allowed' : 'border-gray-300 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                            placeholder="Briefly explain why logs are missing..."
                            value={missingTimeForm.data.justification}
                            onChange={(e) => missingTimeForm.setData('justification', e.target.value)}
                            readOnly={!canEditJustification(selectedMissingTimeLog, 'missing_time')}
                        />
                        <InputError message={missingTimeForm.errors.justification} className="mt-2" />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setShowMissingTimeModal(false)}>
                            {!canEditJustification(selectedMissingTimeLog, 'missing_time') ? 'Close' : 'Cancel'}
                        </SecondaryButton>
                        {canEditJustification(selectedMissingTimeLog, 'missing_time') && (
                            <PrimaryButton disabled={missingTimeForm.processing}>
                                {missingTimeForm.processing ? 'Submitting...' : (selectedMissingTimeLog?.missing_time_status ? 'Update Justification' : 'Submit Justification')}
                            </PrimaryButton>
                        )}
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
