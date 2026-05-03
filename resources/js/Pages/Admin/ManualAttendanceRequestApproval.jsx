import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ScrollToTop from "@/Components/ScrollToTop";
import Modal from "@/Components/Modal";
import InputLabel from "@/Components/InputLabel";
import InputError from "@/Components/InputError";
import TextInput from "@/Components/TextInput";
import SecondaryButton from "@/Components/SecondaryButton";
import Pagination from "@/Components/Pagination";
import AttachmentPreviewModal from "@/Components/AttachmentPreviewModal";
import { Head, useForm } from "@inertiajs/react";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";

const STATUS_BADGE = {
    pending:
        "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/30",
    approved:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/30",
    rejected:
        "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30",
};

function RequestCard({
    request,
    onApprove,
    onReject,
    onPreview,
    isExpanded,
    toggleExpand,
}) {
    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleExpand();
                }
            }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        >
            <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-1">
                            {request.faculty_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {request.faculty_email}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold ring-1 ring-inset ${STATUS_BADGE[request.status]}`}
                            >
                                {request.status.charAt(0).toUpperCase() +
                                    request.status.slice(1)}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">
                                ·
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                                {request.attendance_date}
                            </span>
                            {request.schedule_source && (
                                <>
                                    <span className="text-gray-400 dark:text-gray-600">
                                        ·
                                    </span>
                                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-1 font-semibold text-slate-700 dark:text-slate-200">
                                        Compared via{" "}
                                        {request.schedule_source === "internal"
                                            ? "Internal Schedule"
                                            : "Official Schedule"}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <svg
                        className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                    </svg>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Requested In
                        </p>
                        <p className="text-gray-900 dark:text-white font-bold">
                            {request.requested_time_in ?? "--:--"}
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Requested Out
                        </p>
                        <p className="text-gray-900 dark:text-white font-bold">
                            {request.requested_time_out ?? "--:--"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-4">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        Click to {isExpanded ? "hide" : "show"} details
                    </p>
                    {request.status === "pending" && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(event) =>
                                    handleActionClick(event, onReject)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                                Reject
                            </button>
                            <button
                                onClick={(event) =>
                                    handleActionClick(event, onApprove)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                            >
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m4.5 12.75 6 6 9-13.5"
                                    />
                                </svg>
                                Approve
                            </button>
                        </div>
                    )}
                </div>

                <div
                    className={`grid transition-all duration-300 ease-out ${isExpanded ? "grid-rows-[1fr] mt-4" : "grid-rows-[0fr]"}`}
                >
                    <div className="overflow-hidden space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-3">
                                <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                                    Current Time In
                                </p>
                                <p className="text-gray-900 dark:text-white font-semibold">
                                    {request.current_actual_time_in ??
                                        "Not recorded"}
                                </p>
                            </div>
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-3">
                                <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                                    Current Time Out
                                </p>
                                <p className="text-gray-900 dark:text-white font-semibold">
                                    {request.current_actual_time_out ??
                                        "Not recorded"}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Reason / Justification
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {request.justification}
                            </p>
                        </div>

                        {request.attachments_data && request.attachments_data.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supporting Documents</p>
                                <div className="flex flex-wrap gap-3">
                                    {request.attachments_data.map((attachment, idx) => (
                                        <button
                                            key={attachment.id || idx}
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onPreview(request.attachments_data, idx);
                                            }}
                                            className="group relative flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 hover:border-blue-400 dark:hover:border-blue-500 transition-all w-24 h-24"
                                        >
                                            {attachment.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                <img src={attachment.url} alt={attachment.custom_label} className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-100" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500">
                                                    <svg className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <span className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate w-full text-center">
                                                {attachment.custom_label || 'File'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {request.semester_label && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-3">
                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    {request.semester_label}:{" "}
                                    {request.used_manual_logs ?? 0}/
                                    {request.manual_log_limit ?? 5} counted
                                    manual logs used
                                </p>
                            </div>
                        )}

                        {request.status !== "pending" && (
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Review Information
                                </p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p>
                                        <span className="font-semibold">
                                            Reviewed by:
                                        </span>{" "}
                                        {request.reviewer_name ?? "N/A"}
                                    </p>
                                    <p>
                                        <span className="font-semibold">
                                            Date:
                                        </span>{" "}
                                        {request.reviewed_at ?? "N/A"}
                                    </p>
                                    {request.review_remarks && (
                                        <p>
                                            <span className="font-semibold">
                                                Remarks:
                                            </span>{" "}
                                            {request.review_remarks}
                                        </p>
                                    )}
                                    {request.status === "approved" && (
                                        <p>
                                            <span className="font-semibold">
                                                Counted in limit:
                                            </span>{" "}
                                            {request.counts_as_manual_log
                                                ? "Yes"
                                                : "No"}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ filterStatus, searchQuery }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 py-12 px-6 text-center">
            <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    <svg
                        className="h-6 w-6 text-gray-500 dark:text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                No manual attendance requests
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {filterStatus === "pending" &&
                    "All pending manual attendance requests have been reviewed."}
                {filterStatus &&
                    filterStatus !== "pending" &&
                    `No ${filterStatus} manual attendance requests.`}
                {searchQuery && `No results match "${searchQuery}".`}
                {!filterStatus &&
                    !searchQuery &&
                    "Manual attendance requests will appear here when submitted by faculty."}
            </p>
        </div>
    );
}

export default function ManualAttendanceRequestApproval({
    requests: initialRequests,
    paginator: initialPaginator,
    filters: initialFilters,
    pendingCount,
    manualLogLimit,
}) {
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [paginator, setPaginator] = useState(initialPaginator);
    const [searchInput, setSearchInput] = useState(initialFilters.search || "");
    const [searchQuery, setSearchQuery] = useState(initialFilters.search || "");
    const [filterStatus, setFilterStatus] = useState(
        initialFilters.status || "",
    );
    const [isFiltering, setIsFiltering] = useState(false);
    const [expandedCards, setExpandedCards] = useState({});
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [currentManualLogLimit, setCurrentManualLogLimit] = useState(
        manualLogLimit ?? 5,
    );
    const [previewState, setPreviewState] = useState({ attachments: [], startIndex: 0 });
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    const approveForm = useForm({
        review_remarks: "",
        count_manual_log: true,
    });

    const limitForm = useForm({
        manual_request_limit: String(manualLogLimit ?? 5),
    });

    const rejectForm = useForm({
        review_remarks: "",
    });

    const fetchRequests = useCallback(
        (status, search, page = 1) => {
            setIsFiltering(true);

            const params = new URLSearchParams();
            if (status) params.set("status", status);
            if (search) params.set("search", search);
            params.set("page", page);

            fetch(
                route("admin.manual-attendance-requests.filter") +
                "?" +
                params.toString(),
                {
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                },
            )
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            "Failed to fetch manual attendance requests",
                        );
                    }

                    return response.json();
                })
                .then((data) => {
                    setRequestsData(data.data ?? []);
                    setPaginator(data.pagination ?? initialPaginator);
                    setCurrentManualLogLimit(data.manualLogLimit ?? 5);
                    setExpandedCards({});
                })
                .catch(() => {
                    toast.error(
                        "Failed to load manual attendance requests. Please try again.",
                    );
                })
                .finally(() => setIsFiltering(false));
        },
        [initialPaginator],
    );

    const applyFilter = (status) => {
        setFilterStatus(status);
        setSearchInput("");
        setSearchQuery("");
        fetchRequests(status, "", 1);
    };

    const applySearch = (event) => {
        event.preventDefault();
        setSearchQuery(searchInput);
        setFilterStatus("");
        fetchRequests("", searchInput, 1);
    };

    const clearSearch = () => {
        setSearchInput("");
        setSearchQuery("");
        setFilterStatus("");
        fetchRequests("", "", 1);
    };

    const openApprove = (request) => {
        setSelectedRequest(request);
        approveForm.reset();
        approveForm.setData({
            review_remarks: "",
            count_manual_log: true,
        });
        setShowApproveModal(true);
    };

    const openReject = (request) => {
        setSelectedRequest(request);
        rejectForm.reset();
        setShowRejectModal(true);
    };

    const handleApprove = (event) => {
        event.preventDefault();

        if (!selectedRequest) {
            return;
        }

        approveForm.patch(
            route(
                "admin.manual-attendance-requests.approve",
                selectedRequest.id,
            ),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowApproveModal(false);
                    setSelectedRequest(null);
                    approveForm.reset();
                    fetchRequests(
                        filterStatus,
                        searchQuery,
                        paginator.current_page,
                    );
                },
                onError: () => {
                    toast.error("Failed to approve manual attendance request.");
                },
            },
        );
    };

    const handleReject = (event) => {
        event.preventDefault();

        if (!selectedRequest) {
            return;
        }

        rejectForm.patch(
            route(
                "admin.manual-attendance-requests.reject",
                selectedRequest.id,
            ),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    rejectForm.reset();
                    fetchRequests(
                        filterStatus,
                        searchQuery,
                        paginator.current_page,
                    );
                },
                onError: () => {
                    toast.error("Failed to reject manual attendance request.");
                },
            },
        );
    };

    const toggleExpand = (id) => {
        setExpandedCards((previous) => ({
            ...previous,
            [id]: !previous[id],
        }));
    };

    const handleLimitUpdate = (event) => {
        event.preventDefault();

        limitForm.patch(route("admin.manual-attendance-requests.limit.update"), {
            preserveScroll: true,
            onSuccess: () => {
                const nextLimit = Number(limitForm.data.manual_request_limit);

                setCurrentManualLogLimit(nextLimit);
                fetchRequests(filterStatus, searchQuery, paginator.current_page);
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manual Attendance Requests — Admin" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Manual Attendance Requests
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Approve or reject faculty manual time-in and time-out
                        requests
                    </p>
                </div>

                <div className="flex flex-col sm:items-end gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 shadow-sm">
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                            />
                        </svg>
                        {pendingCount} pending{" "}
                        {pendingCount === 1 ? "request" : "requests"}
                    </div>

                    <form
                        onSubmit={handleLimitUpdate}
                        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm"
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div>
                                <InputLabel
                                    htmlFor="manual_request_limit"
                                    value="Manual Request Limit"
                                />
                                <TextInput
                                    id="manual_request_limit"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={limitForm.data.manual_request_limit}
                                    onChange={(event) =>
                                        limitForm.setData(
                                            "manual_request_limit",
                                            event.target.value.replace(
                                                /\D/g,
                                                "",
                                            ),
                                        )
                                    }
                                    className="mt-2 block w-28"
                                />
                                <InputError
                                    message={
                                        limitForm.errors.manual_request_limit
                                    }
                                    className="mt-2"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Current cap: {currentManualLogLimit} counted
                                    requests per semester.
                                </p>
                                <button
                                    type="submit"
                                    disabled={
                                        limitForm.processing ||
                                        limitForm.data.manual_request_limit ===
                                        ""
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-xs font-bold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-50"
                                >
                                    {limitForm.processing
                                        ? "Saving..."
                                        : "Save Limit"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <form onSubmit={applySearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by faculty name, email, or reason..."
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-4 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-xs font-bold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
                    >
                        Search
                    </button>
                </form>

                <div className="flex gap-2 flex-wrap">
                    {["", "pending", "approved", "rejected"].map((status) => (
                        <button
                            key={status}
                            onClick={() => applyFilter(status)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === status
                                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                }`}
                        >
                            {status === ""
                                ? "All"
                                : status.charAt(0).toUpperCase() +
                                status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {isFiltering && (
                <div className="flex justify-center py-12">
                    <svg
                        className="h-6 w-6 animate-spin text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                </div>
            )}

            {!isFiltering && requestsData && requestsData.length > 0 ? (
                <div className="space-y-4">
                    {requestsData.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            isExpanded={expandedCards[request.id] || false}
                            toggleExpand={() => toggleExpand(request.id)}
                            onApprove={() => openApprove(request)}
                            onReject={() => openReject(request)}
                            onPreview={(attachments, startIndex) => {
                                setPreviewState({ attachments, startIndex });
                                setShowPreviewModal(true);
                            }}
                        />
                    ))}

                    <Pagination
                        currentPage={paginator.current_page}
                        totalItems={paginator.total}
                        perPage={paginator.per_page}
                        onPageChange={(page) =>
                            fetchRequests(filterStatus, searchQuery, page)
                        }
                        onPerPageChange={() => { }}
                        perPageOptions={[15]}
                    />
                </div>
            ) : !isFiltering ? (
                <EmptyState
                    filterStatus={filterStatus}
                    searchQuery={searchQuery}
                />
            ) : null}

            <Modal
                show={showApproveModal}
                onClose={() => setShowApproveModal(false)}
                maxWidth="lg"
            >
                <form onSubmit={handleApprove}>
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
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
                                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Approve Request
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    This will write the requested time to the
                                    attendance record and reflect in DTR.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 space-y-4">
                        {selectedRequest && (
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-100">
                                <p>
                                    <span className="font-semibold">
                                        Faculty:
                                    </span>{" "}
                                    {selectedRequest.faculty_name}
                                </p>
                                <p>
                                    <span className="font-semibold">Date:</span>{" "}
                                    {selectedRequest.attendance_date}
                                </p>
                                <p>
                                    <span className="font-semibold">
                                        Requested In:
                                    </span>{" "}
                                    {selectedRequest.requested_time_in ??
                                        "--:--"}
                                </p>
                                <p>
                                    <span className="font-semibold">
                                        Requested Out:
                                    </span>{" "}
                                    {selectedRequest.requested_time_out ??
                                        "--:--"}
                                </p>
                                <p>
                                    <span className="font-semibold">
                                        Schedule Priority Used:
                                    </span>{" "}
                                    {selectedRequest.schedule_source ===
                                        "internal"
                                        ? "Internal first"
                                        : "Official fallback"}
                                </p>
                            </div>
                        )}

                        {selectedRequest?.semester_label && (
                            <div
                                className={`rounded-xl border px-4 py-3 ${Number(
                                    selectedRequest.used_manual_logs ?? 0,
                                ) >= Number(currentManualLogLimit)
                                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300"
                                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
                                    }`}
                            >
                                <p className="text-xs font-semibold">
                                    {selectedRequest.semester_label}:{" "}
                                    {selectedRequest.used_manual_logs ?? 0}/
                                    {currentManualLogLimit} counted manual
                                    logs used.
                                </p>
                            </div>
                        )}
                        <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/60">
                            <input
                                type="checkbox"
                                checked={approveForm.data.count_manual_log}
                                onChange={(event) =>
                                    approveForm.setData(
                                        "count_manual_log",
                                        event.target.checked,
                                    )
                                }
                                className="mt-0.5 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Count this approval toward the semester
                                manual-log limit (default checked).
                            </span>
                        </label>
                        <InputError
                            message={approveForm.errors.count_manual_log}
                        />

                        <div>
                            <InputLabel
                                htmlFor="approve_remarks"
                                value="Optional Remarks"
                            />
                            <textarea
                                id="approve_remarks"
                                value={approveForm.data.review_remarks}
                                onChange={(event) =>
                                    approveForm.setData(
                                        "review_remarks",
                                        event.target.value,
                                    )
                                }
                                placeholder="Add optional approval notes..."
                                rows="3"
                                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                            />
                            <InputError
                                message={approveForm.errors.review_remarks}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                        <SecondaryButton
                            onClick={() => setShowApproveModal(false)}
                            disabled={approveForm.processing}
                        >
                            Cancel
                        </SecondaryButton>
                        <button
                            type="submit"
                            disabled={approveForm.processing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                            {approveForm.processing
                                ? "Approving..."
                                : "Approve Request"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                show={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                maxWidth="lg"
            >
                <form onSubmit={handleReject}>
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
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Reject Request
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Rejection reason is required.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 space-y-4">
                        {selectedRequest && (
                            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 space-y-1.5 text-xs text-red-900 dark:text-red-100">
                                <p>
                                    <span className="font-semibold">
                                        Faculty:
                                    </span>{" "}
                                    {selectedRequest.faculty_name}
                                </p>
                                <p>
                                    <span className="font-semibold">Date:</span>{" "}
                                    {selectedRequest.attendance_date}
                                </p>
                                <p>
                                    <span className="font-semibold">
                                        Requested In:
                                    </span>{" "}
                                    {selectedRequest.requested_time_in ??
                                        "--:--"}
                                </p>
                                <p>
                                    <span className="font-semibold">
                                        Requested Out:
                                    </span>{" "}
                                    {selectedRequest.requested_time_out ??
                                        "--:--"}
                                </p>
                            </div>
                        )}

                        <div>
                            <InputLabel
                                htmlFor="reject_remarks"
                                value="Reason for Rejection *"
                            />
                            <textarea
                                id="reject_remarks"
                                value={rejectForm.data.review_remarks}
                                onChange={(event) =>
                                    rejectForm.setData(
                                        "review_remarks",
                                        event.target.value,
                                    )
                                }
                                placeholder="Explain why this request is rejected..."
                                rows="3"
                                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                            />
                            <InputError
                                message={rejectForm.errors.review_remarks}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                        <SecondaryButton
                            onClick={() => setShowRejectModal(false)}
                            disabled={rejectForm.processing}
                        >
                            Cancel
                        </SecondaryButton>
                        <button
                            type="submit"
                            disabled={
                                rejectForm.processing ||
                                rejectForm.data.review_remarks.trim().length < 5
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                            {rejectForm.processing
                                ? "Rejecting..."
                                : "Reject Request"}
                        </button>
                    </div>
                </form>
            </Modal>

            <AttachmentPreviewModal
                show={showPreviewModal}
                onClose={() => setShowPreviewModal(false)}
                attachments={previewState.attachments}
                startIndex={previewState.startIndex}
            />

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
