import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/Pagination';
import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

function formatDateTime(value) {
    if (!value) {
        return '—';
    }

    const parsedDate = new Date(String(value).replace(' ', 'T'));

    if (Number.isNaN(parsedDate.getTime())) {
        return '—';
    }

    return parsedDate.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
}

function parsePropertyValue(properties, key) {
    return properties?.[key] ?? properties?.attributes?.[key] ?? null;
}

export default function ActivityLogs({ activityLogs, filters }) {
    const [searchText, setSearchText] = useState(filters?.search ?? '');

    const currentPage = useMemo(() => Number(activityLogs?.current_page ?? 1), [activityLogs]);
    const perPage = useMemo(() => Number(filters?.per_page ?? activityLogs?.per_page ?? 10), [filters, activityLogs]);

    const submitSearch = (event) => {
        event.preventDefault();

        router.get(route('admin.activity-logs.index'), {
            page: 1,
            per_page: perPage,
            search: searchText,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearSearch = () => {
        setSearchText('');

        router.get(route('admin.activity-logs.index'), {
            page: 1,
            per_page: perPage,
            search: '',
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handlePageChange = (page) => {
        router.get(route('admin.activity-logs.index'), {
            page,
            per_page: perPage,
            search: filters?.search ?? '',
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handlePerPageChange = (nextPerPage) => {
        router.get(route('admin.activity-logs.index'), {
            page: 1,
            per_page: nextPerPage,
            search: filters?.search ?? '',
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="w-full flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Activity Logs
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Review action logs from admins and faculty.
                        </p>
                    </div>
                </div>
            )}
        >
            <Head title="Activity Logs" />

            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                    <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <label htmlFor="activity-log-search" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                                Search Logs
                            </label>
                            <input
                                id="activity-log-search"
                                type="text"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="Search description, log name, or model type"
                                className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-[#7a1315] focus:ring-[#7a1315]"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="submit"
                                className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                            >
                                Search
                            </button>
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="inline-flex items-center rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Clear
                            </button>
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    <th className="py-3 pr-3">Date/Time</th>
                                    <th className="py-3 px-3">Action</th>
                                    <th className="py-3 px-3">Route</th>
                                    <th className="py-3 px-3">Method</th>
                                    <th className="py-3 px-3">Actor</th>
                                    <th className="py-3 px-3">Subject</th>
                                    <th className="py-3 pl-3">Log</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activityLogs?.data?.length > 0 ? (
                                    activityLogs.data.map((log) => (
                                        <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700/80 text-gray-700 dark:text-gray-200">
                                            <td className="py-3 pr-3 align-top whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                                            <td className="py-3 px-3 align-top">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">{log.description ?? '—'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{log.event ?? '—'}</p>
                                            </td>
                                            <td className="py-3 px-3 align-top">{parsePropertyValue(log.properties, 'route_name') ?? '—'}</td>
                                            <td className="py-3 px-3 align-top">
                                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-gray-100 text-gray-700 ring-gray-400/20 dark:bg-gray-700 dark:text-gray-200">
                                                    {parsePropertyValue(log.properties, 'method') ?? '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                <p className="font-medium text-gray-800 dark:text-gray-100">{log.causer_name ?? 'System'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{log.causer_type ? `${log.causer_type} #${log.causer_id}` : 'No causer'}</p>
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                <p className="text-gray-700 dark:text-gray-300">{log.subject_type ?? '—'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{log.subject_id ? `ID ${log.subject_id}` : '—'}</p>
                                            </td>
                                            <td className="py-3 pl-3 align-top">
                                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-red-50 text-[#7a1315] ring-[#7a1315]/20 dark:bg-red-900/30 dark:text-red-300">
                                                    {log.log_name ?? 'default'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                            No activity logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalItems={Number(activityLogs?.total ?? 0)}
                        perPage={perPage}
                        onPageChange={handlePageChange}
                        onPerPageChange={handlePerPageChange}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
