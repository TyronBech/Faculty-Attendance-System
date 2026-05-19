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
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import CustomDatePicker from '@/Components/CustomDatePicker';
import CustomTimePicker from '@/Components/CustomTimePicker';

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

const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/30',
};

const CLASS_TYPE_STYLES = {
    synchronous: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30',
    asynchronous: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30',
};

export default function OnlineAttendance({ requests: initialRequests, scheduleDetails, filters }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [screenshotLabel, setScreenshotLabel] = useState('');
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filterStatus, setFilterStatus] = useState(filters.status || '');

    // ── AJAX-driven requests list ────────────────────────────
    const [requestsData, setRequestsData] = useState(initialRequests);
    const [isFiltering, setIsFiltering] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialRequests.current_page || 1);

    // ── File preview state ───────────────────────────────────
    const [previewIn, setPreviewIn] = useState(null);
    const [previewOut, setPreviewOut] = useState(null);
    const [supportingDocuments, setSupportingDocuments] = useState([]);
    const [documentUploadError, setDocumentUploadError] = useState(null);
    const [attendanceCheck, setAttendanceCheck] = useState({ checked: false, canSubmit: true, hasAttendance: false, hasPendingRequest: false });
    const fileInRef = useRef(null);
    const fileOutRef = useRef(null);

    // ── Check for existing attendance on date change ────────
    const checkAttendance = useCallback((date) => {
        if (!date) {
            setAttendanceCheck({ checked: false, canSubmit: true, hasAttendance: false, hasPendingRequest: false });
            return;
        }

        fetch(route('faculty.online-attendance.check', { date }), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((res) => res.json())
            .then((data) => {
                setAttendanceCheck({
                    checked: true,
                    canSubmit: data.can_submit,
                    hasAttendance: data.has_attendance,
                    hasPendingRequest: data.has_pending_request,
                });
            })
            .catch(() => {
                setAttendanceCheck({ checked: false, canSubmit: true, hasAttendance: false, hasPendingRequest: false });
            });
    }, []);



    // ── Create form ──────────────────────────────────────────
    const createForm = useForm({
        schedule_detail_id: '',
        class_type: 'synchronous',
        attendance_date: '',
        time_in: '',
        time_out: '',
        screenshot_in: null,
        screenshot_out: null,
        remarks: '',
    });

    const handleFileChange = (field, e) => {
        const file = e.target.files[0];
        if (!file) return;

        createForm.setData(field, file);
        createForm.clearErrors(field);

        // Generate preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (field === 'screenshot_in') setPreviewIn(ev.target.result);
            else setPreviewOut(ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleDocumentsChange = (files) => {
        setSupportingDocuments(files);
        setDocumentUploadError(null);
    };

    const handleDocumentUploadError = (error) => {
        setDocumentUploadError(error);
    };

    const handleCreate = (e) => {
        if (e) e.preventDefault();

        if (!createForm.data.schedule_detail_id) {
            createForm.setError('schedule_detail_id', 'Please select an official class, temporary substitute, or internal duty.');
            toast.error('Please select a schedule before submitting.');
            return;
        }

        // If duplicate detected and not yet confirmed via modal
        if (attendanceCheck.checked && (attendanceCheck.hasAttendance || attendanceCheck.hasPendingRequest) && !showDuplicateModal) {
            setShowDuplicateModal(true);
            return;
        }

        submitAttendance();
    };

    const submitAttendance = (forceArg = false) => {
        // Register the transformation separately to avoid chaining errors
        createForm.transform((data) => ({
            ...data,
            force: forceArg ? '1' : '0'
        }));

        // Create FormData to handle files properly including supporting documents
        const formData = new FormData();
        
        // Add form data
        formData.append('schedule_detail_id', createForm.data.schedule_detail_id);
        formData.append('class_type', createForm.data.class_type);
        formData.append('attendance_date', createForm.data.attendance_date);
        formData.append('time_in', createForm.data.time_in);
        formData.append('time_out', createForm.data.time_out);
        formData.append('remarks', createForm.data.remarks);
        formData.append('force', forceArg ? '1' : '0');
        
        // Add required screenshots
        if (createForm.data.screenshot_in) {
            formData.append('screenshot_in', createForm.data.screenshot_in);
        }
        if (createForm.data.screenshot_out) {
            formData.append('screenshot_out', createForm.data.screenshot_out);
        }
        
        // Add supporting documents in the correct format for the backend
        supportingDocuments.forEach((file, index) => {
            formData.append(`attachments[${index}][file]`, file);
            formData.append(`attachments[${index}][label]`, file.name);
        });

        router.post(route('faculty.online-attendance.store'), formData, {
            preserveScroll: true,
            onStart: () => createForm.processing = true,
            onFinish: () => createForm.processing = false,
            onSuccess: () => {
                setShowCreateModal(false);
                setShowDuplicateModal(false);
                createForm.reset();
                setPreviewIn(null);
                setPreviewOut(null);
                setSupportingDocuments([]);
                setDocumentUploadError(null);
                fetchRequests(filterStatus, 1);
            },
            onError: (errors) => {
                setShowDuplicateModal(false);
                // Manually set errors to the createForm instance
                Object.keys(errors).forEach(key => {
                    createForm.setError(key, errors[key]);
                });
                const firstError = Object.values(errors)[0];
                toast.error(firstError || 'Please fix the errors and try again.');
            },
        });
    };

    const resetAndOpenModal = () => {
        createForm.reset();
        createForm.clearErrors();
        setPreviewIn(null);
        setPreviewOut(null);
        setSupportingDocuments([]);
        setDocumentUploadError(null);
        setAttendanceCheck({ checked: false, canSubmit: true, hasAttendance: false, hasPendingRequest: false });
        setShowCreateModal(true);
    };

    // ── Cancel (delete) ──────────────────────────────────────
    const cancelForm = useForm({});
    const handleCancel = () => {
        cancelForm.delete(
            route('faculty.online-attendance.destroy', selectedRequest.id),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowCancelModal(false);
                    setSelectedRequest(null);
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

        fetch(route('faculty.online-attendance.filter') + '?' + params.toString(), {
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

    const openScreenshot = (url, label) => {
        setScreenshotUrl(url);
        setScreenshotLabel(label);
        setShowScreenshotModal(true);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Online Attendance" />

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
                        Online Attendance
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Submit online class attendance with screenshot proof. Requires admin approval.
                    </p>
                </div>

                <button
                    onClick={resetAndOpenModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-900/20 transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Attendance
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

            {/* ── Loading spinner ─────────────────────────── */}
            {isFiltering && (
                <div className="flex justify-center py-8">
                    <svg className="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                </div>
            )}

            {/* ── Requests list ──────────────────────────────── */}
            {!isFiltering && requestsData.data && requestsData.data.length > 0 ? (
                <div className="space-y-4">
                    {requestsData.data.map((req) => (
                        <RequestCard
                            key={req.id}
                            req={req}
                            onCancel={() => { setSelectedRequest(req); setShowCancelModal(true); }}
                            onOpenScreenshot={openScreenshot}
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No online attendance requests yet</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Click "New Attendance" to submit online class attendance.
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
                            New Online Attendance
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Upload screenshots as proof of your online class attendance.
                        </p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-5 max-h-[60dvh] overflow-y-auto">
                        {/* Schedule selector */}
                        <div>
                            <InputLabel value="Official Class, Temporary Substitute, or Internal Duty *" htmlFor="schedule_detail_id" />
                            <select
                                id="schedule_detail_id"
                                value={createForm.data.schedule_detail_id}
                                onChange={(e) => { createForm.setData('schedule_detail_id', e.target.value); createForm.clearErrors('schedule_detail_id'); }}
                                className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm"
                            >
                                <option value="" disabled>— Select a schedule —</option>
                                {scheduleDetails.map((d) => (
                                    <option key={d.composite_id} value={d.composite_id}>
                                         [{d.schedule_code}] {d.day_of_week} · {formatTime12(d.time_in)}–{formatTime12(d.time_out)} · {d.subject_code} {d.subject_desc ? `- ${d.subject_desc}` : ''} · {[d.program_code, (d.year_level || d.section_name) ? [d.year_level, d.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')} ({d.room}) {d.is_temporary ? ' (Temporary Substitute)' : d.is_changed ? ' (Internal)' : ''}
                                    </option>
                                ))}
                            </select>
                            <InputError message={createForm.errors.schedule_detail_id} />
                        </div>

                        {/* Class type toggle */}
                        <div>
                            <InputLabel>Class Type <span className="text-red-500">*</span></InputLabel>
                            <div className="mt-2 flex gap-3">
                                {['synchronous', 'asynchronous'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => { createForm.setData('class_type', type); createForm.clearErrors('class_type'); }}
                                        className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-center transition-all border-2 ${createForm.data.class_type === type
                                            ? type === 'synchronous'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-500'
                                                : 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-500'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            {type === 'synchronous' ? (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                            )}
                                            <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <InputError message={createForm.errors.class_type} />
                        </div>

                        {/* Date */}
                        <div>
                            <InputLabel htmlFor="attendance_date">Date of Class <span className="text-red-500">*</span></InputLabel>
                            <CustomDatePicker
                                id="attendance_date"
                                value={createForm.data.attendance_date}
                                onChange={(val) => {
                                    createForm.setData('attendance_date', val);
                                    createForm.clearErrors('attendance_date');
                                    checkAttendance(val);
                                }}
                            />
                            <InputError message={createForm.errors.attendance_date} />
                            {attendanceCheck.checked && (attendanceCheck.hasAttendance || attendanceCheck.hasPendingRequest) && (
                                <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                    {attendanceCheck.hasAttendance
                                        ? 'Note: You already have an attendance record for this date.'
                                        : 'Note: You already have a pending request for this date.'}
                                </p>
                            )}
                        </div>

                        {/* Time In & Out */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="time_in">Time In <span className="text-red-500">*</span></InputLabel>
                                <CustomTimePicker
                                    id="time_in"
                                    value={createForm.data.time_in}
                                    onChange={(val) => { createForm.setData('time_in', val); createForm.clearErrors('time_in'); }}
                                />
                                <InputError message={createForm.errors.time_in} />
                            </div>
                            <div>
                                <InputLabel value="Time Out (optional)" htmlFor="time_out" />
                                <CustomTimePicker
                                    id="time_out"
                                    value={createForm.data.time_out}
                                    onChange={(val) => { createForm.setData('time_out', val); createForm.clearErrors('time_out'); }}
                                />
                                <InputError message={createForm.errors.time_out} />
                            </div>
                        </div>

                        {/* Screenshot: Time In */}
                        <div>
                            <InputLabel>Screenshot — Time In (proof) <span className="text-red-500">*</span></InputLabel>
                            <div
                                onClick={() => fileInRef.current?.click()}
                                className="mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-900"
                            >
                                {previewIn ? (
                                    <img src={previewIn} alt="Preview In" className="max-h-36 rounded-lg object-contain" />
                                ) : (
                                    <>
                                        <svg className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Click to upload Time In screenshot</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG, PNG or WebP (max 5MB)</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => handleFileChange('screenshot_in', e)}
                            />
                            <InputError message={createForm.errors.screenshot_in} />
                        </div>

                        {/* Screenshot: Time Out */}
                        <div>
                            <InputLabel value="Screenshot — Time Out (proof) (optional)" />
                            <div
                                onClick={() => fileOutRef.current?.click()}
                                className="mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors bg-gray-50 dark:bg-gray-900"
                            >
                                {previewOut ? (
                                    <img src={previewOut} alt="Preview Out" className="max-h-36 rounded-lg object-contain" />
                                ) : (
                                    <>
                                        <svg className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Click to upload Time Out screenshot</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG, PNG or WebP (max 5MB)</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileOutRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => handleFileChange('screenshot_out', e)}
                            />
                            <InputError message={createForm.errors.screenshot_out} />
                        </div>

                        {/* Remarks */}
                        <div>
                            <InputLabel value="Remarks (optional)" htmlFor="remarks" />
                            <textarea
                                id="remarks"
                                rows={3}
                                className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 text-sm resize-none"
                                value={createForm.data.remarks}
                                onChange={(e) => { createForm.setData('remarks', e.target.value); createForm.clearErrors('remarks'); }}
                                placeholder="Any additional notes about this online class..."
                            />
                            <InputError message={createForm.errors.remarks} />
                        </div>

                        {/* Additional Supporting Documents */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <MultiFileUploader
                                label="Additional Supporting Documents"
                                description="Upload supporting files (5MB per file) - Optional"
                                value={supportingDocuments}
                                onChange={handleDocumentsChange}
                                onError={handleDocumentUploadError}
                                error={documentUploadError}
                                disabled={createForm.processing}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={createForm.processing || !attendanceCheck.canSubmit}>
                            {createForm.processing ? 'Submitting…' : 'Submit Attendance'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                 DUPLICATE CONFIRMATION MODAL
                ═══════════════════════════════════════════════════ */}
            <Modal show={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} maxWidth="md">
                <div className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                        Duplicate Attendance Detected
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {attendanceCheck.hasAttendance
                            ? "An attendance record already exists for this date. Submitting another one might cause confusion during payroll processing."
                            : "You already have a pending online attendance request for this date. Submitting this will replace your previous screenshots and details."}
                        <br /><br />
                        {attendanceCheck.hasPendingRequest
                            ? "Do you want to replace your existing request with this new information?"
                            : "Are you sure you want to proceed with this new request?"}
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setShowDuplicateModal(false)}>
                            Go Back
                        </SecondaryButton>
                        <PrimaryButton
                            onClick={() => submitAttendance(true)}
                            disabled={createForm.processing}
                            className={`${attendanceCheck.hasPendingRequest ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 shadow-blue-900/20' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-600 shadow-amber-900/20'}`}
                        >
                            {createForm.processing ? 'Submitting…' : (attendanceCheck.hasPendingRequest ? 'Yes, Replace Request' : 'Yes, Submit Anyway')}
                        </PrimaryButton>
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
                        Are you sure you want to cancel this online attendance request? The uploaded screenshots will be deleted. This action cannot be undone.
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

            {/* ═══════════════════════════════════════════════════
                 SCREENSHOT VIEWER MODAL
                ═══════════════════════════════════════════════════ */}
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

/* ──────────────────────────────────────────────
   Request Card Component
   ────────────────────────────────────────────── */
function RequestCard({ req, onCancel, onOpenScreenshot }) {
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
                {/* Top row: subject + status + class type */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs shadow-sm ${req.class_type === 'synchronous'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                            : 'bg-gradient-to-br from-amber-500 to-amber-600'
                            }`}>
                            {req.class_type === 'synchronous' ? 'SYN' : 'ASY'}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                {req.is_official ? (req.subject_code || 'Official Class') : 'Internal Duty'}
                                {req.subject_desc && (
                                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-tight">
                                        {req.subject_desc}
                                    </div>
                                )}
                                {(req.program_code || req.year_level || req.section_name) && (
                                    <div className="mt-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                        {[req.program_code, (req.year_level || req.section_name) ? [req.year_level, req.section_name].filter(Boolean).join('-') : null].filter(Boolean).join(' ')}
                                    </div>
                                )}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Submitted {formatDateTime(req.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${CLASS_TYPE_STYLES[req.class_type]}`}>
                            {req.class_type === 'synchronous' ? 'Synchronous' : 'Asynchronous'}
                        </span>
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
                        {/* Attendance details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Date & Time */}
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 border border-gray-100 dark:border-gray-700/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date & Time</p>
                                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <p><span className="font-semibold">Date:</span> {req.attendance_date}</p>
                                    <p><span className="font-semibold">Time In:</span> {req.time_in}</p>
                                    <p><span className="font-semibold">Time Out:</span> {req.time_out}</p>
                                </div>
                            </div>

                            {/* Screenshot: Time In */}
                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-800/40">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Screenshot — Time In</p>
                                {req.screenshot_in ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenScreenshot(req.screenshot_in, 'Time In Screenshot'); }}
                                        className="group relative w-full h-24 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700/50 bg-white dark:bg-gray-800"
                                    >
                                        <img
                                            src={req.screenshot_in}
                                            alt="Time In"
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <svg className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21 -5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                                            </svg>
                                        </div>
                                    </button>
                                ) : (
                                    <p className="text-xs text-gray-400">No screenshot</p>
                                )}
                            </div>

                            {/* Screenshot: Time Out */}
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-800/40">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Screenshot — Time Out</p>
                                {req.screenshot_out ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenScreenshot(req.screenshot_out, 'Time Out Screenshot'); }}
                                        className="group relative w-full h-24 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-700/50 bg-white dark:bg-gray-800"
                                    >
                                        <img
                                            src={req.screenshot_out}
                                            alt="Time Out"
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <svg className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21 -5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                                            </svg>
                                        </div>
                                    </button>
                                ) : (
                                    <p className="text-xs text-gray-400">No screenshot</p>
                                )}
                            </div>
                        </div>

                        {/* Additional Attachments Section */}
                        {req.attachments_data && req.attachments_data.filter(a => !['Time In Screenshot', 'Time Out Screenshot'].includes(a.custom_label)).length > 0 && (
                            <div className="mt-4 px-4 pb-2">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Additional Supporting Documents</p>
                                <div className="flex flex-wrap gap-3">
                                    {req.attachments_data.filter(a => !['Time In Screenshot', 'Time Out Screenshot'].includes(a.custom_label)).map((attachment, idx) => (
                                        <div
                                            key={attachment.id || idx}
                                            onClick={(e) => { e.stopPropagation(); onOpenScreenshot(attachment.url, attachment.custom_label); }}
                                            className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition hover:border-blue-400 dark:hover:border-blue-500 w-28 h-28 flex flex-col items-center justify-center p-1"
                                        >
                                            {attachment.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                <img src={attachment.url} alt={attachment.custom_label} className="w-full h-16 object-cover rounded-lg opacity-90 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors h-16">
                                                    <svg className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <span className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate w-full text-center px-1">
                                                {attachment.custom_label || 'File'}
                                            </span>
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                <svg className="h-6 w-6 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Remarks */}
                        {req.remarks && (
                            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/20 border border-gray-100 dark:border-gray-700/40">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Remarks</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{req.remarks}</p>
                            </div>
                        )}

                        {/* Admin review info */}
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

