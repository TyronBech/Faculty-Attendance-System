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
import toast from 'react-hot-toast';

const STATUS_BADGE = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/30',
};

function ApprovalCard({ justification, onApprove, onReject, isExpanded, toggleExpand }) {
    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    const formatTimeDifference = (minutes) => {
        // Ensure we have a valid number
        const totalMinutes = parseInt(minutes, 10) || 0;
        if (totalMinutes <= 0) return '0m';

        const hours = Math.floor(totalMinutes / 60);
        const mins = Math.round(totalMinutes % 60);

        // Format without trailing zeros
        if (hours > 0 && mins > 0) {
            return `${hours}h ${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
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

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        >
            <div className="p-5 sm:p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-1">
                            {justification.faculty_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {justification.faculty_email}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold ring-1 ring-inset ${STATUS_BADGE[justification.status]}`}>
                                {justification.status.charAt(0).toUpperCase() + justification.status.slice(1)}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">·</span>
                            <span className="text-gray-600 dark:text-gray-400">
                                {justification.attendance_date}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">·</span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-white bg-red-500 dark:bg-red-600 font-bold">
                                {formatTimeDifference(justification.undertime_minutes)} Undertime
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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

                {/* Time Details Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">In</p>
                        <p className="text-gray-900 dark:text-white font-bold">{justification.actual_time_in}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Out</p>
                        <p className="text-gray-900 dark:text-white font-bold">{justification.actual_time_out}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Expected</p>
                        <p className="text-gray-900 dark:text-white font-bold">{justification.operational_time_out}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 mt-4">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        Click to {isExpanded ? 'hide' : 'show'} details
                    </p>
                    {justification.status === 'pending' && (
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
                        {/* Full Justification */}
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Full Justification
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {justification.justification}
                            </p>
                        </div>

                        {/* Review Details */}
                        {justification.status !== 'pending' && justification.reviewed_at && (
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50 p-4">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Review Information
                                </p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Reviewed by:</span> {justification.reviewer_email}</p>
                                    <p><span className="font-semibold">Date:</span> {formatDateTime(justification.reviewed_at)}</p>
                                    {justification.review_remarks && (
                                        <div className="mt-2">
                                            <p className="font-semibold text-gray-600 dark:text-gray-400">Admin Notes:</p>
                                            <p className="text-gray-700 dark:text-gray-300">{justification.review_remarks}</p>
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
                No justifications to review
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {filterStatus === 'pending' && 'All pending justifications have been processed.'}
                {filterStatus && filterStatus !== 'pending' && `No ${filterStatus} justifications.`}
                {searchQuery && `No results match "${searchQuery}".`}
                {!filterStatus && !searchQuery && 'All undertime justifications will appear here.'}
            </p>
        </div>
    );
}

export default function UndertimeJustificationApproval({ justifications: initialJustifications, paginator: initialPaginator, filters: initialFilters, pendingCount }) {
    const [justificationsData, setJustificationsData] = useState(initialJustifications);
    const [paginator, setPaginator] = useState(initialPaginator);
    const [searchInput, setSearchInput] = useState(initialFilters.search || '');
    const [searchQuery, setSearchQuery] = useState(initialFilters.search || '');
    const [filterStatus, setFilterStatus] = useState(initialFilters.status || '');
    const [isFiltering, setIsFiltering] = useState(false);
    const [expandedCards, setExpandedCards] = useState({});

    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedJustification, setSelectedJustification] = useState(null);

    const approveForm = useForm({ review_remarks: '' });
    const rejectForm = useForm({ review_remarks: '' });

    const fetchJustifications = useCallback((status, search, page = 1) => {
        setIsFiltering(true);

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        params.set('page', page);

        fetch(route('admin.undertime-justifications.filter') + '?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error('Failed to fetch justifications');
                return res.json();
            })
            .then((data) => {
                setJustificationsData(data.data);
                setPaginator(data.pagination);
                setExpandedCards({});
            })
            .catch((error) => {
                console.error('Error:', error);
                toast.error('Failed to load justifications. Please try again.');
            })
            .finally(() => setIsFiltering(false));
    }, []);

    const applyFilter = (status) => {
        setFilterStatus(status);
        setSearchInput('');
        setSearchQuery('');
        fetchJustifications(status, '', 1);
    };

    const applySearch = (e) => {
        e.preventDefault();
        setSearchQuery(searchInput);
        setFilterStatus('');
        fetchJustifications('', searchInput, 1);
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setFilterStatus('');
        fetchJustifications('', '', 1);
    };

    const goToPage = (page) => {
        fetchJustifications(filterStatus, searchQuery, page);
    };

    const toggleExpand = (id) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const openApprove = (justification) => {
        setSelectedJustification(justification);
        approveForm.reset();
        setShowApproveModal(true);
    };

    const handleApprove = (e) => {
        e.preventDefault();
        approveForm.patch(route('admin.undertime-justifications.approve', selectedJustification.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowApproveModal(false);
                setSelectedJustification(null);
                approveForm.reset();
                fetchJustifications(filterStatus, searchQuery, paginator.current_page);
                toast.success('Undertime justification approved successfully.');
            },
            onError: () => {
                toast.error('Failed to approve justification.');
            },
        });
    };

    const openReject = (justification) => {
        setSelectedJustification(justification);
        rejectForm.reset();
        setShowRejectModal(true);
    };

    const handleReject = (e) => {
        e.preventDefault();
        rejectForm.patch(route('admin.undertime-justifications.reject', selectedJustification.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowRejectModal(false);
                setSelectedJustification(null);
                rejectForm.reset();
                fetchJustifications(filterStatus, searchQuery, paginator.current_page);
                toast.success('Undertime justification rejected successfully.');
            },
            onError: () => {
                toast.error('Failed to reject justification.');
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Undertime Justifications — Admin" />

            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Undertime Justifications
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Review and approve faculty undertime justifications
                    </p>
                </div>

                {/* Pending badge */}
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 shadow-sm">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {pendingCount} pending {pendingCount === 1 ? 'justification' : 'justifications'}
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
                            placeholder="Search by faculty name or justification…"
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

            {/* ── Justification cards ───────────────────────────────────── */}
            {!isFiltering && justificationsData && justificationsData.length > 0 ? (
                <div className="space-y-4">
                    {justificationsData.map((justification) => (
                        <ApprovalCard
                            key={justification.id}
                            justification={justification}
                            isExpanded={expandedCards[justification.id] || false}
                            toggleExpand={() => toggleExpand(justification.id)}
                            onApprove={() => openApprove(justification)}
                            onReject={() => openReject(justification)}
                        />
                    ))}

                    {/* Pagination */}
                    <Pagination
                        currentPage={paginator.current_page}
                        totalItems={paginator.total}
                        perPage={paginator.per_page}
                        onPageChange={goToPage}
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
                                    Approve Justification
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Confirm approval of this undertime justification
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4 space-y-4">
                        {/* Summary */}
                        {selectedJustification && (
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4">
                                <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-100 mb-2">
                                    {selectedJustification.faculty_name}
                                </h3>
                                <div className="space-y-1 text-xs text-emerald-800 dark:text-emerald-200">
                                    <p><span className="font-semibold">Date:</span> {selectedJustification.attendance_date}</p>
                                    <p><span className="font-semibold">Time In:</span> {selectedJustification.actual_time_in}</p>
                                    <p><span className="font-semibold">Time Out:</span> {selectedJustification.actual_time_out}</p>
                                </div>
                            </div>
                        )}

                        {/* Remarks Field */}
                        <div>
                            <InputLabel htmlFor="approve_remarks" value="Optional Remarks" />
                            <textarea
                                id="approve_remarks"
                                value={approveForm.data.review_remarks}
                                onChange={(e) => approveForm.setData('review_remarks', e.target.value)}
                                placeholder="Add any notes or remarks for your approval…"
                                rows="3"
                                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                            />
                            <InputError message={approveForm.errors.review_remarks} className="mt-1" />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                        <SecondaryButton onClick={() => setShowApproveModal(false)} disabled={approveForm.processing}>
                            Cancel
                        </SecondaryButton>
                        <button
                            type="submit"
                            disabled={approveForm.processing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                            {approveForm.processing ? 'Approving...' : 'Approve Justification'}
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
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Reject Justification
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Provide a reason for rejecting this justification
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4 space-y-4">
                        {/* Summary */}
                        {selectedJustification && (
                            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4">
                                <h3 className="font-bold text-sm text-red-900 dark:text-red-100 mb-2">
                                    {selectedJustification.faculty_name}
                                </h3>
                                <div className="space-y-1 text-xs text-red-800 dark:text-red-200">
                                    <p><span className="font-semibold">Date:</span> {selectedJustification.attendance_date}</p>
                                    <p><span className="font-semibold">Time In:</span> {selectedJustification.actual_time_in}</p>
                                    <p><span className="font-semibold">Time Out:</span> {selectedJustification.actual_time_out}</p>
                                </div>
                            </div>
                        )}

                        {/* Remarks Field (Required) */}
                        <div>
                            <InputLabel htmlFor="reject_remarks" value="Reason for Rejection *" />
                            <textarea
                                id="reject_remarks"
                                value={rejectForm.data.review_remarks}
                                onChange={(e) => rejectForm.setData('review_remarks', e.target.value)}
                                placeholder="Explain your reason for rejecting this justification…"
                                rows="3"
                                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315] focus:outline-none"
                            />
                            <InputError message={rejectForm.errors.review_remarks} className="mt-1" />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                        <SecondaryButton onClick={() => setShowRejectModal(false)} disabled={rejectForm.processing}>
                            Cancel
                        </SecondaryButton>
                        <button
                            type="submit"
                            disabled={rejectForm.processing || !rejectForm.data.review_remarks.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                            {rejectForm.processing ? 'Rejecting...' : 'Reject Justification'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}
