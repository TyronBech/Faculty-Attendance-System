import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DtrSummary, DtrTimeLog } from '@/Components/Dtr/DtrPreviewContent';

const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

export default function DtrPrint({ faculty, dtrExportDefaults = {}, dtrExportYears = [] }) {
    const initialMonth = dtrExportDefaults.month ?? new Date().getMonth() + 1;
    const initialYear = dtrExportDefaults.year ?? new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [selectedYear, setSelectedYear] = useState(initialYear);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [exportStatusText, setExportStatusText] = useState('');
    const [timeMode, setTimeMode] = useState('official');

    useEffect(() => {
        loadPreview(initialMonth, initialYear);
    }, []);

    useEffect(() => {
        setTimeMode('official');
    }, [preview]);

    const loadPreview = async (month = selectedMonth, year = selectedYear) => {
        setLoading(true);

        try {
            const response = await axios.get(route('faculty.dtr.preview'), {
                params: { month, year },
            });

            setPreview(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load your DTR preview.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (downloading) {
            return;
        }

        setDownloading(true);
        setExportStatusText('Queued for export...');

        try {
            const dispatchResponse = await axios.post(route('faculty.dtr.dispatch'), {
                month: selectedMonth,
                year: selectedYear,
            });

            const { token, fileName } = dispatchResponse.data;
            toast.success('DTR export started. Your download will begin shortly.');

            let attempts = 0;
            const poll = window.setInterval(async () => {
                try {
                    attempts += 1;
                    setExportStatusText(attempts < 4 ? 'Queued for export...' : 'Generating PDF in background...');

                    const statusResponse = await axios.get(route('faculty.dtr.status'), {
                        params: { token, extension: 'pdf' },
                    });

                    if (!statusResponse.data.ready) {
                        return;
                    }

                    window.clearInterval(poll);

                    const downloadUrl = route('faculty.dtr.download-file', {
                        token,
                        fileName,
                        extension: 'pdf',
                    });

                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();

                    setDownloading(false);
                    setExportStatusText('');
                    toast.success('Your DTR PDF is downloading.');
                } catch {
                }
            }, 1500);

            window.setTimeout(() => {
                window.clearInterval(poll);
                setDownloading(false);
                setExportStatusText('');
            }, 60000);
        } catch (error) {
            console.error(error);
            setDownloading(false);
            setExportStatusText('');
            toast.error('Failed to start DTR export.');
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="My DTR" />

            <div className="mb-8">
                <Link
                    href={route('faculty.attendance')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back to Attendance
                </Link>
            </div>

            <section className="relative isolate overflow-hidden rounded-3xl border border-gray-200/60 bg-white p-8 shadow-sm dark:border-gray-700/60 dark:bg-gray-800/80">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#7a1315]/15 to-[#cc2127]/5 blur-3xl" />

                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#7a1315] dark:text-red-400">
                            Monthly DTR
                        </p>
                        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                            Print your own Daily Time Record
                        </h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Review your monthly DTR for {faculty?.full_name ?? 'your account'} and export the PDF when you are ready.
                        </p>
                        <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900/60">
                            <span className="font-semibold text-gray-900 dark:text-white">{faculty?.full_name ?? 'Faculty Member'}</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="text-gray-500 dark:text-gray-400">{faculty?.department ?? 'N/A'}</span>
                        </div>
                    </div>

                    <div className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/60 lg:max-w-xl">
                        <div className="grid gap-3 md:grid-cols-2">
                            <select
                                value={selectedMonth}
                                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                                className="rounded-xl border border-gray-300 bg-white text-sm text-gray-800 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                                {monthOptions.map((month) => (
                                    <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedYear}
                                onChange={(event) => setSelectedYear(Number(event.target.value))}
                                className="rounded-xl border border-gray-300 bg-white text-sm text-gray-800 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                                {dtrExportYears.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => loadPreview()}
                                disabled={loading}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
                            >
                                {loading ? 'Loading...' : 'Preview DTR'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={loading || downloading || !preview}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {downloading ? 'Generating...' : 'Download PDF'}
                            </button>
                        </div>

                        {downloading && (
                            <div className="mt-3">
                                <div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                    {exportStatusText}
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#7a1315] to-[#cc2127]" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="mt-8 rounded-3xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800/80">
                <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {preview?.periodLabel ?? 'DTR Preview'}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Official and actual logs are shown side by side through the mode switch below.
                            </p>
                        </div>
                        {preview?.faculty && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {preview.faculty.full_name}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <svg className="h-8 w-8 animate-spin text-[#7a1315]" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Loading preview...</span>
                        </div>
                    ) : preview ? (
                        <div className="space-y-6">
                            <DtrSummary summary={preview.summary} />
                            <DtrTimeLog
                                rows={preview.rows}
                                totalHours={preview.summary?.totalHoursRendered ?? 0}
                                mode={timeMode}
                                onModeChange={setTimeMode}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No preview loaded yet</h3>
                            <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                                Pick the month and year you want, then load the preview to review your DTR before downloading it.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </AuthenticatedLayout>
    );
}
