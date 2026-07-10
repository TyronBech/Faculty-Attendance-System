import Pagination from "@/Components/Pagination";
import { DtrSummary, DtrTimeLog } from "@/Components/Dtr/DtrPreviewContent";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, useForm } from "@inertiajs/react";
import axios from "axios";
import { useState } from "react";

const statusStyles = {
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    rejected: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/30",
};

function formatMinutes(minutes) {
    const value = Number(minutes ?? 0);

    return value > 0 ? `${value} min` : "-";
}

function formatHours(hours) {
    return `${Number(hours ?? 0).toFixed(2)} hrs`;
}

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${
                statusStyles[status] ?? statusStyles.pending
            }`}
        >
            {status}
        </span>
    );
}

function SummaryCard({ label, value, tone, active = false, onClick }) {
    const tones = {
        amber: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
        green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
        red: "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300",
        blue: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7a1315] hover:shadow-md dark:bg-gray-800 ${
                active
                    ? "border-[#7a1315] ring-2 ring-[#7a1315]/20 dark:border-red-500 dark:ring-red-500/20"
                    : "border-gray-200 dark:border-gray-700"
            }`}
        >
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
            </p>
            <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-black ${tones[tone]}`}>
                {value}
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {active ? "Active filter" : "Click to filter"}
            </p>
        </button>
    );
}

function ScheduleCards({ schedules = [] }) {
    return (
        <aside className="space-y-3">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Faculty Schedule
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Official classes for the selected semester.
                </p>
            </div>

            {schedules.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    No schedule details found for this period.
                </div>
            ) : (
                schedules.map((schedule) => (
                    <div
                        key={schedule.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                    {schedule.courseCode}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {schedule.section}
                                </p>
                            </div>
                            {schedule.program && (
                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-[#7a1315] dark:bg-red-900/20 dark:text-red-300">
                                    {schedule.program}
                                </span>
                            )}
                        </div>
                        <p className="mt-3 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                            {schedule.courseTitle}
                        </p>
                        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            <p>{schedule.day}</p>
                            <p>{schedule.time}</p>
                            {schedule.room && (
                                <p className="mt-1 text-gray-500 dark:text-gray-400">
                                    Room {schedule.room}
                                </p>
                            )}
                        </div>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            {schedule.semester}
                        </p>
                    </div>
                ))
            )}
        </aside>
    );
}

function DtrComparisonModal({ record, preview, loading, onClose }) {
    if (!record) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button
                type="button"
                aria-label="Close DTR preview"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-10 flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-6 py-4 dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            DTR Preview
                        </h2>
                        <p className="text-sm text-white/75">
                            {record.faculty} · {record.period}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <svg className="h-8 w-8 animate-spin text-[#7a1315]" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                                Loading DTR preview...
                            </span>
                        </div>
                    ) : preview ? (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                            <div className="space-y-6">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                                    Review the official DTR preview against the faculty schedule cards on the side before approving or rejecting.
                                </div>
                                <DtrSummary summary={preview.summary} />
                                <DtrTimeLog
                                    rows={preview.rows ?? []}
                                    totalHours={preview.summary?.totalHoursRendered ?? 0}
                                    mode="official"
                                    onModeChange={() => {}}
                                    showModeToggle={false}
                                />
                            </div>
                            <ScheduleCards schedules={record.scheduleCards ?? []} />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                            Unable to load DTR comparison preview.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function HrDtrReview({
    dtrs,
    filters = {},
    stats = {},
    periodOptions = {},
}) {
    const [filterData, setFilterData] = useState({
        status: filters.status ?? "pending",
        search: filters.search ?? "",
        month: filters.month ?? "",
        year: filters.year ?? "",
    });

    const actionForm = useForm({});
    const [previewRecord, setPreviewRecord] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const updateFilter = (key, value) => {
        setFilterData((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route("admin.hr.dtrs.index"), filterData, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        const defaults = {
            status: "pending",
            search: "",
            month: "",
            year: "",
        };

        setFilterData(defaults);
        router.get(route("admin.hr.dtrs.index"), defaults, {
            preserveScroll: true,
            replace: true,
        });
    };

    const applyStatusFilter = (status) => {
        const nextFilters = {
            ...filterData,
            status,
        };

        setFilterData(nextFilters);
        router.get(route("admin.hr.dtrs.index"), nextFilters, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const approveDtr = (record) => {
        if (!window.confirm(`Approve ${record.faculty}'s ${record.period} DTR?`)) {
            return;
        }

        actionForm.patch(route("admin.hr.dtrs.approve", record.id), {
            preserveScroll: true,
        });
    };

    const rejectDtr = (record) => {
        if (!window.confirm(`Reject ${record.faculty}'s ${record.period} DTR?`)) {
            return;
        }

        actionForm.patch(route("admin.hr.dtrs.reject", record.id), {
            preserveScroll: true,
        });
    };

    const openPreview = (record) => {
        setPreviewRecord(record);
        setPreviewData(null);
        setPreviewLoading(true);

        axios
            .get(route("admin.dtr-export.preview"), {
                params: {
                    faculty_id: record.facultyId,
                    month: record.month,
                    year: record.year,
                    start_day: record.startDay,
                    end_day: record.endDay,
                },
            })
            .then((response) => setPreviewData(response.data))
            .catch(() => setPreviewData(null))
            .finally(() => setPreviewLoading(false));
    };

    const closePreview = () => {
        setPreviewRecord(null);
        setPreviewData(null);
        setPreviewLoading(false);
    };

    return (
        <AuthenticatedLayout>
            <Head title="HR DTR Review" />

            <section className="rounded-3xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] p-6 text-white shadow-lg shadow-red-900/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                            HR Module
                        </p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight">
                            DTR Review
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-white/75">
                            Review generated DTR summaries and approve or reject pending records before HR processing.
                        </p>
                    </div>
                    <Link
                        href={route("admin.hr.dashboard")}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#7a1315] shadow-sm transition hover:bg-red-50"
                    >
                        Sync Dashboard
                    </Link>
                </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryCard
                    label="Pending"
                    value={stats.pending ?? 0}
                    tone="amber"
                    active={filterData.status === "pending"}
                    onClick={() => applyStatusFilter("pending")}
                />
                <SummaryCard
                    label="Approved"
                    value={stats.approved ?? 0}
                    tone="green"
                    active={filterData.status === "approved"}
                    onClick={() => applyStatusFilter("approved")}
                />
                <SummaryCard
                    label="Rejected"
                    value={stats.rejected ?? 0}
                    tone="red"
                    active={filterData.status === "rejected"}
                    onClick={() => applyStatusFilter("rejected")}
                />
            </section>

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <form
                    onSubmit={applyFilters}
                    className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]"
                >
                    <input
                        type="search"
                        value={filterData.search}
                        onChange={(event) => updateFilter("search", event.target.value)}
                        placeholder="Search faculty name or code"
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <select
                        value={filterData.status}
                        onChange={(event) => updateFilter("status", event.target.value)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select
                        value={filterData.month}
                        onChange={(event) => updateFilter("month", event.target.value)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                        <option value="">All months</option>
                        {(periodOptions.months ?? []).map((month) => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filterData.year}
                        onChange={(event) => updateFilter("year", event.target.value)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                        <option value="">All years</option>
                        {(periodOptions.years ?? []).map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5f0e10]"
                        >
                            Filter
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </section>

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Faculty</th>
                                <th className="px-4 py-3 text-left font-semibold">Period</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold">Attendance</th>
                                <th className="px-4 py-3 text-left font-semibold">Late</th>
                                <th className="px-4 py-3 text-left font-semibold">Undertime</th>
                                <th className="px-4 py-3 text-left font-semibold">Hours</th>
                                <th className="px-4 py-3 text-left font-semibold">Generated</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(dtrs.data ?? []).length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        No DTR records found.
                                    </td>
                                </tr>
                            ) : (
                                dtrs.data.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {record.faculty}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {record.facultyCode} · {record.department}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            {record.period}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={record.status} />
                                            {record.approvedAt && (
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {record.approvedAt}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            <div>{record.daysPresent} present</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {record.daysAbsent} absent · {record.daysLate} late
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-amber-700 dark:text-amber-300">
                                            {formatMinutes(record.lateMinutes)}
                                        </td>
                                        <td className="px-4 py-3 text-orange-700 dark:text-orange-300">
                                            {formatMinutes(record.undertimeMinutes)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            <div>{formatHours(record.hoursRendered)}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Required {formatHours(record.hoursRequired)}
                                            </div>
                                            {Number(record.overtimeMinutes ?? 0) > 0 && (
                                                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                                    OT {formatMinutes(record.overtimeMinutes)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                            {record.generatedAt ?? "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                {record.status === "pending" ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openPreview(record)}
                                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                        >
                                                            View
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => approveDtr(record)}
                                                            disabled={actionForm.processing}
                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => rejectDtr(record)}
                                                            disabled={actionForm.processing}
                                                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openPreview(record)}
                                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                        >
                                                            View
                                                        </button>
                                                        <span className="text-xs font-semibold text-gray-400">
                                                            Reviewed
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {dtrs.links && (
                    <div className="border-t border-gray-100 p-4 dark:border-gray-700">
                        <Pagination links={dtrs.links} />
                    </div>
                )}
            </section>

            <DtrComparisonModal
                record={previewRecord}
                preview={previewData}
                loading={previewLoading}
                onClose={closePreview}
            />
        </AuthenticatedLayout>
    );
}
