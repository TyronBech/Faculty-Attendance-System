import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import Pagination from '@/Components/Pagination';
import { Head, useForm } from '@inertiajs/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    CHANGE_REQUEST_STATUS_STYLES as STATUS_STYLES,
    DAY_AVATAR_COLORS,
    STRINGS,
} from '@/Constants/admin';

function formatTimeToAmPm(timeValue) {
    if (!timeValue || typeof timeValue !== 'string') {
        return timeValue;
    }

    const normalized = timeValue.trim();

    if (/\b(AM|PM)\b/i.test(normalized)) {
        return normalized.toUpperCase();
    }

    const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
        return normalized;
    }

    const hours24 = Number(match[1]);
    const minutes = match[2];

    if (Number.isNaN(hours24) || hours24 < 0 || hours24 > 23) {
        return normalized;
    }

    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

    return `${String(hours12).padStart(2, '0')}:${minutes} ${period}`;
}

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

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
export default function AdminScheduleChangeRequests({ requests: initialRequests, filters, pendingCount }) {
    // ── List state ───────────────────────────────────────────────────────
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [showAll, setShowAll] = useState(Boolean(filters.all));
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);
    const [perPage, setPerPage] = useState(initialRequests.per_page || 15);

    // ── Search suggestions ──────────────────────────────────────────────
    const [suggestions, setSuggestions]       = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef        = useRef(null);
    const suggestionsTimeout = useRef(null);

    // ── Modals + selected request ────────────────────────────────────────
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    // ── Inertia forms ────────────────────────────────────────────────────
    const approveForm = useForm({ review_remarks: '' });
    const rejectForm = useForm({ review_remarks: '' });

    /* ── AJAX filtering ──────────────────────────────────────────────── */
    const fetchRequests = useCallback((status, search, page = 1, newPerPage, showAllFlag = showAll) => {
        setIsFiltering(true);

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        params.set('page', page);
        if (newPerPage) params.set('per_page', newPerPage);
        if (showAllFlag) params.set('all', '1');

        fetch(route('admin.schedule-change-requests.filter') + '?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch schedule change requests: ${res.status} ${res.statusText}`);
                }
                return res.json();
            })
            .then((data) => {
                setRequestsData(data);
                setCurrentPage(data.current_page || 1);
            })
            .catch((error) => {
                console.error('Error fetching schedule change requests:', error);
                window.alert('Failed to load schedule change requests. Please try again.');
            })
            .finally(() => setIsFiltering(false));
    }, [showAll]);

    const applyFilter = (status) => {
        setFilterStatus(status);
        const nextShowAll = status === '';
        setShowAll(nextShowAll);
        fetchRequests(status, searchQuery, 1, undefined, nextShowAll);
    };

    const applySearch = (e) => {
        e.preventDefault();
        setSearchQuery(searchInput);
        fetchRequests(filterStatus, searchInput, 1, undefined, showAll);
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
        fetchRequests(filterStatus, '', 1, undefined, showAll);
    };

    const goToPage = (page) => {
        fetchRequests(filterStatus, searchQuery, page, perPage, showAll);
    };

    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage);
        fetchRequests(filterStatus, searchQuery, 1, newPerPage, showAll);
    };

    // ── Search Suggestions (AJAX) ──
    const handleSearchInput = (val) => {
        setSearchInput(val);
        if (suggestionsTimeout.current) clearTimeout(suggestionsTimeout.current);
        if (val.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        suggestionsTimeout.current = setTimeout(async () => {
            try {
                const res = await axios.get(route('admin.schedule-change-requests.suggestions'), { params: { q: val } });
                setSuggestions(res.data);
                setShowSuggestions(res.data.length > 0);
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
    };

    const pickSuggestion = (sug) => {
        setSearchInput(sug.value);
        setSearchQuery(sug.value);
        setShowSuggestions(false);
        fetchRequests(filterStatus, sug.value, 1);
    };

    // Close suggestions when clicking outside the search box
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ── Approve ─────────────────────────────────────────────────────── */
    const openApprove = (req) => {
        setSelectedRequest(req);
        approveForm.reset();
        setShowApproveModal(true);
    };

    const handleApprove = (e) => {
        e.preventDefault();
        approveForm.patch(route('admin.schedule-change-requests.approve', selectedRequest.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowApproveModal(false);
                setSelectedRequest(null);
                approveForm.reset();
                fetchRequests(filterStatus, searchQuery, currentPage);
            },
        });
    };

    /* ── Reject ──────────────────────────────────────────────────────── */
    const openReject = (req) => {
        setSelectedRequest(req);
        rejectForm.reset();
        setShowRejectModal(true);
    };

    const handleReject = (e) => {
        e.preventDefault();
        rejectForm.patch(route('admin.schedule-change-requests.reject', selectedRequest.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowRejectModal(false);
                setSelectedRequest(null);
                rejectForm.reset();
                fetchRequests(filterStatus, searchQuery, currentPage);
            },
        });
    };

    /* ── Render ──────────────────────────────────────────────────────── */
    return (
        <AuthenticatedLayout>
            <Head title="Schedule Change Requests — Admin" />

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {STRINGS.changeRequestsPageTitle}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {STRINGS.changeRequestsDescription}
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
                    <div className="relative flex-1" ref={searchRef}>
                        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by faculty name, schedule code, course code, room code, department, reason…"
                            value={searchInput}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            onFocus={() => searchInput.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
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
                        {showSuggestions && (
                            <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-60 overflow-y-auto">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => pickSuggestion(s)}
                                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
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

            {/* ── Spinner ─────────────────────────────────────────────── */}
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
                        <RequestCard
                            key={req.id}
                            req={req}
                            onApprove={() => openApprove(req)}
                            onReject={() => openReject(req)}
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
                                    Approve Request
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    This will update the official schedule immediately.
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
                                    Change Summary
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">From</p>
                                        <p>{selectedRequest.original_day} · {formatTimeToAmPm(selectedRequest.original_time_in)}–{formatTimeToAmPm(selectedRequest.original_time_out)}</p>
                                        <p className="text-xs text-gray-500">Room: {selectedRequest.original_room}</p>
                                    </div>
                                    <svg className="h-5 w-5 text-gray-400 self-center" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                                    </svg>
                                    <div className="flex-1 text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
                                        <p className="text-xs font-bold text-emerald-500 dark:text-emerald-500 uppercase mb-1">To</p>
                                        <p>{selectedRequest.requested_day} · {formatTimeToAmPm(selectedRequest.requested_time_in)}–{formatTimeToAmPm(selectedRequest.requested_time_out)}</p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-500">Room: {selectedRequest.requested_room || selectedRequest.original_room}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Optional remarks */}
                            <div>
                                <InputLabel value="Remarks (optional)" htmlFor="approve_remarks" />
                                <textarea
                                    id="approve_remarks"
                                    rows={3}
                                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                    placeholder="Add an optional note for the faculty…"
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
                                    Approve & Update Schedule
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
                                <p className="font-bold text-gray-800 dark:text-gray-200">{selectedRequest.original_subject}</p>
                                <p className="text-gray-500 dark:text-gray-400">{selectedRequest.faculty_name} · {selectedRequest.faculty_code}</p>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    Requested: {selectedRequest.requested_day} · {formatTimeToAmPm(selectedRequest.requested_time_in)}–{formatTimeToAmPm(selectedRequest.requested_time_out)}
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
                                    placeholder="Explain why this request cannot be approved (e.g., room unavailable, schedule conflict, policy constraint)…"
                                    value={rejectForm.data.review_remarks}
                                    onChange={(e) => rejectForm.setData('review_remarks', e.target.value)}
                                />
                                <InputError message={rejectForm.errors.review_remarks} />
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                    Minimum 5 characters. The faculty member will see this remark.
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

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}

/* ──────────────────────────────────────────────
   Request Card Component
   ────────────────────────────────────────────── */
function RequestCard({ req, onApprove, onReject }) {
    const dayColor = DAY_AVATAR_COLORS[req.original_day] ?? 'from-gray-400 to-gray-500';
    const [isExpanded, setIsExpanded] = useState(false);
    const [previewModalUrl, setPreviewModalUrl] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    const reviewBlockStyle = req.status === 'approved'
        ? { wrap: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30', text: 'text-emerald-600 dark:text-emerald-400' }
        : { wrap: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30', text: 'text-amber-600 dark:text-amber-400' };

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter') { toggleExpand(); } else if (e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        >
            <div className="p-5">
                {/* ── Top row: faculty info + day badge + status ── */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${dayColor} text-white font-bold text-xs shadow-sm`}>
                            {req.original_day.slice(0, 3)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white leading-tight">
                                {req.original_subject}
                                {req.original_subject_desc && (
                                    <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                                        {req.original_subject_desc}
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {req.faculty_name}
                                </p>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {req.faculty_code}
                                </p>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {req.department}
                                </p>
                                {req.schedule_code && (
                                    <>
                                        <span className="text-gray-300 dark:text-gray-600">·</span>
                                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-300/50 dark:ring-gray-600/50">
                                            {req.schedule_code}
                                        </span>
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Submitted {formatDateTime(req.created_at)}
                            </p>
                            {(req.program_code || req.year_level || req.section_name) && (
                                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                                    {[req.program_code, (req.year_level || req.section_name) ? [req.year_level, req.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset capitalize ${STATUS_STYLES[req.status]}`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
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

                {/* ── Action buttons ── */}
                <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        Click card to {isExpanded ? 'hide' : 'show'} details
                    </p>
                    {req.status === 'pending' && (
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

                <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr]'} `}>
                    <div className="overflow-hidden">
                        {/* ── Schedule comparison ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Official Schedule</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Day:</span> {req.original_day}</p>
                                    <p><span className="font-semibold">Time:</span> {formatTimeToAmPm(req.original_time_in)} – {formatTimeToAmPm(req.original_time_out)}</p>
                                    <p><span className="font-semibold">Room:</span> {req.original_room}</p>
                                </div>
                            </div>
                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-800/40">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Requested Change</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Day:</span> {req.requested_day}</p>
                                    <p><span className="font-semibold">Time:</span> {formatTimeToAmPm(req.requested_time_in)} – {formatTimeToAmPm(req.requested_time_out)}</p>
                                    <p><span className="font-semibold">Room:</span> {req.requested_room || 'Same'}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Effective date ── */}
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-1">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                </svg>
                                Effective: {req.effective_date}
                            </span>
                        </div>

                        {/* ── Reason ── */}
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/20 border border-gray-100 dark:border-gray-700/40">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Reason</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{req.reason}</p>
                        </div>

                        {/* ── Supporting Document ── */}
                        {req.supporting_document_url && (
                            <div className="mt-4">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Supporting Document</p>
                                <div
                                    onClick={(e) => { e.stopPropagation(); setPreviewModalUrl(req.supporting_document_url); setShowPreviewModal(true); }}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition hover:border-blue-400 dark:hover:border-blue-500 w-full sm:w-48 h-32 flex items-center justify-center"
                                >
                                    {req.supporting_document_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                        <img src={req.supporting_document_url} alt="Supporting Document" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors">
                                            <svg className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                            </svg>
                                            <span className="text-sm font-semibold">View Document</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg className="h-8 w-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Review details (always visible once reviewed) ── */}
                        {req.reviewed_at && (
                            <div className={`mt-3 p-3 rounded-lg border ${reviewBlockStyle.wrap}`}>
                                <p className={`text-xs font-bold mb-1 ${reviewBlockStyle.text}`}>
                                    Reviewed by{' '}
                                    <span className="font-semibold">
                                        {req.reviewed_by_email || 'Unknown reviewer'}
                                    </span>
                                    {' '}on {formatDateTime(req.reviewed_at)}
                                </p>
                                {req.review_remarks && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{req.review_remarks}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Preview Modal */}
            <Modal show={showPreviewModal} onClose={() => setShowPreviewModal(false)} maxWidth="2xl">
                <div onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Document Preview</h2>
                        <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-4 relative bg-gray-50 dark:bg-gray-900 min-h-[50vh] flex items-center justify-center overflow-auto">
                        {previewModalUrl && previewModalUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                            <img src={previewModalUrl} alt="Preview" className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-sm" />
                        ) : previewModalUrl ? (
                            <iframe src={previewModalUrl} className="w-full h-[70vh] rounded-lg bg-white shadow-sm" title="Document Preview" />
                        ) : null}
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <SecondaryButton onClick={() => setShowPreviewModal(false)}>Close</SecondaryButton>
                        <a href={previewModalUrl} download target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-2 rounded-xl bg-[#7a1315] px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-sm font-bold text-white shadow-md hover:from-red-700 hover:to-red-900 transition-all dark:from-red-600 dark:to-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                            Download File
                        </a>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Empty state component
   ────────────────────────────────────────────── */
function EmptyState({ filterStatus, searchQuery }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 py-20 text-center bg-white dark:bg-gray-800/80">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125-.504-1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {searchQuery
                    ? `No requests found for "${searchQuery}"`
                    : filterStatus
                        ? `No ${filterStatus} requests`
                        : 'No schedule change requests yet'}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {searchQuery || filterStatus
                    ? 'Try adjusting your search or filter.'
                    : 'Faculty schedule change requests will appear here.'}
            </p>
        </div>
    );
}
