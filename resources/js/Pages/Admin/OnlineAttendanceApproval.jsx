import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import Pagination from '@/Components/Pagination';
import { Head, useForm } from '@inertiajs/react';
import { useState, useCallback } from 'react';

const STATUS_BADGE = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30',
};

const CLASS_TYPE_BADGE = {
    synchronous: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400',
    asynchronous: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400',
};

const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    } catch (e) {
        return dateString;
    }
};

function ApprovalCard({ request, onApprove, onReject, isExpanded, toggleExpand, onOpenScreenshot }) {
    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        >
            <div className="p-5 sm:p-6">
                {/* Header Row: 3 columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                                {request.faculty_name}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset capitalize ${STATUS_BADGE[request.status]}`}>
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                </span>
                                <svg
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {request.faculty_email}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold ring-1 ring-inset ${CLASS_TYPE_BADGE[request.class_type]}`}>
                                {request.class_type.charAt(0).toUpperCase() + request.class_type.slice(1)}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">·</span>
                            <span className="text-gray-600 dark:text-gray-400">
                                {request.attendance_date}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">·</span>
                            <span className="text-gray-600 dark:text-gray-400 font-mono">
                                {request.time_in} – {request.time_out}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {request.subject_code} — {request.subject_desc}
                        </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-800/40">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Screenshot - Time In</p>
                        {request.screenshot_in ? (
                            <button
                                type="button"
                                onClick={(event) => handleActionClick(event, () => onOpenScreenshot(request.screenshot_in, 'Time In Screenshot'))}
                                className="group relative w-full h-24 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700/50 bg-white dark:bg-gray-800"
                            >
                                <img src={request.screenshot_in} alt="Time In" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            </button>
                        ) : (
                            <p className="text-xs text-gray-400">No screenshot</p>
                        )}
                    </div>

                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-800/40">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Screenshot - Time Out</p>
                        {request.screenshot_out ? (
                            <button
                                type="button"
                                onClick={(event) => handleActionClick(event, () => onOpenScreenshot(request.screenshot_out, 'Time Out Screenshot'))}
                                className="group relative w-full h-24 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-700/50 bg-white dark:bg-gray-800"
                            >
                                <img src={request.screenshot_out} alt="Time Out" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            </button>
                        ) : (
                            <p className="text-xs text-gray-400">No screenshot</p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        Click to {isExpanded ? 'hide' : 'show'} details
                    </p>
                    {request.status === 'pending' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(event) => handleActionClick(event, onReject)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                                Reject
                            </button>
                            <button
                                onClick={(event) => handleActionClick(event, onApprove)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                Approve
                            </button>
                        </div>
                    )}
                </div>

                {/* Expanded Details */}
                <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden space-y-4">
                        {/* Date & Time */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date & Time</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Date:</span> {request.attendance_date}</p>
                                    <p><span className="font-semibold">Time In:</span> {request.time_in}</p>
                                    <p><span className="font-semibold">Time Out:</span> {request.time_out}</p>
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
                        {request.remarks && (
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Faculty Remarks
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {request.remarks}
                                </p>
                            </div>
                        )}

                        {/* Review Details */}
                        {request.status !== 'pending' && request.reviewed_at && (
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Review Information
                                </p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Reviewed by:</span> {request.reviewed_by}</p>
                                    <p><span className="font-semibold">Date:</span> {formatDateTime(request.reviewed_at)}</p>
                                    {request.review_remarks && (
                                        <div className="mt-2">
                                            <p className="font-semibold text-gray-600 dark:text-gray-400">Admin Notes:</p>
                                            <p className="text-gray-700 dark:text-gray-300">{request.review_remarks}</p>
                                        </div>
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
                    <svg className="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                No requests to review
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {filterStatus === 'pending' && 'All pending requests have been processed.'}
                {filterStatus && filterStatus !== 'pending' && `No ${filterStatus} requests.`}
                {searchQuery && `No results match "${searchQuery}".`}
                {!filterStatus && !searchQuery && 'All online attendance requests will appear here.'}
            </p>
        </div>
    );
}

export default function OnlineAttendanceApproval({ requests: initialRequests, filters, pendingCount }) {
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);
    const [perPage, setPerPage] = useState(initialRequests.per_page || 10);
    const [expandedCards, setExpandedCards] = useState({});

    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [screenshotLabel, setScreenshotLabel] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);

    const approveForm = useForm({ review_remarks: '' });
    const rejectForm = useForm({ review_remarks: '' });

    const fetchRequests = useCallback((status, search, page = 1, pageSize = perPage) => {
        setIsFiltering(true);

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        params.set('page', page);
        params.set('per_page', pageSize);

        fetch(route('admin.online-requests.filter') + '?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error('Failed to fetch requests');
                return res.json();
            })
            .then((data) => {
                setRequestsData(data);
                setCurrentPage(data.current_page || 1);
                setPerPage(data.per_page || 10);
                setExpandedCards({});
            })
            .catch((error) => {
                console.error('Error:', error);
                window.alert('Failed to load requests. Please try again.');
            })
            .finally(() => setIsFiltering(false));
    }, [perPage]);

    const applyFilter = (status) => {
        setFilterStatus(status);
        setSearchInput('');
        setSearchQuery('');
        fetchRequests(status, '', 1, perPage);
    };

    const applySearch = (e) => {
        e.preventDefault();
        setSearchQuery(searchInput);
        setFilterStatus(''); // Clear status filter to search across all statuses
        fetchRequests('', searchInput, 1, perPage);
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setFilterStatus(''); // Reset to "All" status
        fetchRequests('', '', 1, perPage);
    };

    const goToPage = (page) => {
        fetchRequests(filterStatus, searchQuery, page, perPage);
    };

    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage);
        // Reset to page 1 when changing per_page
        fetchRequests(filterStatus, searchQuery, 1, newPerPage);
    };

    const toggleExpand = (id) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const openApprove = (req) => {
        setSelectedRequest(req);
        approveForm.reset();
        setShowApproveModal(true);
    };

    const handleApprove = (e) => {
        e.preventDefault();
        approveForm.patch(route('admin.online-requests.approve', selectedRequest.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowApproveModal(false);
                setSelectedRequest(null);
                approveForm.reset();
                fetchRequests(filterStatus, searchQuery, currentPage, perPage);
            },
        });
    };

    const openReject = (req) => {
        setSelectedRequest(req);
        rejectForm.reset();
        setShowRejectModal(true);
    };

    const handleReject = (e) => {
        e.preventDefault();
        rejectForm.patch(route('admin.online-requests.reject', selectedRequest.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowRejectModal(false);
                setSelectedRequest(null);
                rejectForm.reset();
                fetchRequests(filterStatus, searchQuery, currentPage, perPage);
            },
        });
    };

    const openScreenshot = (url, label) => {
        setScreenshotUrl(url);
        setScreenshotLabel(label);
        setShowScreenshotModal(true);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Online Class Requests — Admin" />

            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Online Class Requests
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Review and approve faculty online attendance records with proof
                    </p>
                </div>

                {/* Pending badge */}
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 shadow-sm">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
                    </div>
                )}
            </div>

            {/* ── Search + Filter row ──────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {/* Search */}
                <form onSubmit={applySearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by faculty name or email…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-4 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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

                {/* Status filter tabs */}
                <div className="flex gap-2 flex-wrap">
                    {['', 'pending', 'approved', 'rejected'].map((s) => (
                        <button
                            key={s}
                            onClick={() => applyFilter(s)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === s
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                        >
                            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Spinner ──────────────────────────────────────────────── */}
            {isFiltering && (
                <div className="flex justify-center py-12">
                    <svg className="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            )}

            {/* ── Request cards ────────────────────────────────────────── */}
            {!isFiltering && requestsData.data && requestsData.data.length > 0 ? (
                <div className="space-y-4">
                    {requestsData.data.map((req) => (
                        <ApprovalCard
                            key={req.id}
                            request={req}
                            isExpanded={expandedCards[req.id] || false}
                            toggleExpand={() => toggleExpand(req.id)}
                            onApprove={() => openApprove(req)}
                            onReject={() => openReject(req)}
                            onOpenScreenshot={openScreenshot}
                        />
                    ))}

                    {/* Pagination */}
                    <Pagination
                        currentPage={requestsData.current_page}
                        totalItems={requestsData.total}
                        perPage={requestsData.per_page}
                        onPageChange={goToPage}
                        onPerPageChange={handlePerPageChange}
                        perPageOptions={[5, 10, 25, 50]}
                    />
                </div>
            ) : !isFiltering ? (
                <EmptyState filterStatus={filterStatus} searchQuery={searchQuery} />
            ) : null}

            {/* ════════════════════════════════════════════════════════════
                 APPROVE MODAL
                ════════════════════════════════════════════════════════════ */}
            <Modal show={showApproveModal} onClose={() => setShowApproveModal(false)} maxWidth="lg">
                <form onSubmit={handleApprove}>
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Approve Attendance
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    This will record the attendance in the system.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    {selectedRequest && (
                        <div className="px-6 py-5 space-y-4">
                            {/* Summary */}
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Request Summary
                                </p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Faculty:</span> {selectedRequest.faculty_name}</p>
                                    <p><span className="font-semibold">Date:</span> {selectedRequest.attendance_date}</p>
                                    <p><span className="font-semibold">Time:</span> {selectedRequest.time_in} – {selectedRequest.time_out}</p>
                                    <p><span className="font-semibold">Subject:</span> {selectedRequest.subject_code} - {selectedRequest.subject_desc}</p>
                                    <p><span className="font-semibold">Type:</span> {selectedRequest.class_type.charAt(0).toUpperCase() + selectedRequest.class_type.slice(1)}</p>
                                </div>
                            </div>

                            {/* Optional remarks */}
                            <div>
                                <InputLabel value="Remarks (optional)" htmlFor="approve_remarks" />
                                <textarea
                                    id="approve_remarks"
                                    rows={3}
                                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                    placeholder="Add an optional note for the record…"
                                    value={approveForm.data.review_remarks}
                                    onChange={(e) => approveForm.setData('review_remarks', e.target.value)}
                                />
                                <InputError message={approveForm.errors.review_remarks} />
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setShowApproveModal(false)}>
                            Cancel
                        </SecondaryButton>
                        <button
                            type="submit"
                            disabled={approveForm.processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors"
                        >
                            {approveForm.processing ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Approving…
                                </>
                            ) : (
                                <>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                    Approve
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ════════════════════════════════════════════════════════════
                 REJECT MODAL
                ════════════════════════════════════════════════════════════ */}
            <Modal show={showRejectModal} onClose={() => setShowRejectModal(false)} maxWidth="lg">
                <form onSubmit={handleReject}>
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Reject Request
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Please provide a reason so the faculty can understand your decision.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    {selectedRequest && (
                        <div className="px-6 py-5 space-y-4">
                            {/* Subject + faculty info */}
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-4 text-sm">
                                <p className="font-bold text-gray-800 dark:text-gray-200">{selectedRequest.subject_code} - {selectedRequest.subject_desc}</p>
                                <p className="text-gray-600 dark:text-gray-400">{selectedRequest.faculty_name}</p>
                                <p className="text-gray-500 dark:text-gray-500 mt-1">
                                    {selectedRequest.attendance_date} · {selectedRequest.time_in}–{selectedRequest.time_out}
                                </p>
                            </div>

                            {/* Required remarks */}
                            <div>
                                <InputLabel
                                    value="Reason for Rejection *"
                                    htmlFor="reject_remarks"
                                />
                                <textarea
                                    id="reject_remarks"
                                    rows={4}
                                    required
                                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                    placeholder="Explain why this request cannot be approved…"
                                    value={rejectForm.data.review_remarks}
                                    onChange={(e) => rejectForm.setData('review_remarks', e.target.value)}
                                />
                                <InputError message={rejectForm.errors.review_remarks} />
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                    Minimum 5 characters. The faculty will see this reason.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setShowRejectModal(false)}>
                            Cancel
                        </SecondaryButton>
                        <DangerButton type="submit" disabled={rejectForm.processing || rejectForm.data.review_remarks.trim().length < 5}>
                            {rejectForm.processing ? 'Rejecting…' : 'Reject Request'}
                        </DangerButton>
                    </div>
                </form>
            </Modal>

            {/* SCREENSHOT VIEWER MODAL */}
            <Modal show={showScreenshotModal} onClose={() => setShowScreenshotModal(false)} maxWidth="3xl">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{screenshotLabel}</h3>
                        <button
                            onClick={() => setShowScreenshotModal(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <img
                        src={screenshotUrl}
                        alt={screenshotLabel}
                        className="w-full rounded-xl object-contain max-h-[70vh]"
                    />
                </div>
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
