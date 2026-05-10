import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import Pagination from "@/Components/Pagination";
import PrimaryButton from "@/Components/PrimaryButton";
import { Head, router, useForm } from "@inertiajs/react";

export default function Backups({ backups, filters = {}, schedule }) {
    const backupForm = useForm({});
    const backupRows = backups?.data ?? [];
    const currentPage = Number(backups?.current_page ?? 1);
    const perPage = Number(filters?.per_page ?? backups?.per_page ?? 10);

    const totalBytes = backupRows.reduce(
        (sum, backup) => sum + (backup.size_bytes ?? 0),
        0,
    );

    const totalSizeLabel = formatBytes(totalBytes);

    const runBackup = () => {
        backupForm.post(route("admin.backups.store"), {
            preserveScroll: true,
        });
    };

    const handlePageChange = (page) => {
        router.get(route("admin.backups.index"), {
            page,
            per_page: perPage,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handlePerPageChange = (nextPerPage) => {
        router.get(route("admin.backups.index"), {
            page: 1,
            per_page: nextPerPage,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Backups" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            Backups
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Manage downloadable application backups and trigger a
                            fresh one when needed.
                        </p>
                    </div>

                    <PrimaryButton
                        onClick={runBackup}
                        disabled={backupForm.processing}
                    >
                        {backupForm.processing
                            ? "Creating Backup..."
                            : "Create Backup"}
                    </PrimaryButton>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            Stored Backups
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white">
                            {backups?.total ?? backupRows.length}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            Total Size
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white">
                            {totalSizeLabel}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            Daily Schedule
                        </p>
                        <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Cleanup: {schedule?.cleanup}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            Backup: {schedule?.backup}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Backup Files
                        </h2>
                    </div>

                    {backupRows.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No backup files are available yet.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {backupRows.map((backup) => (
                                <div
                                    key={backup.id}
                                    className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                            {backup.name}
                                        </p>
                                        <div className="mt-1 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                                            <span>{backup.size_human}</span>
                                            <span>{backup.created_at}</span>
                                            {backup.directory && (
                                                <span className="truncate">
                                                    {backup.directory}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <a
                                            href={backup.download_url}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2 text-xs font-bold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
                                        >
                                            Download
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="px-5 pb-4">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={Number(backups?.total ?? 0)}
                            perPage={perPage}
                            onPageChange={handlePageChange}
                            onPerPageChange={handlePerPageChange}
                        />
                    </div>
                </div>

            </div>
        </AuthenticatedLayout>
    );
}

function formatBytes(bytes) {
    if (!bytes) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
}
