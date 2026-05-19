import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import Pagination from "@/Components/Pagination";
import Modal from "@/Components/Modal";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import PrimaryButton from "@/Components/PrimaryButton";
import SecondaryButton from "@/Components/SecondaryButton";
import DangerButton from "@/Components/DangerButton";
import TextInput from "@/Components/TextInput";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import { useMemo, useRef, useState } from "react";
import { PERMISSIONS } from "@/Constants/permissions";
import { hasPermission } from "@/Utils/permissions";

const STATUS_STYLES = {
    pending:
        "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300",
    completed:
        "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300",
};

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
        >
            {status}
        </span>
    );
}

function formatDateTime(value) {
    if (!value) return "—";

    const parsedDate = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(parsedDate.getTime())) return "—";

    return parsedDate.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function formatDate(value) {
    if (!value) return "—";

    const parsedDate = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(parsedDate.getTime())) return "—";

    return parsedDate.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

function formatTime(value) {
    if (!value) return "—";

    const parsedDate = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(parsedDate.getTime())) return "—";

    return parsedDate.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function formatLogType(type) {
    const normalizedType = String(type ?? "")
        .trim()
        .toLowerCase();

    if (normalizedType.includes("out")) return "Time Out";
    if (normalizedType.includes("in")) return "Time In";

    return type || "—";
}

function toDateTimeLocalValue(value) {
    if (!value) return "";

    const [date = "", time = ""] = String(value).split(" ");
    if (!date || !time) return "";

    return `${date}T${time.slice(0, 5)}`;
}

function toDateTimePayload(value) {
    return value ? String(value).replace("T", " ") : "";
}

export default function AttendanceImports({ batches, filters }) {
    const { auth } = usePage().props;
    const permissionList = auth?.permissions ?? [];
    const canImportBiometricLogs = hasPermission(
        permissionList,
        PERMISSIONS.IMPORT_BIOMETRIC_LOGS,
    );
    const canEditBiometricLogs = hasPermission(
        permissionList,
        PERMISSIONS.EDIT_BIOMETRIC_LOGS,
    );
    const canDeleteBiometricLogs = hasPermission(
        permissionList,
        PERMISSIONS.DELETE_BIOMETRIC_LOGS,
    );

    const form = useForm({
        file: null,
    });
    const [editLogForm, setEditLogForm] = useState({
        id: null,
        biometric_id: "",
        log_datetime: "",
        log_type: "IN",
        device_id: "",
    });
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showEditLogModal, setShowEditLogModal] = useState(false);
    const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
    const [showDeleteLogModal, setShowDeleteLogModal] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchToDelete, setBatchToDelete] = useState(null);
    const [batchDetails, setBatchDetails] = useState(null);
    const [logToDelete, setLogToDelete] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");
    const [editLogErrors, setEditLogErrors] = useState({});
    const [savingLog, setSavingLog] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const syncTargetRef = useRef(null);

    const currentPage = useMemo(
        () => Number(batches?.current_page ?? 1),
        [batches],
    );
    const perPage = useMemo(
        () => Number(filters?.per_page ?? batches?.per_page ?? 10),
        [filters, batches],
    );

    const submit = (event) => {
        event.preventDefault();

        form.post(route("admin.attendance-imports.store"), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset("file"),
        });
    };

    const handlePageChange = (page) => {
        router.get(
            route("admin.attendance-imports.index"),
            { page, per_page: perPage },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const handlePerPageChange = (nextPerPage) => {
        router.get(
            route("admin.attendance-imports.index"),
            { page: 1, per_page: nextPerPage },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const loadBatchDetails = async (batch) => {
        setSelectedBatch(batch);
        setShowDetailsModal(true);
        setDetailsLoading(true);
        setDetailsError("");
        setBatchDetails(null);

        try {
            const { data } = await window.axios.get(
                route("admin.attendance-imports.details", batch.id),
            );
            setBatchDetails(data);
        } catch (error) {
            setDetailsError("Failed to load import details. Please try again.");
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetailsModal = () => {
        setShowDetailsModal(false);
        setShowSyncModal(false);
        setShowEditLogModal(false);
        setShowDeleteBatchModal(false);
        setShowDeleteLogModal(false);
        setSelectedBatch(null);
        setBatchToDelete(null);
        setBatchDetails(null);
        setLogToDelete(null);
        setDetailsError("");
        setEditLogErrors({});
        setEditLogForm({
            id: null,
            biometric_id: "",
            log_datetime: "",
            log_type: "IN",
            device_id: "",
        });
    };

    const syncBatch = async (batchOverride) => {
        const batch = batchOverride ?? selectedBatch;

        if (!batch || syncing) {
            return;
        }

        setSyncing(true);

        try {
            const { data } = await window.axios.patch(
                route("admin.attendance-imports.sync", batch.id),
            );

            setShowSyncModal(false);
            toast.success(data?.message ?? "Logs synced successfully.");

            await loadBatchDetails(batch);
            router.reload({
                only: ["batches"],
                preserveState: true,
                preserveScroll: true,
            });
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Failed to sync. Please try again.",
            );
        } finally {
            setSyncing(false);
        }
    };

    const openEditLogModal = (log) => {
        setEditLogErrors({});
        setEditLogForm({
            id: log.id,
            biometric_id: log.biometric_id ?? "",
            log_datetime: toDateTimeLocalValue(log.log_datetime),
            log_type: String(log.log_type ?? "")
                .toUpperCase()
                .includes("OUT")
                ? "OUT"
                : "IN",
            device_id: log.device_id ?? "",
        });
        setShowEditLogModal(true);
    };

    const closeEditLogModal = () => {
        if (savingLog) {
            return;
        }

        setShowEditLogModal(false);
        setEditLogErrors({});
    };

    const openDeleteBatchModal = (batchOverride) => {
        const batch = batchOverride ?? selectedBatch;

        if (!batch) {
            return;
        }

        setBatchToDelete(batch);
        setShowDeleteBatchModal(true);
    };

    const closeDeleteBatchModal = () => {
        if (deleting) {
            return;
        }

        setShowDeleteBatchModal(false);
        setBatchToDelete(null);
    };

    const openDeleteLogModal = (log) => {
        if (!log) {
            return;
        }

        setLogToDelete(log);
        setShowDeleteLogModal(true);
    };

    const closeDeleteLogModal = () => {
        if (deleting) {
            return;
        }

        setShowDeleteLogModal(false);
        setLogToDelete(null);
    };

    const saveEditedLog = async () => {
        if (!selectedBatch || !editLogForm.id || savingLog) {
            return;
        }

        setSavingLog(true);
        setEditLogErrors({});

        try {
            const { data } = await window.axios.patch(
                route("admin.attendance-imports.logs.update", {
                    batch: selectedBatch.id,
                    log: editLogForm.id,
                }),
                {
                    biometric_id: editLogForm.biometric_id,
                    log_datetime: toDateTimePayload(editLogForm.log_datetime),
                    log_type: editLogForm.log_type,
                    device_id: editLogForm.device_id || null,
                },
            );

            toast.success(
                data?.message ?? "Imported log updated successfully.",
            );
            setShowEditLogModal(false);
            await loadBatchDetails(selectedBatch);
            router.reload({
                only: ["batches"],
                preserveState: true,
                preserveScroll: true,
            });
        } catch (error) {
            if (error?.response?.status === 422) {
                setEditLogErrors(error.response.data?.errors ?? {});
            } else {
                toast.error(
                    error?.response?.data?.message ||
                        error?.message ||
                        "Failed to update imported log.",
                );
            }
        } finally {
            setSavingLog(false);
        }
    };

    const deleteBatch = async () => {
        const batch = batchToDelete ?? selectedBatch;

        if (!batch || deleting) {
            return;
        }

        setDeleting(true);

        try {
            const { data } = await window.axios.delete(
                route("admin.attendance-imports.destroy", batch.id),
            );
            toast.success(
                data?.message ?? "Import batch deleted successfully.",
            );
            setShowDeleteBatchModal(false);

            if (selectedBatch?.id === batch.id) {
                closeDetailsModal();
            } else {
                setBatchToDelete(null);
            }

            router.reload({
                only: ["batches"],
                preserveState: true,
                preserveScroll: true,
            });
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Failed to delete import batch.",
            );
        } finally {
            setDeleting(false);
        }
    };

    const deleteLog = async (log) => {
        const targetLog = log ?? logToDelete;

        if (!selectedBatch || !targetLog?.id || deleting) {
            return;
        }

        setDeleting(true);

        try {
            const { data } = await window.axios.delete(
                route("admin.attendance-imports.logs.destroy", {
                    batch: selectedBatch.id,
                    log: targetLog.id,
                }),
            );

            toast.success(
                data?.message ?? "Imported log deleted successfully.",
            );
            setShowDeleteLogModal(false);
            setLogToDelete(null);
            await loadBatchDetails(selectedBatch);
            router.reload({
                only: ["batches"],
                preserveState: true,
                preserveScroll: true,
            });
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Failed to delete imported log.",
            );
        } finally {
            setDeleting(false);
        }
    };

    const unsyncedLogsCount = Number(batchDetails?.batch?.unsynced_logs ?? 0);
    const unrecognizedLogsCount = Number(
        batchDetails?.batch?.unrecognized_logs ?? 0,
    );
    // Logs that are unsynced AND have a recognized faculty (can actually be synced).
    const syncableLogsCount = Math.max(
        0,
        unsyncedLogsCount - unrecognizedLogsCount,
    );
    const duplicateLogs = batchDetails?.duplicates ?? [];
    const canDeleteSelectedBatch = Boolean(batchDetails?.batch?.can_delete);

    return (
        <AuthenticatedLayout
            header={
                <div className="w-full flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Attendance Log Import
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Upload faculty biometric logs, save batch details,
                            and insert records into biometric logs.
                        </p>
                    </div>
                    {canImportBiometricLogs && (
                        <a
                            href={route("admin.attendance-imports.template")}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Download Template
                        </a>
                    )}
                </div>
            }
        >
            <Head title="Attendance Log Import" />

            <div className="space-y-6">
                {canImportBiometricLogs && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            Import CSV/XLSX File
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Required columns: biometric_id, log_datetime,
                            log_type. Optional: device_id. For Excel uploads,
                            use an Excel date/time cell for log_datetime.
                        </p>

                        <form
                            onSubmit={submit}
                            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                            <div className="flex-1">
                                <label
                                    htmlFor="biometric-log-file"
                                    className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1"
                                >
                                    CSV or Excel File
                                </label>
                                <input
                                    id="biometric-log-file"
                                    type="file"
                                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    onChange={(event) =>
                                        form.setData(
                                            "file",
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700 dark:file:bg-gray-600 dark:file:text-gray-100"
                                />
                                <InputError
                                    message={form.errors.file}
                                    className="mt-1"
                                />
                            </div>

                            <PrimaryButton
                                type="submit"
                                disabled={form.processing || !form.data.file}
                            >
                                {form.processing ? "Importing…" : "Import Logs"}
                            </PrimaryButton>
                        </form>
                    </div>
                )}

                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Import Batches
                    </h2>

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[920px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    <th className="py-3 pr-3">File</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3 text-right">
                                        Total
                                    </th>
                                    <th className="py-3 px-3 text-right">
                                        Not Synced
                                    </th>
                                    <th className="py-3 px-3 text-right">
                                        Synced
                                    </th>
                                    <th className="py-3 px-3 text-right">
                                        Failed
                                    </th>
                                    <th className="py-3 px-3 text-right">
                                        Duplicates
                                    </th>
                                    <th className="py-3 px-3">Imported</th>
                                    <th className="py-3 px-3">Completed</th>
                                    <th className="py-3 pl-3 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches?.data?.length > 0 ? (
                                    batches.data.map((batch) => (
                                        <tr
                                            key={batch.id}
                                            className="border-b border-gray-100 dark:border-gray-700/80 text-gray-700 dark:text-gray-200"
                                        >
                                            <td className="py-3 pr-3 align-top">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">
                                                    {batch.file_name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Imported by:{" "}
                                                    {batch.importedBy?.email ??
                                                        "System"}
                                                </p>
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                <StatusBadge
                                                    status={batch.status}
                                                />
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">
                                                {batch.total_records}
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">
                                                {batch.unsynced_logs ?? 0}
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">
                                                {batch.synced_logs ?? 0}
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">
                                                {Number(
                                                    batch.failed_records ?? 0,
                                                ) +
                                                    Number(
                                                        batch.unrecognized_logs ??
                                                            0,
                                                    )}
                                            </td>
                                            <td className="py-3 px-3 text-right align-top">
                                                {batch.duplicate_records}
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                {formatDateTime(
                                                    batch.started_at,
                                                )}
                                            </td>
                                            <td className="py-3 px-3 align-top">
                                                {formatDateTime(
                                                    batch.completed_at,
                                                )}
                                                {batch.status === "failed" &&
                                                    batch.error_log && (
                                                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 whitespace-pre-line">
                                                            {batch.error_log}
                                                        </p>
                                                    )}
                                            </td>
                                            <td className="py-3 pl-3 text-right align-top">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            loadBatchDetails(
                                                                batch,
                                                            )
                                                        }
                                                        className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        View Details
                                                    </button>
                                                    {canDeleteBiometricLogs && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDeleteBatchModal(
                                                                    batch,
                                                                )
                                                            }
                                                            disabled={
                                                                deleting ||
                                                                Number(
                                                                    batch.synced_logs ??
                                                                        0,
                                                                ) > 0
                                                            }
                                                            className="inline-flex items-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                                                            title={
                                                                Number(
                                                                    batch.synced_logs ??
                                                                        0,
                                                                ) > 0
                                                                    ? "Synced batches cannot be deleted."
                                                                    : "Delete this import batch"
                                                            }
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                        >
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

            <Modal
                show={showDetailsModal}
                onClose={() => {
                    if (
                        !showSyncModal &&
                        !showEditLogModal &&
                        !showDeleteBatchModal &&
                        !showDeleteLogModal
                    )
                        closeDetailsModal();
                }}
                maxWidth="4xl"
            >
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Import Details
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {selectedBatch?.file_name ?? "—"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {canDeleteBiometricLogs && batchDetails && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        openDeleteBatchModal(selectedBatch)
                                    }
                                    disabled={
                                        deleting || !canDeleteSelectedBatch
                                    }
                                    className="inline-flex items-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                                    title={
                                        canDeleteSelectedBatch
                                            ? "Delete this import batch"
                                            : "Synced batches cannot be deleted."
                                    }
                                >
                                    Delete Batch
                                </button>
                            )}
                            {selectedBatch && (
                                <StatusBadge
                                    status={
                                        batchDetails?.batch?.status ??
                                        selectedBatch.status
                                    }
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
                    {detailsLoading && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Loading batch logs...
                        </p>
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Total Logs
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                        {batchDetails.batch?.total_logs ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                        Synced
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                        {batchDetails.batch?.synced_logs ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                        Not Synced
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300">
                                        {batchDetails.batch?.unsynced_logs ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3">
                                    <p className="text-xs text-red-700 dark:text-red-400 uppercase tracking-wider">
                                        Unrecognized IDs
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-300">
                                        {batchDetails.batch
                                            ?.unrecognized_logs ?? 0}
                                    </p>
                                </div>
                            </div>

                            {(batchDetails.batch?.unrecognized_logs ?? 0) >
                                0 && (
                                <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                                    <span className="font-semibold">
                                        {batchDetails.batch.unrecognized_logs}
                                    </span>{" "}
                                    log{" "}
                                    {batchDetails.batch.unrecognized_logs === 1
                                        ? "entry has"
                                        : "entries have"}{" "}
                                    a biometric ID that does not exist in the
                                    system. These entries are saved as an audit
                                    trail but will not be synced to attendance
                                    records until the faculty is registered.
                                </div>
                            )}

                            <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                                Unsynced logs can be edited or deleted here.
                                Synced logs are locked to avoid breaking
                                attendance records that were already created
                                from them.
                            </div>

                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                <table className="w-full min-w-[780px] text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <th className="py-3 px-3">
                                                Faculty
                                            </th>
                                            <th className="py-3 px-3">Date</th>
                                            <th className="py-3 px-3">Time</th>
                                            <th className="py-3 px-3">Type</th>
                                            <th className="py-3 px-3">
                                                ID Status
                                            </th>
                                            <th className="py-3 px-3">
                                                Synced
                                            </th>
                                            <th className="py-3 px-3 text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchDetails.logs?.data?.length > 0 ? (
                                            batchDetails.logs.data.map(
                                                (log) => (
                                                    <tr
                                                        key={log.id}
                                                        className={`border-b border-gray-100 dark:border-gray-700/80 text-gray-700 dark:text-gray-200 ${!log.faculty_exists ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}
                                                    >
                                                        <td className="py-3 px-3 align-top">
                                                            {log.faculty_exists ? (
                                                                <>
                                                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                                                        {
                                                                            log.faculty_name
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                        {
                                                                            log.biometric_id
                                                                        }
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="font-semibold text-red-700 dark:text-red-400">
                                                                        {
                                                                            log.biometric_id
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
                                                                        Not
                                                                        found in
                                                                        system
                                                                    </p>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 align-top">
                                                            {formatDate(
                                                                log.log_datetime,
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 align-top">
                                                            {formatTime(
                                                                log.log_datetime,
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 align-top">
                                                            {formatLogType(
                                                                log.log_type,
                                                            )}
                                                        </td>
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
                                                            <span
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                                                                    log.is_processed
                                                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                                        : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300"
                                                                }`}
                                                            >
                                                                {log.is_processed
                                                                    ? "Synced"
                                                                    : "Not Synced"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 align-top text-right">
                                                            {log.can_edit ? (
                                                                canEditBiometricLogs ||
                                                                canDeleteBiometricLogs ? (
                                                                    <div className="flex justify-end gap-2">
                                                                        {canEditBiometricLogs && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    openEditLogModal(
                                                                                        log,
                                                                                    )
                                                                                }
                                                                                className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                        )}
                                                                        {canDeleteBiometricLogs && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    openDeleteLogModal(
                                                                                        log,
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    deleting
                                                                                }
                                                                                className="inline-flex items-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : null
                                                            ) : (
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    Locked after
                                                                    sync
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                                >
                                                    No biometric logs found for
                                                    this batch.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {batchDetails.logs?.last_page > 1 && (
                                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                        Showing {batchDetails.logs.from ?? 0}–
                                        {batchDetails.logs.to ?? 0} of{" "}
                                        {batchDetails.logs.total} logs.
                                    </p>
                                )}
                            </div>

                            {duplicateLogs.length > 0 && (
                                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-x-auto">
                                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/20">
                                        Duplicate Logs
                                    </div>
                                    <table className="w-full min-w-[780px] text-sm">
                                        <thead>
                                            <tr className="border-b border-amber-200 dark:border-amber-800/50 text-left text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                <th className="py-3 px-3">
                                                    Faculty
                                                </th>
                                                <th className="py-3 px-3">
                                                    Date
                                                </th>
                                                <th className="py-3 px-3">
                                                    Time
                                                </th>
                                                <th className="py-3 px-3">
                                                    Type
                                                </th>
                                                <th className="py-3 px-3">
                                                    ID Status
                                                </th>
                                                <th className="py-3 px-3">
                                                    Synced
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {duplicateLogs.map((log) => (
                                                <tr
                                                    key={log.id}
                                                    className={`border-b border-amber-100 dark:border-amber-900/40 text-gray-700 dark:text-gray-200 ${!log.faculty_exists ? "bg-red-50/30 dark:bg-red-900/10" : "bg-amber-50/30 dark:bg-amber-900/10"}`}
                                                >
                                                    <td className="py-3 px-3 align-top">
                                                        {log.faculty_exists ? (
                                                            <>
                                                                <p className="font-semibold text-gray-800 dark:text-gray-100">
                                                                    {
                                                                        log.faculty_name
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    {
                                                                        log.biometric_id
                                                                    }
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold text-red-700 dark:text-red-400">
                                                                    {
                                                                        log.biometric_id
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
                                                                    Not found in
                                                                    system
                                                                </p>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 align-top">
                                                        {formatDate(
                                                            log.log_datetime,
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 align-top">
                                                        {formatTime(
                                                            log.log_datetime,
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 align-top">
                                                        {formatLogType(
                                                            log.log_type,
                                                        )}
                                                    </td>
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
                                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300">
                                                            Duplicate
                                                        </span>
                                                        <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-gray-100 text-gray-600 ring-gray-300/50 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600/50">
                                                            Already in logs
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Sync Logs
                                </h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Sync this batch to mark all remaining not
                                    synced logs as synced.
                                </p>

                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {syncableLogsCount > 0 ? (
                                            <>
                                                Ready to sync{" "}
                                                <span className="font-semibold">
                                                    {syncableLogsCount}
                                                </span>{" "}
                                                log{" "}
                                                {syncableLogsCount === 1
                                                    ? "entry"
                                                    : "entries"}
                                                .
                                            </>
                                        ) : unrecognizedLogsCount > 0 ? (
                                            "All recognized logs in this batch have been synced."
                                        ) : (
                                            "All logs in this batch are already synced."
                                        )}
                                    </p>

                                    {canImportBiometricLogs && (
                                        <PrimaryButton
                                            type="button"
                                            onClick={() => {
                                                syncTargetRef.current =
                                                    selectedBatch;
                                                setShowSyncModal(true);
                                            }}
                                            disabled={syncing}
                                        >
                                            Sync Logs
                                        </PrimaryButton>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <SecondaryButton onClick={closeDetailsModal}>
                        Close
                    </SecondaryButton>
                </div>
            </Modal>

            {canEditBiometricLogs && (
                <Modal
                    show={showEditLogModal}
                    onClose={closeEditLogModal}
                    maxWidth="lg"
                >
                    <form
                        className="flex max-h-[88dvh] flex-col"
                        className="flex max-h-[88dvh] flex-col"
                    onSubmit={(event) => {
                            event.preventDefault();
                            saveEditedLog();
                        }}
                    >
                        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <svg
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={2}
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16.862 4.487a2.25 2.25 0 1 1 3.182 3.182L7.5 20.213 3 21l.787-4.5L16.862 4.487Z"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                        Edit Imported Log
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Update the raw biometric entry before it
                                        is synced to attendance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Editing Entry
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                            Batch
                                        </p>
                                        <p className="break-all text-gray-700 dark:text-gray-300">
                                            {selectedBatch?.file_name ?? "—"}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                            Current Type
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-300">
                                            {formatLogType(
                                                editLogForm.log_type,
                                            )}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                            Sync Status
                                        </p>
                                        <p className="text-amber-700 dark:text-amber-400">
                                            Not Synced
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit-biometric-id"
                                    value="Biometric ID"
                                />
                                <TextInput
                                    id="edit-biometric-id"
                                    value={editLogForm.biometric_id}
                                    onChange={(event) =>
                                        setEditLogForm((current) => ({
                                            ...current,
                                            biometric_id: event.target.value,
                                        }))
                                    }
                                    className="mt-1 block w-full"
                                />
                                <InputError
                                    message={
                                        editLogErrors.biometric_id?.[0] ??
                                        editLogErrors.biometric_id
                                    }
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit-log-datetime"
                                    value="Log Date & Time"
                                />
                                <TextInput
                                    id="edit-log-datetime"
                                    type="datetime-local"
                                    value={editLogForm.log_datetime}
                                    onChange={(event) =>
                                        setEditLogForm((current) => ({
                                            ...current,
                                            log_datetime: event.target.value,
                                        }))
                                    }
                                    className="mt-1 block w-full"
                                />
                                <InputError
                                    message={
                                        editLogErrors.log_datetime?.[0] ??
                                        editLogErrors.log_datetime
                                    }
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit-log-type"
                                    value="Log Type"
                                />
                                <select
                                    id="edit-log-type"
                                    value={editLogForm.log_type}
                                    onChange={(event) =>
                                        setEditLogForm((current) => ({
                                            ...current,
                                            log_type: event.target.value,
                                        }))
                                    }
                                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-red-500 dark:focus:ring-red-500 dark:[color-scheme:dark] transition-all duration-300"
                                >
                                    <option value="IN">Time In</option>
                                    <option value="OUT">Time Out</option>
                                </select>
                                <InputError
                                    message={
                                        editLogErrors.log_type?.[0] ??
                                        editLogErrors.log_type
                                    }
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit-device-id"
                                    value="Device ID"
                                />
                                <TextInput
                                    id="edit-device-id"
                                    value={editLogForm.device_id}
                                    onChange={(event) =>
                                        setEditLogForm((current) => ({
                                            ...current,
                                            device_id: event.target.value,
                                        }))
                                    }
                                    className="mt-1 block w-full"
                                />
                                <InputError
                                    message={
                                        editLogErrors.device_id?.[0] ??
                                        editLogErrors.device_id
                                    }
                                    className="mt-2"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                            <SecondaryButton
                                type="button"
                                onClick={closeEditLogModal}
                                disabled={savingLog}
                            >
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton type="submit" disabled={savingLog}>
                                {savingLog ? "Saving…" : "Save Changes"}
                            </PrimaryButton>
                        </div>
                    </form>
                </Modal>
            )}

            {canDeleteBiometricLogs && (
                <Modal
                    show={showDeleteBatchModal}
                    onClose={closeDeleteBatchModal}
                    maxWidth="lg"
                >
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 7.5h12m-9.75 0V6A1.5 1.5 0 0 1 9.75 4.5h4.5A1.5 1.5 0 0 1 15.75 6v1.5m-7.5 0v9.75A2.25 2.25 0 0 0 10.5 19.5h3a2.25 2.25 0 0 0 2.25-2.25V7.5m-6 3v5.25m4.5-5.25v5.25"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Delete Import Batch
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Remove a mistakenly uploaded batch and all
                                    of its remaining unsynced logs.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-4 text-sm">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Batch Summary
                            </p>
                            <p className="font-bold text-gray-800 dark:text-gray-200">
                                {batchToDelete?.file_name ?? "—"}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                Imported on{" "}
                                {formatDateTime(batchToDelete?.started_at)}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                                This action permanently removes the batch record
                                and its unsynced biometric logs.
                            </p>
                        </div>

                        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                            This action cannot be undone.
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton
                            type="button"
                            onClick={closeDeleteBatchModal}
                            disabled={deleting}
                        >
                            Cancel
                        </SecondaryButton>
                        <DangerButton
                            type="button"
                            onClick={deleteBatch}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting…" : "Delete Batch"}
                        </DangerButton>
                    </div>
                </Modal>
            )}

            {canDeleteBiometricLogs && (
                <Modal
                    show={showDeleteLogModal}
                    onClose={closeDeleteLogModal}
                    maxWidth="lg"
                >
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 7.5h12m-9.75 0V6A1.5 1.5 0 0 1 9.75 4.5h4.5A1.5 1.5 0 0 1 15.75 6v1.5m-7.5 0v9.75A2.25 2.25 0 0 0 10.5 19.5h3a2.25 2.25 0 0 0 2.25-2.25V7.5m-6 3v5.25m4.5-5.25v5.25"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Delete Imported Log
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Remove this unsynced raw biometric entry
                                    from the selected import batch.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-4 text-sm">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Log Summary
                            </p>
                            <p className="font-bold text-gray-800 dark:text-gray-200">
                                {logToDelete?.faculty_name ??
                                    logToDelete?.biometric_id ??
                                    "—"}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                {formatDate(logToDelete?.log_datetime)} ·{" "}
                                {formatTime(logToDelete?.log_datetime)} ·{" "}
                                {formatLogType(logToDelete?.log_type)}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                                Batch: {selectedBatch?.file_name ?? "—"}
                            </p>
                        </div>

                        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                            This action cannot be undone.
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton
                            type="button"
                            onClick={closeDeleteLogModal}
                            disabled={deleting}
                        >
                            Cancel
                        </SecondaryButton>
                        <DangerButton
                            type="button"
                            onClick={() => deleteLog()}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting…" : "Delete Log"}
                        </DangerButton>
                    </div>
                </Modal>
            )}

            {canImportBiometricLogs && (
                <Modal
                    show={showSyncModal}
                    onClose={() => !syncing && setShowSyncModal(false)}
                    maxWidth="md"
                >
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Confirm Sync
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            This will sync the remaining logs in this import
                            batch.
                        </p>
                    </div>

                    <div className="px-6 py-5">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            {syncableLogsCount > 0 ? (
                                <>
                                    Sync{" "}
                                    <span className="font-semibold">
                                        {syncableLogsCount}
                                    </span>{" "}
                                    not synced log{" "}
                                    {syncableLogsCount === 1
                                        ? "entry"
                                        : "entries"}{" "}
                                    now?
                                </>
                            ) : unrecognizedLogsCount > 0 ? (
                                "No syncable logs remaining. Unrecognized entries cannot be synced."
                            ) : (
                                "No not synced logs were found. You can still continue to verify the batch status."
                            )}
                        </p>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton
                            onClick={() => setShowSyncModal(false)}
                            disabled={syncing}
                        >
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton
                            type="button"
                            onClick={() => syncBatch(syncTargetRef.current)}
                            disabled={syncing}
                        >
                            {syncing ? "Syncing…" : "Sync Now"}
                        </PrimaryButton>
                    </div>
                </Modal>
            )}
        </AuthenticatedLayout>
    );
}
