import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/30',
};

const fmtMins = (m) => {
    if (!m || m <= 0) return '0m';
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const rem = m % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (rem > 0 || (d === 0 && h === 0)) parts.push(`${rem}m`);

    return parts.join(' ');
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

export default function UndertimeRequests({ requests: initialRequests, filters, schedulesWithUndertime = [], commonReasons = [] }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');
    const [selectedSchedule, setSelectedSchedule] = useState(schedulesWithUndertime && schedulesWithUndertime.length > 0 ? schedulesWithUndertime[0] : null);

    // ── AJAX-driven requests list ────────────────────────────
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);

    // ── File preview & Modal state ───────────────────────────────
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const fileAttachmentRef = useRef(null);
    const [previewModalUrl, setPreviewModalUrl] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // ── Create form ──────────────────────────────────────────
    const createForm = useForm({
        attendance_record_id: selectedSchedule?.id || '',
        reason: '',
        attachment: null,
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        createForm.setData('attachment', file);
        createForm.clearErrors('attachment');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPreviewAttachment(ev.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewAttachment('document');
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        
        createForm.post(route('faculty.undertime-requests.store'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                setPreviewAttachment(null);
                setSelectedSchedule(schedulesWithUndertime && schedulesWithUndertime.length > 0 ? schedulesWithUndertime[0] : null);
                fetchRequests(filterStatus, 1);
                toast.success('Undertime request submitted successfully!');
            },
            onError: (errors) => {
                toast.error(errors.reason || 'Please fix the errors and try again.');
            },
        });
    };

    // ── Cancel (delete) ──────────────────────────────────────
    const cancelForm = useForm({});
    const handleCancel = () => {
        cancelForm.delete(
            route('faculty.undertime-requests.destroy', selectedRequest.id),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowCancelModal(false);
                    setSelectedRequest(null);
                    // Refresh the list via AJAX
                    fetchRequests(filterStatus, currentPage);
                },
            },
        );
    };

    // ── AJAX filter & pagination ─────────────────────────────
    const fetchRequests = useCallback((status, page = 1) => {
        setIsFiltering(true);

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        params.set('page', page);

        fetch(route('faculty.undertime-requests.filter') + '?' + params.toString(), {
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
            })
            .catch(() => { })
            .finally(() => setIsFiltering(false));
    }, []);

    const applyFilter = (status) => {
        setFilterStatus(status);
        fetchRequests(status, 1);
    };

    const goToPage = (page) => {
        fetchRequests(filterStatus, page);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Undertime Requests" />

            {/* ── Header ────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <Link
                        href={route('faculty.attendance')}
                        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-2"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                        Back to Attendance
                    </Link>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Undertime Requests
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Request approval for undertime occurrences. Requests require admin approval.
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-900/20 transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Request
                </button>
            </div>

            {/* ── Status filter tabs ────────────────────────── */}
            <div className="flex gap-2 mb-6 flex-wrap">
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

            {/* ── Requests list ──────────────────────────────── */}
            {isFiltering && (
                <div className="flex justify-center py-8">
                    <svg className="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                </div>
            )}

            {!isFiltering && requestsData.data && requestsData.data.length > 0 ? (
                <div className="space-y-4">
                    {requestsData.data.map((req) => (
                        <RequestCard
                            key={req.id}
                            req={req}
                            onCancel={() => { setSelectedRequest(req); setShowCancelModal(true); }}
                            onPreviewAttachment={(url) => { setPreviewModalUrl(url); setShowPreviewModal(true); }}
                        />
                    ))}

                    {/* Pagination */}
                    {requestsData.last_page > 1 && (
                        <div className="flex items-center justify-between pt-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Page {requestsData.current_page} of {requestsData.last_page} ({requestsData.total} total)
                            </p>
                            <div className="flex gap-2">
                                {requestsData.current_page > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => goToPage(requestsData.current_page - 1)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Previous
                                    </button>
                                )}
                                {requestsData.current_page < requestsData.last_page && (
                                    <button
                                        type="button"
                                        onClick={() => goToPage(requestsData.current_page + 1)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Next
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : !isFiltering ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 py-20 text-center bg-white dark:bg-gray-800/80">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-4">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No undertime requests yet</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Click "New Request" to submit an undertime request.
                    </p>
                </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════
                 CREATE MODAL - SIDE BY SIDE
                ═══════════════════════════════════════════════════ */}
            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-[75vh] overflow-hidden">
                    {/* Left: Schedule Selection */}
                    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900/30 border-r border-gray-100 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Classes with Undertime</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 p-4 min-h-0">
                            {schedulesWithUndertime && schedulesWithUndertime.length > 0 ? (
                                schedulesWithUndertime.map((schedule) => (
                                    <div
                                        key={schedule.id}
                                        onClick={() => {
                                            setSelectedSchedule(schedule);
                                            createForm.setData('attendance_record_id', schedule.id);
                                        }}
                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                            selectedSchedule?.id === schedule.id
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
                                        }`}
                                    >
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">
                                            {schedule.subject}
                                        </h4>
                                        {schedule.program_code && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Program: {schedule.program_code}
                                            </p>
                                        )}
                                        {schedule.year_level && schedule.section_name && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Year {schedule.year_level} - Section {schedule.section_name}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            {schedule.attendance_date}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                            {schedule.scheduled_time_in} - {schedule.scheduled_time_out}
                                        </p>
                                        <div className="mt-2 flex justify-between items-center">
                                            <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                                {fmtMins(schedule.undertime_minutes)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                                    No schedules with undertime found
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Request Form */}
                    <div className="flex flex-col h-full">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Request Details</h3>
                        </div>
                        
                        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                                {/* Schedule Context */}
                                {selectedSchedule && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                        <p className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-2">Schedule Context</p>
                                        <div className="text-xs space-y-1 text-blue-800 dark:text-blue-400">
                                            <p><strong>Course:</strong> {selectedSchedule.subject}</p>
                                            {selectedSchedule.program_code && (
                                                <p><strong>Program:</strong> {selectedSchedule.program_code}</p>
                                            )}
                                            {selectedSchedule.year_level && selectedSchedule.section_name && (
                                                <p><strong>Year & Section:</strong> Year {selectedSchedule.year_level} - Section {selectedSchedule.section_name}</p>
                                            )}
                                            <p><strong>Expected:</strong> {selectedSchedule.required_hours}h</p>
                                            <p><strong>Rendered:</strong> {selectedSchedule.total_hours_rendered}h</p>
                                            <p className="pt-1 border-t border-blue-200 dark:border-blue-800 font-bold text-red-600 dark:text-red-400">
                                                <strong>Undertime:</strong> {fmtMins(selectedSchedule.undertime_minutes)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Reason for Undertime - Textarea */}
                                <div>
                                    <InputLabel value="Reason for Undertime" htmlFor="reason" />
                                    <textarea
                                        id="reason"
                                        rows={3}
                                        className="mt-2 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                        value={createForm.data.reason}
                                        onChange={(e) => { createForm.setData('reason', e.target.value); createForm.clearErrors('reason'); }}
                                        placeholder="Briefly explain the reason for your undertime..."
                                    />
                                    <InputError message={createForm.errors.reason} />
                                </div>

                                {/* Attachment */}
                                <div>
                                    <InputLabel value="Attachment (Optional)" />
                                    <div
                                        onClick={() => fileAttachmentRef.current?.click()}
                                        className="mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-800"
                                    >
                                        {previewAttachment === 'document' ? (
                                            <div className="text-center text-blue-600 dark:text-blue-400">
                                                <p className="text-xs font-bold">{createForm.data.attachment?.name}</p>
                                                <p className="text-xs mt-1 opacity-70">Click to change</p>
                                            </div>
                                        ) : previewAttachment ? (
                                            <img src={previewAttachment} alt="Preview" className="max-h-20 rounded object-contain" />
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                                </svg>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Upload file</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">PDF, JPG, PNG (max 5MB)</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={fileAttachmentRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 flex-shrink-0">
                                <SecondaryButton type="button" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </SecondaryButton>
                                <PrimaryButton type="submit" disabled={createForm.processing || !selectedSchedule || !createForm.data.reason?.trim()}>
                                    {createForm.processing ? 'Submitting…' : 'Submit Request'}
                                </PrimaryButton>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                 CANCEL CONFIRMATION MODAL
                ═══════════════════════════════════════════════════ */}
            <Modal show={showCancelModal} onClose={() => setShowCancelModal(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                        Cancel Request
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Are you sure you want to cancel this undertime request? This action cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setShowCancelModal(false)}>
                            Keep Request
                        </SecondaryButton>
                        <DangerButton onClick={handleCancel} disabled={cancelForm.processing}>
                            {cancelForm.processing ? 'Cancelling…' : 'Yes, Cancel Request'}
                        </DangerButton>
                    </div>
                </div>
            </Modal>

            <Modal show={showPreviewModal} onClose={() => setShowPreviewModal(false)} maxWidth="2xl">
                <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Attachment Preview</h2>
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
                        <iframe src={previewModalUrl} className="w-full h-[70vh] rounded-lg bg-white shadow-sm" title="Attachment Preview" />
                    ) : null}
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <SecondaryButton onClick={() => setShowPreviewModal(false)}>Close</SecondaryButton>
                    <a href={previewModalUrl} download target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-2 rounded-xl bg-[#7a1315] px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-sm font-bold text-white shadow-md hover:from-red-700 hover:to-red-900 transition-all dark:from-red-600 dark:to-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                        Download File
                    </a>
                </div>
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}

/* ──────────────────────────────────────────────
   Request Card Component
   ────────────────────────────────────────────── */
function RequestCard({ req, onCancel, onPreviewAttachment }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    // Get undertime details from attendance record relationship
    const undertimeMin = req.attendance_record?.undertime_minutes || 0;
    const rawDateStr = req.attendance_record?.raw_date || req.created_at;
    const attendanceDate = req.attendance_record?.attendance_date 
        ? new Date(req.attendance_record.attendance_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
    
    // Use course_name from backend if available, otherwise fallback
    const courseName = req.course_name || 'Unknown Course';
    
    // Get schedule details
    const programCode = req.attendance_record?.schedule_detail?.program_code || '';
    const yearLevel = req.attendance_record?.schedule_detail?.year_level || '';
    const sectionName = req.attendance_record?.schedule_detail?.section_name || '';
    
    const submittedDate = rawDateStr ? new Date(rawDateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter') { toggleExpand(); } else if (e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        >
            <div className="p-5">
                {/* Top row: date + status */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                {fmtMins(undertimeMin)} Undertime
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-1">
                                {courseName}
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-0">
                                <p>
                                    {programCode && `Program: ${programCode}`}
                                    {programCode && yearLevel && sectionName && ' | '}
                                    {yearLevel && sectionName && `Year ${yearLevel} - Section ${sectionName}`}
                                </p>
                                <p>Class: {attendanceDate}</p>
                            </div>
                            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                </svg>
                                Submitted {formatDateTime(req.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[req.status]}`}>
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

                {/* Action hint + buttons */}
                <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        Click card to {isExpanded ? 'hide' : 'show'} details
                    </p>
                    {req.status === 'pending' && (
                        <button
                            onClick={(event) => handleActionClick(event, onCancel)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                            Cancel Request
                        </button>
                    )}
                </div>

                <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                        {/* Details */}
                        <div className="space-y-4">
                            {/* Reason/Justification */}
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Reason</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{req.justification}</p>
                            </div>

                            {/* Attachment preview button */}
                            {req.attachment_path && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={(event) => handleActionClick(event, () => onPreviewAttachment(req.attachment_url))}
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
                            {req.status !== 'pending' && req.reviewed_at && (
                                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Review Information</p>
                                    <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                                        <p><span className="font-semibold">Status:</span> {req.status.charAt(0).toUpperCase() + req.status.slice(1)}</p>
                                        <p><span className="font-semibold">Reviewed by:</span> {req.reviewed_by_name || 'Admin'}</p>
                                        <p><span className="font-semibold">Date:</span> {formatDateTime(req.reviewed_at)}</p>
                                        {req.review_remarks && (
                                            <p><span className="font-semibold">Remarks:</span> {req.review_remarks}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
