import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/Pagination';
import Modal from '@/Components/Modal';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { Head, router, useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { useMemo, useRef, useState } from 'react';

const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300',
    processing: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-300',
    failed: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300',
};

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
            {status}
        </span>
    );
}

function formatDateTime(value) {
    if (!value) return '—';

    const parsedDate = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) return '—';

    return parsedDate.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDate(value) {
    if (!value) return '—';

    const parsedDate = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) return '—';

    return parsedDate.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}

function formatTime(value) {
    if (!value) return '—';

    const parsedDate = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) return '—';

    return parsedDate.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatLogType(type) {
    const normalizedType = String(type ?? '').trim().toLowerCase();

    if (normalizedType.includes('out')) return 'Time Out';
    if (normalizedType.includes('in')) return 'Time In';

    return type || '—';
}

export default function AttendanceImports({ batches, filters }) {
    const form = useForm({
        file: null,
    });
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchDetails, setBatchDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [syncing, setSyncing] = useState(false);
    const syncTargetRef = useRef(null);

    const currentPage = useMemo(() => Number(batches?.current_page ?? 1), [batches]);
    const perPage = useMemo(() => Number(filters?.per_page ?? batches?.per_page ?? 10), [filters, batches]);

    const submit = (event) => {
        event.preventDefault();

        form.post(route('admin.attendance-imports.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset('file'),
        });
    };

    const handlePageChange = (page) => {
        router.get(
            route('admin.attendance-imports.index'),
            { page, per_page: perPage },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const handlePerPageChange = (nextPerPage) => {
        router.get(
            route('admin.attendance-imports.index'),
            { page: 1, per_page: nextPerPage },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const loadBatchDetails = async (batch) => {
        setSelectedBatch(batch);
        setShowDetailsModal(true);
        setDetailsLoading(true);
        setDetailsError('');
        setBatchDetails(null);

        try {
            const { data } = await window.axios.get(route('admin.attendance-imports.details', batch.id));
            setBatchDetails(data);
        } catch (error) {
            setDetailsError('Failed to load import details. Please try again.');
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetailsModal = () => {
        setShowDetailsModal(false);
        setShowSyncModal(false);
        setSelectedBatch(null);
        setBatchDetails(null);
        setDetailsError('');
    };

    const syncBatch = async (batchOverride) => {
        const batch = batchOverride ?? selectedBatch;

        if (!batch || syncing) {
            return;
        }

        setSyncing(true);

        try {
            const { data } = await window.axios.patch(route('admin.attendance-imports.sync', batch.id));

            setShowSyncModal(false);
            toast.success(data?.message ?? 'Logs synced successfully.');

            await loadBatchDetails(batch);
            router.reload({ only: ['batches'], preserveState: true, preserveScroll: true });
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || 'Failed to sync. Please try again.');
        } finally {
            setSyncing(false);
        }
    };

    const unsyncedLogsCount = Number(batchDetails?.batch?.unsynced_logs ?? 0);
    const unrecognizedLogsCount = Number(batchDetails?.batch?.unrecognized_logs ?? 0);
    // Logs that are unsynced AND have a recognized faculty (can actually be synced).
    const syncableLogsCount = Math.max(0, unsyncedLogsCount - unrecognizedLogsCount);

    return (
        <AuthenticatedLayout
            header={
                <div className="w-full flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Attendance Log Import
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Upload faculty biometric logs, save batch details, and insert records into biometric logs.
                        </p>
                    </div>
                    <a
                        href={route('admin.attendance-imports.template')}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Download Template
                    </a>
                </div>
            }
        >
            <Head title="Attendance Log Import" />

            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import CSV/XLSX File</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Required columns: biometric_id, log_datetime, log_type. Optional: device_id.
                    </p>

                    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <label htmlFor="biometric-log-file" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                                CSV or Excel File
                            </label>
                            <input
                                id="biometric-log-file"
                                type="file"
                                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)}
                                className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700 dark:file:bg-gray-600 dark:file:text-gray-100"
                            />
                            <InputError message={form.errors.file} className="mt-1" />
                        </div>

                        <PrimaryButton type="submit" disabled={form.processing || !form.data.file}>
                            {form.processing ? 'Importing…' : 'Import Logs'}
                        </PrimaryButton>
                    </form>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Batches</h2>

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[920px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    <th className="py-3 pr-3">File</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3 text-right">Total</th>
                                    <th className="py-3 px-3 text-right">Processed</th>
                                    <th className="py-3 px-3 text-right">Failed</th>
                                    <th className="py-3 px-3 text-right">Duplicates</th>
                                    <th className="py-3 px-3">Started</th>
                                    <th className="py-3 px-3">Completed</th>
                                    <th className="py-3 pl-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches?.data?.length > 0 ? (
                                    batches.data.map((batch) => (
                                        <tr key={batch.id} className="border-b border-gray-100 dark:border-gray-700/80 text-gray-700 dark:text-gray-200">
                                            <td className="py-3 pr-3 align-top">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">{batch.file_name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Imported by: {batch.importedBy?.email ?? 'System'}
                                                </p>
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                <StatusBadge status={batch.status} />
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">{batch.total_records}</td>
                                            <td className="py-3 px-3 text-right align-top">{batch.processed_records}</td>
                                            <td className="py-3 px-3 text-right align-top">{batch.failed_records}</td>
                                            <td className="py-3 px-3 text-right align-top">{batch.duplicate_records}</td>
                                            <td className="py-3 px-3 align-top">{formatDateTime(batch.started_at)}</td>
                                            <td className="py-3 px-3 align-top">
                                                {formatDateTime(batch.completed_at)}
                                                {batch.status === 'failed' && batch.error_log && (
                                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400 whitespace-pre-line">
                                                        {batch.error_log}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 pl-3 text-right align-top">
                                                {batch.status !== 'failed' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => loadBatchDetails(batch)}
                                                        className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        View Details
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            No import batches yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalItems={Number(batches?.total ?? 0)}
                        perPage={Number(perPage)}
                        onPageChange={handlePageChange}
                        onPerPageChange={handlePerPageChange}
                        perPageOptions={[5, 10, 25, 50]}
                    />
                </div>
            </div>

            <Modal show={showDetailsModal} onClose={() => { if (!showSyncModal) closeDetailsModal(); }} maxWidth="4xl">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import Details</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {selectedBatch?.file_name ?? '—'}
                            </p>
                        </div>
                        {selectedBatch && <StatusBadge status={selectedBatch.status} />}
                    </div>
                </div>

                <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
                    {detailsLoading && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading batch logs...</p>
                    )}

                    {!detailsLoading && detailsError && (
                        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
                            {detailsError}
                        </div>
                    )}

                    {!detailsLoading && !detailsError && batchDetails && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Logs</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{batchDetails.batch?.total_logs ?? 0}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Synced</p>
                                    <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">{batchDetails.batch?.synced_logs ?? 0}</p>
                                </div>
                                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider">Not Synced</p>
                                    <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300">{batchDetails.batch?.unsynced_logs ?? 0}</p>
                                </div>
                                <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3">
                                    <p className="text-xs text-red-700 dark:text-red-400 uppercase tracking-wider">Unrecognized IDs</p>
                                    <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-300">{batchDetails.batch?.unrecognized_logs ?? 0}</p>
                                </div>
                            </div>

                            {(batchDetails.batch?.unrecognized_logs ?? 0) > 0 && (
                                <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                                    <span className="font-semibold">{batchDetails.batch.unrecognized_logs}</span> log {batchDetails.batch.unrecognized_logs === 1 ? 'entry has' : 'entries have'} a biometric ID that does not exist in the system. These entries are saved as an audit trail but will not be synced to attendance records until the faculty is registered.
                                </div>
                            )}

                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                <table className="w-full min-w-[780px] text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <th className="py-3 px-3">Faculty</th>
                                            <th className="py-3 px-3">Date</th>
                                            <th className="py-3 px-3">Time</th>
                                            <th className="py-3 px-3">Type</th>
                                            <th className="py-3 px-3">ID Status</th>
                                            <th className="py-3 px-3">Synced</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchDetails.logs?.data?.length > 0 ? (
                                            batchDetails.logs.data.map((log) => (
                                                <tr key={log.id} className={`border-b border-gray-100 dark:border-gray-700/80 text-gray-700 dark:text-gray-200 ${!log.faculty_exists ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                                                    <td className="py-3 px-3 align-top">
                                                        {log.faculty_exists ? (
                                                            <>
                                                                <p className="font-semibold text-gray-800 dark:text-gray-100">{log.faculty_name}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{log.biometric_id}</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold text-red-700 dark:text-red-400">{log.biometric_id}</p>
                                                                <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">Not found in system</p>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 align-top">{formatDate(log.log_datetime)}</td>
                                                    <td className="py-3 px-3 align-top">{formatTime(log.log_datetime)}</td>
                                                    <td className="py-3 px-3 align-top">{formatLogType(log.log_type)}</td>
                                                    <td className="py-3 px-3 align-top">
                                                        {log.faculty_exists ? (
                                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                                Recognized
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300">
                                                                Unknown ID
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 align-top">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${log.is_processed
                                                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            : 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300'
                                                            }`}
                                                        >
                                                            {log.is_processed ? 'Synced' : 'Not Synced'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    No biometric logs found for this batch.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {batchDetails.logs?.last_page > 1 && (
                                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                        Showing {batchDetails.logs.from ?? 0}–{batchDetails.logs.to ?? 0} of {batchDetails.logs.total} logs.
                                    </p>
                                )}
                            </div>

                            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Logs</h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Sync this batch to mark all remaining unsynced logs as synced.
                                </p>

                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {syncableLogsCount > 0
                                            ? <>Ready to sync <span className="font-semibold">{syncableLogsCount}</span> log {syncableLogsCount === 1 ? 'entry' : 'entries'}.</>
                                            : (unrecognizedLogsCount > 0
                                                ? 'All recognized logs in this batch have been synced.'
                                                : 'All logs in this batch are already synced.')}
                                    </p>

                                    <PrimaryButton
                                        type="button"
                                        onClick={() => {
                                            syncTargetRef.current = selectedBatch;
                                            setShowSyncModal(true);
                                        }}
                                        disabled={syncing}
                                    >
                                        Sync Logs
                                    </PrimaryButton>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <SecondaryButton onClick={closeDetailsModal}>Close</SecondaryButton>
                </div>
            </Modal>

            <Modal show={showSyncModal} onClose={() => !syncing && setShowSyncModal(false)} maxWidth="md">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Sync</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        This will sync the remaining logs in this import batch.
                    </p>
                </div>

                <div className="px-6 py-5">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        {syncableLogsCount > 0
                            ? <>Sync <span className="font-semibold">{syncableLogsCount}</span> unsynced log {syncableLogsCount === 1 ? 'entry' : 'entries'} now?</>
                            : (unrecognizedLogsCount > 0
                                ? 'No syncable logs remaining. Unrecognized entries cannot be synced.'
                                : 'No unsynced logs were found. You can still continue to verify the batch status.')}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                    <SecondaryButton onClick={() => setShowSyncModal(false)} disabled={syncing}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={() => syncBatch(syncTargetRef.current)} disabled={syncing}>
                        {syncing ? 'Syncing…' : 'Sync Now'}
                    </PrimaryButton>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
