import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, useForm } from "@inertiajs/react";

function StatCard({ stat }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {stat.label}
            </p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
                {stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {stat.description}
            </p>
        </div>
    );
}

function formatMinutes(minutes) {
    const value = Number(minutes ?? 0);

    return value > 0 ? `${value} min` : "";
}

export default function HrDashboard({
    stats = [],
    syncSettings = {},
    pendingDtrs = [],
}) {
    const settingsForm = useForm({
        sync_days: syncSettings.days ?? [15, 30],
    });
    const syncForm = useForm({
        month: syncSettings.month,
        year: syncSettings.year,
        source: "manual",
    });

    const updateDay = (index, value) => {
        const nextDays = [...settingsForm.data.sync_days];
        nextDays[index] = Number(value);
        settingsForm.setData("sync_days", nextDays);
    };

    const addDay = () => {
        settingsForm.setData("sync_days", [
            ...settingsForm.data.sync_days,
            30,
        ]);
    };

    const removeDay = (index) => {
        settingsForm.setData(
            "sync_days",
            settingsForm.data.sync_days.filter((_, dayIndex) => dayIndex !== index),
        );
    };

    const saveSettings = (event) => {
        event.preventDefault();
        settingsForm.patch(route("admin.hr.dtr-settings.update"), {
            preserveScroll: true,
        });
    };

    const runManualSync = () => {
        syncForm.post(route("admin.hr.dtr-sync"), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="HR DTR Dashboard" />

            <section className="rounded-3xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] p-6 text-white shadow-lg shadow-red-900/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                            HR Module
                        </p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight">
                            Schedule vs DTR Validation
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-white/75">
                            Review pending DTR records, control HR sync days, and manually refresh pending DTRs for the current payroll period.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={runManualSync}
                        disabled={syncForm.processing}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#7a1315] shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {syncForm.processing ? "Syncing..." : "Manual Sync"}
                    </button>
                    <Link
                        href={route("admin.hr.dtrs.index")}
                        className="rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                        Review DTRs
                    </Link>
                </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <StatCard key={stat.label} stat={stat} />
                ))}
            </section>

            <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        HR Sync Settings
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Pending DTRs are prepared on these month days. Default is 15 and 30.
                    </p>

                    <form onSubmit={saveSettings} className="mt-4 space-y-3">
                        {settingsForm.data.sync_days.map((day, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={day}
                                    onChange={(event) => updateDay(index, event.target.value)}
                                    className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    day of month
                                </span>
                                {settingsForm.data.sync_days.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeDay(index)}
                                        className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}

                        {settingsForm.errors.sync_days && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {settingsForm.errors.sync_days}
                            </p>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={addDay}
                                disabled={settingsForm.data.sync_days.length >= 4}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                Add Day
                            </button>
                            <button
                                type="submit"
                                disabled={settingsForm.processing}
                                className="rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Save Settings
                            </button>
                        </div>
                    </form>

                    <div className="mt-5 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        <p>
                            Next sync: <span className="font-semibold">{syncSettings.nextSyncLabel}</span>
                        </p>
                        <p>
                            Today status: <span className="font-semibold">{syncSettings.isDueToday ? "Due today" : "Not due today"}</span>
                        </p>
                        <p>
                            Last sync: <span className="font-semibold">{syncSettings.lastSyncAt ?? "Never"}</span>
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Pending DTR Queue
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Latest pending records generated for HR validation.
                            </p>
                        </div>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#7a1315] dark:bg-red-900/20 dark:text-red-300">
                            {syncSettings.currentPeriod}
                        </span>
                    </div>
                    <div className="mt-3">
                        <Link
                            href={route("admin.hr.dtrs.index")}
                            className="text-sm font-bold text-[#7a1315] hover:text-[#5f0e10] dark:text-red-300 dark:hover:text-red-200"
                        >
                            Open approval page →
                        </Link>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Faculty</th>
                                    <th className="px-4 py-2 text-left font-semibold">Period</th>
                                    <th className="px-4 py-2 text-left font-semibold">Late</th>
                                    <th className="px-4 py-2 text-left font-semibold">Undertime</th>
                                    <th className="px-4 py-2 text-left font-semibold">Generated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {pendingDtrs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            No pending DTR records yet.
                                        </td>
                                    </tr>
                                ) : (
                                    pendingDtrs.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                            <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">
                                                {record.faculty}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                                                {record.period}
                                            </td>
                                            <td className="px-4 py-2 text-amber-700 dark:text-amber-300">
                                                {formatMinutes(record.lateMinutes) || "-"}
                                            </td>
                                            <td className="px-4 py-2 text-orange-700 dark:text-orange-300">
                                                {formatMinutes(record.undertimeMinutes) || "-"}
                                            </td>
                                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                                {record.generatedAt ?? "-"}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </AuthenticatedLayout>
    );
}
