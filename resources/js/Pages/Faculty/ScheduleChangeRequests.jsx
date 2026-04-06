import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/30',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime12 = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours);
    const m = minutes || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${m} ${ampm}`;
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

export default function ScheduleChangeRequests({ requests: initialRequests, scheduleDetails, filters }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');

    // ── AJAX-driven requests list ────────────────────────────
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);

    // ── File preview & Modal state ───────────────────────────────
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileDocRef = useRef(null);
    const [previewModalUrl, setPreviewModalUrl] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // ── Create form ──────────────────────────────────────────
    const createForm = useForm({
        schedule_detail_id: '',
        requested_day_of_week: '',
        requested_time_in: '',
        requested_time_out: '',
        requested_room: '',
        effective_date: '',
        reason: '',
        supporting_document: null,
    });

    const selectedDetail = scheduleDetails.find(
        (d) => d.id === Number(createForm.data.schedule_detail_id),
    );

    // ── AJAX conflict detection ──────────────────────────────
    const [conflicts, setConflicts] = useState([]);
    const [isCheckingConflict, setIsCheckingConflict] = useState(false);
    const conflictTimerRef = useRef(null);

    useEffect(() => {
        const { schedule_detail_id, requested_day_of_week, requested_time_in, requested_time_out, requested_room } = createForm.data;

        // Need at least day + time in + time out to check
        if (!requested_day_of_week || !requested_time_in || !requested_time_out) {
            setConflicts([]);
            return;
        }

        // Debounce 400ms
        if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
        conflictTimerRef.current = setTimeout(() => {
            setIsCheckingConflict(true);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            fetch(route('faculty.schedule-change-requests.check-conflict'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    schedule_detail_id: schedule_detail_id || null,
                    requested_day_of_week,
                    requested_time_in,
                    requested_time_out,
                    requested_room: requested_room || null,
                }),
            })
                .then((res) => res.json())
                .then((data) => setConflicts(data.conflicts || []))
                .catch(() => setConflicts([]))
                .finally(() => setIsCheckingConflict(false));
        }, 400);

        return () => {
            if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
        };
    }, [
        createForm.data.schedule_detail_id,
        createForm.data.requested_day_of_week,
        createForm.data.requested_time_in,
        createForm.data.requested_time_out,
        createForm.data.requested_room,
    ]);

    const hasConflict = conflicts.length > 0;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        createForm.setData('supporting_document', file);
        createForm.clearErrors('supporting_document');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPreviewDoc(ev.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            // Signal it's a document (PDF, doc), show a generic state instead of image preview
            setPreviewDoc('document');
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        createForm.post(route('faculty.schedule-change-requests.store'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                setPreviewDoc(null);
                setConflicts([]);
                // Refresh the list via AJAX
                fetchRequests(filterStatus, 1);
            },
            onError: () => {
                toast.error('Please fix the errors and try again.');
            },
        });
    };

    // ── Cancel (delete) ──────────────────────────────────────
    const cancelForm = useForm({});
    const handleCancel = () => {
        cancelForm.delete(
            route('faculty.schedule-change-requests.destroy', selectedRequest.id),
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

        fetch(route('faculty.schedule-change-requests.filter') + '?' + params.toString(), {
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
            <Head title="Schedule Change Requests" />

            {/* ── Header ────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <Link
                        href={route('faculty.schedule')}
                        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-2"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                        Back to Schedule
                    </Link>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Schedule Change Requests
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Request changes to your teaching schedule. Requests require admin approval.
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={scheduleDetails.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-900/20 transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
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
                            onPreviewDocument={(url) => { setPreviewModalUrl(url); setShowPreviewModal(true); }}
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
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No change requests yet</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Click "New Request" to submit a schedule change request.
                    </p>
                </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════
                 CREATE MODAL
                ═══════════════════════════════════════════════════ */}
            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="2xl">
                <form onSubmit={handleCreate}>
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                            New Schedule Change Request
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Select the schedule you want to change and specify the new details.
                        </p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-5 max-h-[60dvh] overflow-y-auto">
                        {/* Schedule detail selector */}
                        <div>
                            <InputLabel value="Select Schedule to Change" htmlFor="schedule_detail_id" />
                            <select
                                id="schedule_detail_id"
                                value={createForm.data.schedule_detail_id}
                                onChange={(e) => { createForm.setData('schedule_detail_id', e.target.value); createForm.clearErrors('schedule_detail_id'); }}
                                className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm"
                            >
                                <option value="">— Choose a schedule —</option>
                                {scheduleDetails.map((d) => (
                                       <option key={d.id} value={d.id}>
                                        [{d.schedule_code}] {d.day_of_week} · {formatTime12(d.time_in)}–{formatTime12(d.time_out)} · {d.subject_code} - {d.subject_desc} · {[d.program_code, (d.year_level || d.section_name) ? [d.year_level, d.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')} ({d.room}) {d.is_changed ? ' (Internal)' : ''}
                                    </option>
                                ))}
                            </select>
                            <InputError message={createForm.errors.schedule_detail_id} />
                        </div>

                        {/* Preview current schedule */}
                        {selectedDetail && (
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    {selectedDetail.is_changed ? 'Current Operational Schedule' : 'Official Schedule'}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Day:</span> {selectedDetail.day_of_week}</p>
                                    <p><span className="font-semibold">Subject:</span> {selectedDetail.subject_code} - {selectedDetail.subject_desc}</p>
                                    <p><span className="font-semibold">Time:</span> {formatTime12(selectedDetail.time_in)} – {formatTime12(selectedDetail.time_out)}</p>
                                    <p><span className="font-semibold">Room:</span> {selectedDetail.room}</p>
                                    <p className="col-span-2"><span className="font-semibold">For:</span> {[selectedDetail.program_code, (selectedDetail.year_level || selectedDetail.section_name) ? [selectedDetail.year_level, selectedDetail.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}</p>
                                </div>
                            </div>
                        )}

                        <hr className="border-gray-100 dark:border-gray-700" />

                        {/* Requested changes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel value="New Day" htmlFor="requested_day_of_week" />
                                <select
                                    id="requested_day_of_week"
                                    value={createForm.data.requested_day_of_week}
                                    onChange={(e) => { createForm.setData('requested_day_of_week', e.target.value); createForm.clearErrors('requested_day_of_week'); }}
                                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm"
                                >
                                    <option value="">— Select day —</option>
                                    {DAYS.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <InputError message={createForm.errors.requested_day_of_week} />
                            </div>

                            <div>
                                <InputLabel value="New Room (optional)" htmlFor="requested_room" />
                                <TextInput
                                    id="requested_room"
                                    type="text"
                                    className="mt-1 block w-full text-sm"
                                    value={createForm.data.requested_room}
                                    onChange={(e) => { createForm.setData('requested_room', e.target.value); createForm.clearErrors('requested_room'); }}
                                    placeholder="e.g. Room 301"
                                />
                                <InputError message={createForm.errors.requested_room} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel value="New Time In" htmlFor="requested_time_in" />
                                <TextInput
                                    id="requested_time_in"
                                    type="time"
                                    className="mt-1 block w-full text-sm"
                                    value={createForm.data.requested_time_in}
                                    onChange={(e) => { createForm.setData('requested_time_in', e.target.value); createForm.clearErrors('requested_time_in'); }}
                                />
                                <InputError message={createForm.errors.requested_time_in} />
                            </div>

                            <div>
                                <InputLabel value="New Time Out" htmlFor="requested_time_out" />
                                <TextInput
                                    id="requested_time_out"
                                    type="time"
                                    className="mt-1 block w-full text-sm"
                                    value={createForm.data.requested_time_out}
                                    onChange={(e) => { createForm.setData('requested_time_out', e.target.value); createForm.clearErrors('requested_time_out'); }}
                                />
                                <InputError message={createForm.errors.requested_time_out} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Effective Date" htmlFor="effective_date" />
                            <TextInput
                                id="effective_date"
                                type="date"
                                className="mt-1 block w-full text-sm"
                                value={createForm.data.effective_date}
                                onChange={(e) => { createForm.setData('effective_date', e.target.value); createForm.clearErrors('effective_date'); }}
                            />
                            <InputError message={createForm.errors.effective_date} />
                        </div>

                        <div>
                            <InputLabel value="Reason for Change" htmlFor="reason" />
                            <textarea
                                id="reason"
                                rows={3}
                                className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                value={createForm.data.reason}
                                onChange={(e) => { createForm.setData('reason', e.target.value); createForm.clearErrors('reason'); }}
                                placeholder="Briefly explain why you need this schedule change..."
                            />
                            <InputError message={createForm.errors.reason} />
                        </div>

                        <div>
                            <InputLabel value="Supporting Document" />
                            <div
                                onClick={() => fileDocRef.current?.click()}
                                className="mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-900"
                            >
                                {previewDoc === 'document' ? (
                                    <div className="flex flex-col items-center text-blue-600 dark:text-blue-400">
                                        <svg className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                        </svg>
                                        <p className="text-sm font-bold">{createForm.data.supporting_document?.name}</p>
                                        <p className="text-xs mt-1 text-blue-500/70">Click to change file</p>
                                    </div>
                                ) : previewDoc ? (
                                    <img src={previewDoc} alt="Document Preview" className="max-h-36 rounded-lg object-contain" />
                                ) : (
                                    <>
                                        <svg className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Click to upload Supporting Document</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPG, PNG or WebP (max 5MB)</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileDocRef}
                                id="supporting_document"
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                            />
                            <InputError message={createForm.errors.supporting_document} />
                        </div>

                        {/* Conflict warning */}
                        {isCheckingConflict && (
                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 p-3 flex items-center gap-2">
                                <svg className="h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <p className="text-xs text-blue-600 dark:text-blue-300">Checking for conflicts…</p>
                            </div>
                        )}
                        {!isCheckingConflict && hasConflict && (
                            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 flex items-start gap-3">
                                <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                                        {conflicts.length === 1 ? 'Conflict Detected' : `${conflicts.length} Conflicts Detected`}
                                    </p>
                                    <ul className="mt-1 space-y-1">
                                        {conflicts.map((c, i) => (
                                            <li key={i} className="text-xs text-red-600 dark:text-red-300 flex items-start gap-1.5">
                                                <span className="shrink-0 mt-0.5">🚪</span>
                                                <span>{c.message}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={createForm.processing || hasConflict || isCheckingConflict}>
                            {createForm.processing ? 'Submitting…' : 'Submit Request'}
                        </PrimaryButton>
                    </div>
                </form>
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
                        Are you sure you want to cancel this schedule change request? This action cannot be undone.
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
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}

/* ──────────────────────────────────────────────
   Request Card Component
   ────────────────────────────────────────────── */
function RequestCard({ req, onCancel, onPreviewDocument }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleActionClick = (event, callback) => {
        event.stopPropagation();
        callback();
    };

    return (
        <div
            onClick={toggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter') { toggleExpand(); } else if (e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
            role="button"
            tabIndex={0}
            className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        >
            <div className="p-5">
                {/* Top row: subject + status */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-xs shadow-sm">
                            {req.original_day.slice(0, 3)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                {req.original_subject}
                                {req.original_subject_desc && (
                                    <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                                        {req.original_subject_desc}
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {req.schedule_code && (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-300/50 dark:ring-gray-600/50">
                                        {req.schedule_code}
                                    </span>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Submitted {formatDateTime(req.created_at)}
                                </p>
                                {(req.program_code || req.year_level || req.section_name) && (
                                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                        {[req.program_code, (req.year_level || req.section_name) ? [req.year_level, req.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}
                                    </p>
                                )}
                            </div>
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
                        {/* Change comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Original */}
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Official Schedule</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Day:</span> {req.original_day}</p>
                                    <p><span className="font-semibold">Time:</span> {req.original_time_in} – {req.original_time_out}</p>
                                    <p><span className="font-semibold">Room:</span> {req.original_room}</p>
                                </div>
                            </div>

                            {/* Requested */}
                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-800/40">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Requested Change</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Day:</span> {req.requested_day}</p>
                                    <p><span className="font-semibold">Time:</span> {req.requested_time_in} – {req.requested_time_out}</p>
                                    <p><span className="font-semibold">Room:</span> {req.requested_room || 'Same'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Extra info row */}
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-1">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                </svg>
                                Effective: {req.effective_date}
                            </span>
                        </div>

                        {/* Reason */}
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/20 border border-gray-100 dark:border-gray-700/40">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Reason</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{req.reason}</p>
                        </div>

                        {/* Supporting Document */}
                        {req.supporting_document_url && (
                            <div className="mt-4">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Supporting Document</p>
                                <div
                                    onClick={(e) => { e.stopPropagation(); onPreviewDocument(req.supporting_document_url); }}
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

                        {/* Review info (if reviewed) */}
                        {req.review_remarks && (
                            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                                    Admin Remarks — {formatDateTime(req.reviewed_at)}
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{req.review_remarks}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
