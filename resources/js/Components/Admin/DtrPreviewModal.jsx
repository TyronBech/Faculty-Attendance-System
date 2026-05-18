import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { DtrSummary, DtrTimeLog } from '@/Components/Dtr/DtrPreviewContent';

/*
   DTR Preview Modal
   Shows a preview of the DTR data + summary,
   then dispatches a background job to generate PDF.
*/
export default function DtrPreviewModal({ open, onClose, facultyIds = [], month, year, exportType = 'default' }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [exportStatusText, setExportStatusText] = useState('');
    const pollRef = useRef(null);
    const [openIds, setOpenIds] = useState([]);
    const [timeModeByFaculty, setTimeModeByFaculty] = useState({});

    // Fetch preview data when modal opens
    useEffect(() => {
        if (!open || facultyIds.length === 0) return;

        setLoading(true);
        setData(null);

        axios
            .post(route('admin.dtr-export.preview-batch'), {
                faculty_ids: facultyIds,
                month,
                year,
            })
            .then((res) => setData(res.data))
            .catch((err) => {
                console.error(err);
                toast.error('Failed to load DTR preview.');
                onClose();
            })
            .finally(() => setLoading(false));
    }, [open, facultyIds, month, year, onClose]);

    useEffect(() => {
        if (!open || !data?.previews) {
            setOpenIds([]);
            setTimeModeByFaculty({});
            return;
        }

        setOpenIds(data.previews.map((preview) => preview.faculty.id));
        setTimeModeByFaculty(
            Object.fromEntries(
                data.previews.map((preview) => [preview.faculty.id, 'official'])
            )
        );
    }, [open, data]);

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const toggleOpen = (facultyId) => {
        setOpenIds((prev) => (
            prev.includes(facultyId)
                ? prev.filter((id) => id !== facultyId)
                : [...prev, facultyId]
        ));
    };

    const handleDownload = useCallback(async () => {
        if (downloading || facultyIds.length === 0) return;
        setDownloading(true);
        setExportStatusText('Queued for export...');

        try {
            const { data: dispatch } = await axios.post(route('admin.dtr-export.dispatch-batch'), {
                faculty_ids: facultyIds,
                month,
                year,
                export_type: exportType,
            });

            const { token, fileName } = dispatch;
            toast.success('Batch export started. Download will begin shortly...');
            let attempts = 0;

            // Poll for completion
            pollRef.current = setInterval(async () => {
                try {
                    attempts += 1;
                    setExportStatusText(
                        attempts < 4
                            ? 'Queued for export...'
                            : 'Generating ZIP file in background...'
                    );

                    const { data: statusRes } = await axios.get(route('admin.dtr-export.status'), {
                        params: { token, extension: 'zip' },
                    });

                    if (statusRes.ready) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;

                        // Trigger download via hidden link
                        const downloadUrl = route('admin.dtr-export.download-file', {
                            token,
                            fileName,
                            extension: 'zip',
                        });
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();

                        toast.success('ZIP downloaded!');
                        setDownloading(false);
                        setExportStatusText('');
                        onClose();
                    }
                } catch {
                    // keep polling
                }
            }, 1500);

            // Timeout after 60s
            setTimeout(() => {
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setDownloading(false);
                    setExportStatusText('');
                    toast.error('Export is taking too long. Ensure `php artisan queue:work` is running, then try again.');
                }
            }, 60000);
        } catch (err) {
            console.error(err);
            toast.error('Failed to start batch export.');
            setDownloading(false);
            setExportStatusText('');
        }
    }, [downloading, facultyIds, month, year, exportType, onClose]);

    if (!open) return null;

    const previews = data?.previews ?? [];
    const periodLabel = data?.periodLabel ?? '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#7a1315] to-[#cc2127]">
                    <div>
                        <h2 className="text-lg font-bold text-white">DTR Preview</h2>
                        <p className="text-sm text-white/70">
                            {periodLabel}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <svg className="h-8 w-8 animate-spin text-[#7a1315]" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Loading preview...</span>
                        </div>
                    ) : data ? (
                        <div className="space-y-4">
                            {previews.map((preview) => {
                                const isOpen = openIds.includes(preview.faculty.id);

                                return (
                                    <div key={preview.faculty.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => toggleOpen(preview.faculty.id)}
                                            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800 text-left"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {preview.faculty.full_name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {preview.faculty.department}
                                                </p>
                                            </div>
                                            <svg
                                                className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={2}
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isOpen && (
                                            <div className="p-4 space-y-5 bg-white dark:bg-gray-900">
                                                <DtrSummary summary={preview.summary} />
                                                <DtrTimeLog
                                                    rows={preview.rows}
                                                    totalHours={preview.summary?.totalHoursRendered ?? 0}
                                                    mode={timeModeByFaculty[preview.faculty.id] ?? 'official'}
                                                    onModeChange={(mode) => {
                                                        setTimeModeByFaculty((prev) => ({
                                                            ...prev,
                                                            [preview.faculty.id]: mode,
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    {downloading && (
                        <div className="mr-auto min-w-[280px]">
                            <div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                {exportStatusText}
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#7a1315] to-[#cc2127]" />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        disabled={downloading}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={loading || !data || downloading || facultyIds.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {downloading ? (
                            <>
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Export Selected
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
