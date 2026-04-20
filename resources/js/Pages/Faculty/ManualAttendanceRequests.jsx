import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import MultiFileUploader from '@/Components/MultiFileUploader';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/30',
};

const formatTime12 = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours);
    const m = minutes || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
};

const extractTimeFromDateTime = (datetimeString) => {
    if (!datetimeString) return '';
    try {
        // Parse the ISO datetime and convert to local time
        const date = new Date(datetimeString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        // Fallback to substring extraction
        return datetimeString?.substring(11, 16) || '';
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

export default function ManualAttendanceRequests({ 
    requests: initialRequests, 
    filters, 
    availableDates = [],
    approvedCountingRequestsCount = 0,
    manualRequestLimit = 5,
}) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');
    const [selectedDate, setSelectedDate] = useState(availableDates && availableDates.length > 0 ? availableDates[0] : null);
    const [expandedRequests, setExpandedRequests] = useState(new Set());

    // ── AJAX-driven requests list ────────────────────────────
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);
    const [countingRequestsCount, setCountingRequestsCount] = useState(approvedCountingRequestsCount);
    const [requestLimit, setRequestLimit] = useState(manualRequestLimit);

    // ── File preview & Modal state ───────────────────────────────
    const [previewModalUrl, setPreviewModalUrl] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [attachmentFiles, setAttachmentFiles] = useState([]);
    const [fileUploadError, setFileUploadError] = useState(null);

    // ── Toggle expanded state ────────────────────────────────
    const toggleExpanded = (requestId) => {
        setExpandedRequests((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(requestId)) {
                newSet.delete(requestId);
            } else {
                newSet.add(requestId);
            }
            return newSet;
        });
    };

    // ── Create form ──────────────────────────────────────────
    const createForm = useForm({
        attendance_record_id: selectedDate?.id || '',
        requested_time_in: '',
        requested_time_out: '',
        justification: '',
    });

    const handleFilesChange = (files) => {
        setAttachmentFiles(files);
        setFileUploadError(null);
    };

    const handleFileUploadError = (error) => {
        setFileUploadError(error);
    };

    const handleCreate = (e) => {
        e.preventDefault();

        // Create FormData to handle multiple files
        const formData = new FormData();
        formData.append('attendance_record_id', createForm.data.attendance_record_id);
        formData.append('requested_time_in', createForm.data.requested_time_in);
        formData.append('requested_time_out', createForm.data.requested_time_out);
        formData.append('justification', createForm.data.justification);

        // Append all files
        attachmentFiles.forEach((file, index) => {
            formData.append(`attachments[${index}]`, file);
        });

        // Post using Inertia router
        createForm.post(route('faculty.manual-attendance-requests.store'), {
            data: formData,
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                setAttachmentFiles([]);
                setFileUploadError(null);
                setSelectedDate(availableDates && availableDates.length > 0 ? availableDates[0] : null);
                fetchRequests(filterStatus, 1);
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                toast.error(firstError || 'Please fix the errors and try again.');
            },
        });
    };

    // ── Cancel (delete) ──────────────────────────────────────
    const cancelForm = useForm({});
    const handleCancel = () => {
        cancelForm.delete(route('faculty.manual-attendance-requests.destroy', selectedRequest.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowCancelModal(false);
                setSelectedRequest(null);
                fetchRequests(filterStatus, currentPage);
            },
        });
    };

    // ── AJAX filter & pagination ─────────────────────────────
    const fetchRequests = useCallback((status, page = 1) => {
        setIsFiltering(true);

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        params.set('page', page);

        fetch(route('faculty.manual-attendance-requests.filter') + '?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((res) => res.json())
            .then((data) => {
                setRequestsData(data);
                setCurrentPage(data.current_page || 1);
                setCountingRequestsCount(data.approvedCountingRequestsCount || 0);
                setRequestLimit(data.manualRequestLimit || 5);
            })
            .catch(() => {})
            .finally(() => setIsFiltering(false));
    }, []);

    const applyFilter = (status) => {
        setFilterStatus(status);
        fetchRequests(status, 1);
    };

    const handlePaginationClick = (page) => {
        setCurrentPage(page);
        fetchRequests(filterStatus, page);
    };

    const handleDateChange = (e) => {
        const selectedId = parseInt(e.target.value);
        const date = availableDates.find((d) => d.id === selectedId);
        setSelectedDate(date);
        createForm.setData('attendance_record_id', selectedId);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manual Attendance Requests" />
            <ScrollToTop />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Manual Attendance Requests
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Request to record your manual time in/out entries
                        </p>
                    </div>
                    <PrimaryButton onClick={() => setShowCreateModal(true)}>
                        + New Request
                    </PrimaryButton>
                </div>

                {/* Request Limit Counter */}
                <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                                Approved Requests (Counting Towards Limit)
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                You have {countingRequestsCount} of {requestLimit} approved requests that count towards your annual limit.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                                    {countingRequestsCount}/{requestLimit}
                                </p>
                            </div>
                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{
                                background: countingRequestsCount >= requestLimit 
                                    ? 'rgb(220, 38, 38)' 
                                    : 'linear-gradient(135deg, rgb(59, 130, 246), rgb(99, 102, 241))',
                            }}>
                                <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {((countingRequestsCount / requestLimit) * 100).toFixed(0)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex gap-2 flex-wrap">
                    {['', 'pending', 'approved', 'rejected'].map((s) => (
                        <button
                            key={s}
                            onClick={() => applyFilter(s)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === s
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                        >
                            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Requests List */}
                <div className="space-y-3">
                    {requestsData.data && requestsData.data.length > 0 ? (
                        requestsData.data.map((request) => {
                            const isExpanded = expandedRequests.has(request.id);
                            return (
                                <div
                                    key={request.id}
                                    onClick={() => toggleExpanded(request.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleExpanded(request.id);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                >
                                    <div className="p-5">
                                        {/* Header Row */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                                        {request.course_name}
                                                    </h3>
                                                    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[request.status]}`}>
                                                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                    </span>
                                                    {request.status === 'pending' && request.counts_as_manual_log === 0 && (
                                                        <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold text-yellow-700 bg-yellow-50 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-400 dark:ring-yellow-400/30">
                                                            Not Counted (Pending)
                                                        </span>
                                                    )}
                                                    {(request.status === 'approved' || request.status === 'rejected') && (
                                                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
                                                            request.counts_as_manual_log
                                                                ? 'text-emerald-700 bg-emerald-50 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30'
                                                                : 'text-orange-700 bg-orange-50 ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/30'
                                                        }`}>
                                                            {request.counts_as_manual_log ? 'Counts Toward Limit' : 'Not Counted'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                    {request.attendance_date}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{formatTime12(extractTimeFromDateTime(request.requested_time_in))} - {formatTime12(extractTimeFromDateTime(request.requested_time_out))}</span>
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Submitted {new Date(request.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            </div>
                                            <svg
                                                className={`h-5 w-5 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={2}
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </div>

                                        {/* Action Hint + Buttons */}
                                        <div className="mt-4 flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                Click card to {isExpanded ? 'hide' : 'show'} details
                                            </p>
                                            {request.status === 'pending' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRequest(request);
                                                        setShowCancelModal(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            )}
                                        </div>

                                        {/* Expandable Details */}
                                        <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr]'}`}>
                                            <div className="overflow-hidden">
                                                <div className="space-y-4">
                                                    {/* Reason/Justification */}
                                                    {request.justification && (
                                                        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Reason</p>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300">{request.justification}</p>
                                                        </div>
                                                    )}

                                                    {/* Attachment preview button */}
                                                    {request.attachment_url && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewModalUrl(request.attachment_url);
                                                                    setShowPreviewModal(true);
                                                                }}
                                                                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375m0 0H5.625c-.621 0-1.125-.504-1.125-1.125v-9.75m7.5 10.375v-6.375m0 6.375H9.375" />
                                                                </svg>
                                                                View Attachment
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Review info if approved/rejected */}
                                                    {request.status !== 'pending' && (
                                                        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Review Information</p>
                                                            <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                                                                {request.review_remarks && (
                                                                    <p><span className="font-semibold">Remarks:</span> {request.review_remarks}</p>
                                                                )}
                                                                <p>
                                                                    <span className="font-semibold">Counts Toward Limit:</span>{' '}
                                                                    {request.counts_as_manual_log ? (
                                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Yes</span>
                                                                    ) : (
                                                                        <span className="text-orange-600 dark:text-orange-400 font-semibold">No (Exempted)</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Limit status for pending requests */}
                                                    {request.status === 'pending' && (
                                                        <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-100 dark:border-yellow-800/50">
                                                            <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-2">Pending Review</p>
                                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                                This request does not count toward your 5-request limit yet. Once approved or rejected by the admin, it may count depending on the admin's decision.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm p-12 text-center">
                            <p className="text-gray-500 dark:text-gray-400">No requests found</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {requestsData.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        {Array.from({ length: requestsData.last_page }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => handlePaginationClick(page)}
                                className={`rounded px-3 py-2 text-sm transition-colors ${
                                    currentPage === page
                                        ? 'bg-blue-600 text-white'
                                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)}>
                <div className="max-w-100 max-h-[90vh] overflow-y-auto">
                    <div className="space-y-6 p-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Manual Attendance Request
                            </h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Submit a request to record your manual time in/out entries
                            </p>
                        </div>

                        {availableDates.length === 0 ? (
                            <div className="flex justify-center">
                                <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 text-center max-w-sm">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        No dates available for manual time entry. All your attendance records have complete time entries.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleCreate} className="space-y-6">
                                {/* Date Selection */}
                                <div>
                                    <InputLabel htmlFor="date-select" value="Select Date" />
                                    <select
                                        id="date-select"
                                        value={selectedDate?.id || ''}
                                        onChange={handleDateChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                        required
                                    >
                                        <option value="">-- Select Date --</option>
                                        {availableDates.filter(d => !d.has_pending_request).map((date) => (
                                            <option key={date.id} value={date.id}>
                                                {date.attendance_date} - {date.course_name}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={createForm.errors.attendance_record_id} />
                                </div>

                                {/* Current Times Display */}
                                {selectedDate && (
                                    <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-900 dark:text-blue-300">
                                            <span className="font-medium">Current Time In:</span> {selectedDate.actual_time_in || 'Not recorded'}
                                        </p>
                                        <p className="text-sm text-blue-900 dark:text-blue-300 mt-1">
                                            <span className="font-medium">Current Time Out:</span> {selectedDate.actual_time_out || 'Not recorded'}
                                        </p>
                                    </div>
                                )}

                                {/* Time Section */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                        Time Entry
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Time In */}
                                        <div>
                                            <InputLabel htmlFor="time-in" value="Time In (HH:MM)" />
                                            <TextInput
                                                id="time-in"
                                                type="time"
                                                value={createForm.data.requested_time_in}
                                                onChange={(e) => createForm.setData('requested_time_in', e.target.value)}
                                                className="mt-1"
                                            />
                                            <InputError message={createForm.errors.requested_time_in} />
                                        </div>

                                        {/* Time Out */}
                                        <div>
                                            <InputLabel htmlFor="time-out" value="Time Out (HH:MM)" />
                                            <TextInput
                                                id="time-out"
                                                type="time"
                                                value={createForm.data.requested_time_out}
                                                onChange={(e) => createForm.setData('requested_time_out', e.target.value)}
                                                className="mt-1"
                                            />
                                            <InputError message={createForm.errors.requested_time_out} />
                                        </div>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                        Reason
                                    </h3>
                                    
                                    <div>
                                        <InputLabel htmlFor="justification" value="Reason for Manual Entry" />
                                        <textarea
                                            id="justification"
                                            value={createForm.data.justification}
                                            onChange={(e) => createForm.setData('justification', e.target.value)}
                                            rows="4"
                                            maxLength="1000"
                                            placeholder="Explain why you need to manually record this time in/out"
                                            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2"
                                            required
                                        />
                                        <InputError message={createForm.errors.justification} />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {createForm.data.justification.length}/1000 characters
                                        </p>
                                    </div>
                                </div>

                                {/* File Upload Section */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <MultiFileUploader
                                        label="Supporting Documents"
                                        description="Upload supporting files (5MB per file)"
                                        value={attachmentFiles}
                                        onChange={handleFilesChange}
                                        onError={handleFileUploadError}
                                        error={fileUploadError}
                                        disabled={createForm.processing}
                                    />
                                </div>

                                {/* Submit Buttons */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex justify-end gap-3">
                                    <SecondaryButton onClick={() => setShowCreateModal(false)}>
                                        Cancel
                                    </SecondaryButton>
                                    <PrimaryButton disabled={createForm.processing} type="submit">
                                        {createForm.processing ? 'Submitting...' : 'Submit Request'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showCancelModal} onClose={() => setShowCancelModal(false)}>
                <div className="space-y-6 p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Delete Request
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete this manual attendance request? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <SecondaryButton onClick={() => setShowCancelModal(false)}>
                            Keep Request
                        </SecondaryButton>
                        <DangerButton onClick={handleCancel} disabled={cancelForm.processing}>
                            {cancelForm.processing ? 'Deleting...' : 'Delete Request'}
                        </DangerButton>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            <Modal show={showPreviewModal} onClose={() => setShowPreviewModal(false)}>
                <div className="p-6">
                    {previewModalUrl?.includes('image') || previewModalUrl?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img src={previewModalUrl} alt="Preview" className="max-w-full rounded-lg" />
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">Document Preview</p>
                            <a
                                href={previewModalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                📥 Download Document
                            </a>
                        </div>
                    )}
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
