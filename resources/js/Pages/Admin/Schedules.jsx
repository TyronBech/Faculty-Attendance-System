import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/Pagination';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    DAYS,
    SEMESTERS,
    SCHEDULE_STATUSES,
    SCHEDULE_TYPES,
    SCHEDULE_STATUS_STYLES,
    SCHEDULE_TYPE_STYLES,
    STRINGS,
} from '@/Constants/admin';

const emptyDetail = {
    day_of_week: 'Monday',
    time_in: '08:00',
    time_out: '09:00',
    subject_code: '',
    subject_desc: '',
    room: '',
    hours_required: 1,
};

const ALLOWED_TIME_MIN = '07:00';
const ALLOWED_TIME_MAX = '21:00';

const toMinutes = (timeValue) => {
    if (!timeValue || !timeValue.includes(':')) {
        return null;
    }

    const [hourPart, minutePart] = timeValue.split(':').map(Number);
    if (Number.isNaN(hourPart) || Number.isNaN(minutePart)) {
        return null;
    }

    return (hourPart * 60) + minutePart;
};

/* ──────────────────────────────────────────────
   Status badge component
   ────────────────────────────────────────────── */
function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${SCHEDULE_STATUS_STYLES[status] ?? SCHEDULE_STATUS_STYLES.draft}`}>
            {status}
        </span>
    );
}

/* ──────────────────────────────────────────────
   Type badge component
   ────────────────────────────────────────────── */
function TypeBadge({ type }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${SCHEDULE_TYPE_STYLES[type] ?? SCHEDULE_TYPE_STYLES.flexible}`}>
            {type}
        </span>
    );
}

/* ──────────────────────────────────────────────
   Semester label helper
   ────────────────────────────────────────────── */
function semesterLabel(val) {
    return SEMESTERS.find((s) => s.value === Number(val))?.label ?? `Sem ${val}`;
}

/* ──────────────────────────────────────────────
   Main Schedules Management page
   ────────────────────────────────────────────── */
export default function SchedulesIndex({ schedules, faculties, departments, filters }) {

    // ── Pagination & Filters ──
    const [currentPage, setCurrentPage] = useState(schedules.current_page);
    const [perPage, setPerPage] = useState(filters.per_page);
    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status);
    const [typeFilter, setTypeFilter] = useState(filters.type);
    const [semesterFilter, setSemesterFilter] = useState(filters.semester);
    const [yearFilter, setYearFilter] = useState(filters.academic_year);
    const [deptFilter, setDeptFilter] = useState(filters.department);

    // ── Search suggestions ──
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);
    const suggestionsTimeout = useRef(null);

    // ── Modals ──
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);

    // ── Form ──
    const defaultForm = {
        faculty_id: '',
        schedule_code: '',
        academic_year: new Date().getFullYear(),
        semester: 1,
        effective_from: '',
        effective_until: '',
        status: 'draft',
        schedule_type: 'flexible',
        notes: '',
        details: [{ ...emptyDetail }],
    };
    const [form, setForm] = useState({ ...defaultForm });
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    // ── Fetch with filters ──
    const fetchSchedules = useCallback(
        (page = 1) => {
            router.get(
                route('admin.schedules.index'),
                {
                    page,
                    per_page: perPage,
                    search,
                    status: statusFilter,
                    type: typeFilter,
                    semester: semesterFilter,
                    academic_year: yearFilter,
                    department: deptFilter,
                },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        },
        [perPage, search, statusFilter, typeFilter, semesterFilter, yearFilter, deptFilter],
    );

    const handleFilter = () => {
        setCurrentPage(1);
        fetchSchedules(1);
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        fetchSchedules(page);
    };

    const handlePerPageChange = (size) => {
        setPerPage(size);
        setCurrentPage(1);
        // Trigger immediately
        router.get(
            route('admin.schedules.index'),
            {
                page: 1,
                per_page: size,
                search,
                status: statusFilter,
                type: typeFilter,
                semester: semesterFilter,
                academic_year: yearFilter,
                department: deptFilter,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setTypeFilter('');
        setSemesterFilter('');
        setYearFilter('');
        setDeptFilter('');
        setCurrentPage(1);
        router.get(route('admin.schedules.index'), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    // ── Search Suggestions (AJAX) ──
    const handleSearchInput = (val) => {
        setSearch(val);
        if (suggestionsTimeout.current) clearTimeout(suggestionsTimeout.current);

        if (val.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        suggestionsTimeout.current = setTimeout(async () => {
            try {
                const res = await axios.get(route('admin.schedules.suggestions'), { params: { q: val } });
                setSuggestions(res.data);
                setShowSuggestions(res.data.length > 0);
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
    };

    const pickSuggestion = (suggestion) => {
        setSearch(suggestion.code);
        setShowSuggestions(false);
        // Trigger filter
        router.get(
            route('admin.schedules.index'),
            { page: 1, per_page: perPage, search: suggestion.code },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── CRUD handlers ──
    const openCreate = () => {
        setForm({ ...defaultForm, details: [{ ...emptyDetail }] });
        setErrors({});
        setShowCreateModal(true);
    };

    const openEdit = (schedule) => {
        setSelectedSchedule(schedule);
        setForm({
            faculty_id: schedule.faculty_id,
            schedule_code: schedule.schedule_code,
            academic_year: schedule.academic_year,
            semester: schedule.semester,
            effective_from: schedule.effective_from,
            effective_until: schedule.effective_until,
            status: schedule.status,
            schedule_type: schedule.schedule_type,
            notes: schedule.notes ?? '',
            details: schedule.details.length > 0
                ? schedule.details.map((d) => ({ ...d }))
                : [{ ...emptyDetail }],
        });
        setErrors({});
        setShowEditModal(true);
    };

    const openDelete = (schedule) => {
        setSelectedSchedule(schedule);
        setShowDeleteModal(true);
    };

    const openView = (schedule) => {
        setSelectedSchedule(schedule);
        setShowViewModal(true);
    };

    const minAllowedMinutes = toMinutes(ALLOWED_TIME_MIN);
    const maxAllowedMinutes = toMinutes(ALLOWED_TIME_MAX);

    const validateDetailTimeRanges = () => {
        const localErrors = {};

        form.details.forEach((detail, index) => {
            const subjectCode = (detail.subject_code ?? '').trim();
            const room = (detail.room ?? '').trim();
            const timeInMinutes = toMinutes(detail.time_in);
            const timeOutMinutes = toMinutes(detail.time_out);

            if (!subjectCode) {
                localErrors[`details.${index}.subject_code`] = 'Subject Code is required.';
            }

            if (!room) {
                localErrors[`details.${index}.room`] = 'Room is required.';
            }

            if (timeInMinutes === null || timeOutMinutes === null) {
                if (timeInMinutes === null) {
                    localErrors[`details.${index}.time_in`] = 'Time In is required and must be a valid time.';
                }

                if (timeOutMinutes === null) {
                    localErrors[`details.${index}.time_out`] = 'Time Out is required and must be a valid time.';
                }

                return;
            }

            if (timeInMinutes < minAllowedMinutes || timeInMinutes > maxAllowedMinutes) {
                localErrors[`details.${index}.time_in`] = 'Time In must be between 07:00 AM and 09:00 PM.';
            }

            if (timeOutMinutes < minAllowedMinutes || timeOutMinutes > maxAllowedMinutes) {
                localErrors[`details.${index}.time_out`] = 'Time Out must be between 07:00 AM and 09:00 PM.';
                return;
            }

            if (timeOutMinutes <= timeInMinutes) {
                localErrors[`details.${index}.time_out`] = 'Time Out must be later than Time In.';
            }
        });

        // Cross-entry conflict check: a faculty cannot teach two classes at the same time
        const count = form.details.length;
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                if (form.details[i].day_of_week !== form.details[j].day_of_week) continue;
                const iStart = toMinutes(form.details[i].time_in);
                const iEnd   = toMinutes(form.details[i].time_out);
                const jStart = toMinutes(form.details[j].time_in);
                const jEnd   = toMinutes(form.details[j].time_out);
                if (iStart === null || iEnd === null || jStart === null || jEnd === null) continue;
                if (iStart >= iEnd || jStart >= jEnd) continue;
                if (iStart < jEnd && iEnd > jStart) {
                    if (!localErrors[`details.${i}.time_in`]) {
                        localErrors[`details.${i}.time_in`] = `Entry #${i + 1} overlaps with entry #${j + 1} on ${form.details[i].day_of_week}.`;
                    }
                    if (!localErrors[`details.${j}.time_in`]) {
                        localErrors[`details.${j}.time_in`] = `Entry #${j + 1} overlaps with entry #${i + 1} on ${form.details[j].day_of_week}.`;
                    }
                }
            }
        }

        return localErrors;
    };

    const handleSubmitCreate = () => {
        const localErrors = validateDetailTimeRanges();
        if (Object.keys(localErrors).length > 0) {
            setErrors(localErrors);
            const hasConflict = Object.values(localErrors).some((msg) => msg.includes('overlaps with'));
            toast.error(hasConflict
                ? 'Two or more class entries conflict on the same day and time. Please resolve the overlaps.'
                : 'Please fix invalid time ranges before creating the schedule.');
            return;
        }

        setProcessing(true);
        setErrors({});
        router.post(route('admin.schedules.store'), form, {
            preserveScroll: true,
            onSuccess: () => {
                setShowCreateModal(false);
                setProcessing(false);
            },
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
                toast.error('Please fix the errors and try again.');
            },
        });
    };

    const handleSubmitEdit = () => {
        const localErrors = validateDetailTimeRanges();
        if (Object.keys(localErrors).length > 0) {
            setErrors(localErrors);
            const hasConflict = Object.values(localErrors).some((msg) => msg.includes('overlaps with'));
            toast.error(hasConflict
                ? 'Two or more class entries conflict on the same day and time. Please resolve the overlaps.'
                : 'Please fix invalid time ranges before saving changes.');
            return;
        }

        setProcessing(true);
        setErrors({});
        router.put(route('admin.schedules.update', selectedSchedule.id), form, {
            preserveScroll: true,
            onSuccess: () => {
                setShowEditModal(false);
                setProcessing(false);
            },
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
                toast.error('Please fix the errors and try again.');
            },
        });
    };

    const handleDelete = () => {
        setProcessing(true);
        router.delete(route('admin.schedules.destroy', selectedSchedule.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowDeleteModal(false);
                setProcessing(false);
            },
            onError: () => {
                setProcessing(false);
                toast.error('Failed to delete the schedule. Please try again.');
            },
        });
    };

    // ── Detail rows management ──
    const addDetailRow = () => {
        setForm((f) => ({ ...f, details: [...f.details, { ...emptyDetail }] }));
    };

    const removeDetailRow = (index) => {
        setForm((f) => ({
            ...f,
            details: f.details.filter((_, i) => i !== index),
        }));
    };

    const updateDetail = (index, field, value) => {
        setForm((f) => {
            const details = [...f.details];
            details[index] = { ...details[index], [field]: value };
            return { ...f, details };
        });
    };

    // ── Generate unique academic years for filter ──
    const currentYear = new Date().getFullYear();
    const academicYears = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

    return (
        <AuthenticatedLayout>
            <Head title="Schedule Management" />

            {/* ── Page Header ─────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        {STRINGS.schedulesPageTitle}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {STRINGS.schedulesDescription}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Schedule
                </button>
            </div>

            {/* ── Filters Bar ────────────────────────── */}
            <div className="mt-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Search with suggestions */}
                    <div className="relative flex-1 min-w-[220px]" ref={searchRef}>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Search</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                onFocus={() => search.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                placeholder="Search by schedule code, faculty name, subject, room…"
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 pl-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#7a1315]/30 focus:border-[#7a1315] outline-none transition-all"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>

                        {/* Suggestions dropdown */}
                        {showSuggestions && (
                            <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-60 overflow-y-auto">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => pickSuggestion(s)}
                                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                                    >
                                        <span className="font-semibold">{s.code}</span>
                                        <span className="text-gray-400 dark:text-gray-500 ml-2">— {s.label.split('—')[1]?.trim()}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status filter */}
                    <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={SCHEDULE_STATUSES} />

                    {/* Type filter */}
                    <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={SCHEDULE_TYPES} />

                    {/* Semester filter */}
                    <div className="min-w-[130px]">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Semester</label>
                        <select
                            value={semesterFilter}
                            onChange={(e) => setSemesterFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7a1315]/30 focus:border-[#7a1315] outline-none transition-all cursor-pointer"
                        >
                            <option value="">All</option>
                            {SEMESTERS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Academic Year filter */}
                    <div className="min-w-[130px]">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Year</label>
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7a1315]/30 focus:border-[#7a1315] outline-none transition-all cursor-pointer"
                        >
                            <option value="">All</option>
                            {academicYears.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Department filter */}
                    <div className="min-w-[160px]">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Department</label>
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7a1315]/30 focus:border-[#7a1315] outline-none transition-all cursor-pointer"
                        >
                            <option value="">All</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleFilter}
                            className="rounded-xl bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-bold text-white dark:text-gray-900 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            Apply
                        </button>
                        <button
                            onClick={resetFilters}
                            className="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Table ─────────────────────────────── */}
            <div className="mt-5 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-800/60">
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Code</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Faculty</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Department</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Semester</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Year</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Effective</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {schedules.data.length > 0 ? (
                                schedules.data.map((schedule) => (
                                    <tr
                                        key={schedule.id}
                                        className="group hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors duration-150"
                                    >
                                        <td className="px-5 py-4">
                                            <button
                                                onClick={() => openView(schedule)}
                                                className="font-bold text-gray-900 dark:text-white hover:text-[#7a1315] dark:hover:text-[#cc2127] transition-colors"
                                            >
                                                {schedule.schedule_code}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4 text-gray-700 dark:text-gray-300 font-medium">{schedule.faculty_name}</td>
                                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{schedule.department}</td>
                                        <td className="px-5 py-4 text-gray-700 dark:text-gray-300">{semesterLabel(schedule.semester)}</td>
                                        <td className="px-5 py-4 text-gray-700 dark:text-gray-300">{schedule.academic_year}</td>
                                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                            {schedule.effective_from} — {schedule.effective_until}
                                        </td>
                                        <td className="px-5 py-4"><StatusBadge status={schedule.status} /></td>
                                        <td className="px-5 py-4"><TypeBadge type={schedule.schedule_type} /></td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <ActionButton icon="eye" label="View" onClick={() => openView(schedule)} />
                                                <ActionButton icon="edit" label="Edit" onClick={() => openEdit(schedule)} />
                                                <ActionButton icon="trash" label="Delete" onClick={() => openDelete(schedule)} danger />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-5 py-16 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-3">
                                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                                </svg>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No schedules found</p>
                                            <p className="mt-1 text-xs text-gray-400">Try adjusting your filters or add a new schedule.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 border-t border-gray-100 dark:border-gray-700/50">
                    <Pagination
                        currentPage={schedules.current_page}
                        totalItems={schedules.total}
                        perPage={schedules.per_page}
                        onPageChange={handlePageChange}
                        onPerPageChange={handlePerPageChange}
                    />
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CREATE MODAL
               ══════════════════════════════════════════ */}
            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="3xl">
                {/* Sticky header */}
                <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Add New Schedule</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the schedule details and add class entries below.</p>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <ScheduleForm
                        form={form}
                        setForm={setForm}
                        errors={errors}
                        setErrors={setErrors}
                        faculties={faculties}
                        addDetailRow={addDetailRow}
                        removeDetailRow={removeDetailRow}
                        updateDetail={updateDetail}
                    />
                </div>

                {/* Sticky footer */}
                <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700/60">
                    <button
                        onClick={() => setShowCreateModal(false)}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmitCreate}
                        disabled={processing}
                        className="rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? 'Creating...' : 'Create Schedule'}
                    </button>
                </div>
            </Modal>

            {/* ══════════════════════════════════════════
                EDIT MODAL
               ══════════════════════════════════════════ */}
            <Modal show={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="3xl">
                {/* Sticky header */}
                <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Edit Schedule</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the schedule information and class entries.</p>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <ScheduleForm
                        form={form}
                        setForm={setForm}
                        errors={errors}
                        setErrors={setErrors}
                        faculties={faculties}
                        addDetailRow={addDetailRow}
                        removeDetailRow={removeDetailRow}
                        updateDetail={updateDetail}
                    />
                </div>

                {/* Sticky footer */}
                <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700/60">
                    <button
                        onClick={() => setShowEditModal(false)}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmitEdit}
                        disabled={processing}
                        className="rounded-xl bg-gradient-to-r from-[#7a1315] to-[#cc2127] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </Modal>

            {/* ══════════════════════════════════════════
                VIEW MODAL
               ══════════════════════════════════════════ */}
            <Modal show={showViewModal} onClose={() => setShowViewModal(false)} maxWidth="2xl">
                {selectedSchedule && (
                    <>
                        {/* Sticky header */}
                        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{selectedSchedule.schedule_code}</h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedSchedule.faculty_name} — {selectedSchedule.department}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 flex-shrink-0">
                                    <StatusBadge status={selectedSchedule.status} />
                                    <TypeBadge type={selectedSchedule.schedule_type} />
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoField label="Academic Year" value={selectedSchedule.academic_year} />
                                <InfoField label="Semester" value={semesterLabel(selectedSchedule.semester)} />
                                <InfoField label="Effective From" value={selectedSchedule.effective_from} />
                                <InfoField label="Effective Until" value={selectedSchedule.effective_until} />
                                <InfoField label="Created By" value={selectedSchedule.created_by} />
                                <InfoField label="Created At" value={selectedSchedule.created_at} />
                            </div>

                            {selectedSchedule.notes && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">{selectedSchedule.notes}</p>
                                </div>
                            )}

                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Class Schedule</p>
                                <div className="space-y-2">
                                    {selectedSchedule.details.map((d, i) => (
                                        <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/40 px-4 py-3">
                                            <span className="font-bold text-sm text-gray-900 dark:text-white min-w-[80px]">{d.day_of_week.substring(0, 3)}</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{d.time_in} – {d.time_out}</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{d.subject_code || '—'}</span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">{d.subject_desc || '—'}</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500">{d.room || 'TBA'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Sticky footer */}
                        <div className="flex-shrink-0 flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700/60">
                            <button
                                onClick={() => setShowViewModal(false)}
                                className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            {/* ══════════════════════════════════════════
                DELETE CONFIRMATION MODAL
               ══════════════════════════════════════════ */}
            <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} maxWidth="md">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Delete Schedule</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
                        </div>
                    </div>

                    {selectedSchedule && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 mb-5">
                            Are you sure you want to delete <strong>{selectedSchedule.schedule_code}</strong> assigned to <strong>{selectedSchedule.faculty_name}</strong>?
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={processing}
                            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? 'Deleting...' : 'Delete Schedule'}
                        </button>
                    </div>
                </div>
            </Modal>

            <ScrollToTop />
        </AuthenticatedLayout>
    );
}

/* ──────────────────────────────────────────────
   Schedule Form component (shared between Create/Edit)
   ────────────────────────────────────────────── */
function ScheduleForm({ form, setForm, errors, setErrors, faculties, addDetailRow, removeDetailRow, updateDetail }) {
    const minAllowedMinutes = toMinutes(ALLOWED_TIME_MIN);
    const maxAllowedMinutes = toMinutes(ALLOWED_TIME_MAX);

    // Real-time cross-entry conflict detection
    useEffect(() => {
        const details = form.details;
        const count = details.length;
        const conflicts = {};

        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                if (details[i].day_of_week !== details[j].day_of_week) continue;
                const iStart = toMinutes(details[i].time_in);
                const iEnd   = toMinutes(details[i].time_out);
                const jStart = toMinutes(details[j].time_in);
                const jEnd   = toMinutes(details[j].time_out);
                if (iStart === null || iEnd === null || jStart === null || jEnd === null) continue;
                if (iStart >= iEnd || jStart >= jEnd) continue;
                if (iStart < jEnd && iEnd > jStart) {
                    conflicts[`details.${i}.time_in`] = `Entry #${i + 1} overlaps with entry #${j + 1} on ${details[i].day_of_week}.`;
                    conflicts[`details.${j}.time_in`] = `Entry #${j + 1} overlaps with entry #${i + 1} on ${details[j].day_of_week}.`;
                }
            }
        }

        setErrors((prev) => {
            const next = { ...prev };
            // Clear stale conflict errors (only those previously set by this logic)
            details.forEach((_, i) => {
                if (next[`details.${i}.time_in`]?.includes('overlaps with')) {
                    delete next[`details.${i}.time_in`];
                }
            });
            return { ...next, ...conflicts };
        });
    }, [form.details]); // eslint-disable-line react-hooks/exhaustive-deps

    const applyRowTimeValidation = (index, timeInValue, timeOutValue) => {
        const timeInMinutes = toMinutes(timeInValue);
        const timeOutMinutes = toMinutes(timeOutValue);

        setErrors((prevErrors) => {
            const nextErrors = { ...prevErrors };
            const timeInErrorKey = `details.${index}.time_in`;
            const timeOutErrorKey = `details.${index}.time_out`;

            delete nextErrors[timeInErrorKey];
            delete nextErrors[timeOutErrorKey];

            if (timeInMinutes !== null && (timeInMinutes < minAllowedMinutes || timeInMinutes > maxAllowedMinutes)) {
                nextErrors[timeInErrorKey] = 'Time In must be between 07:00 AM and 09:00 PM.';
            }

            if (timeOutMinutes !== null && (timeOutMinutes < minAllowedMinutes || timeOutMinutes > maxAllowedMinutes)) {
                nextErrors[timeOutErrorKey] = 'Time Out must be between 07:00 AM and 09:00 PM.';
                return nextErrors;
            }

            if (timeInMinutes !== null && timeOutMinutes !== null && timeOutMinutes <= timeInMinutes) {
                nextErrors[timeOutErrorKey] = 'Time Out must be later than Time In.';
            }

            return nextErrors;
        });
    };

    const toTimeString = (minutesValue) => {
        const clampedMinutes = Math.min(minutesValue, maxAllowedMinutes);
        const hours = Math.floor(clampedMinutes / 60);
        const minutes = clampedMinutes % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const computeHoursFromRange = (timeInValue, timeOutValue) => {
        const timeInMinutes = toMinutes(timeInValue);
        const timeOutMinutes = toMinutes(timeOutValue);

        if (timeInMinutes === null || timeOutMinutes === null || timeOutMinutes <= timeInMinutes) {
            return null;
        }

        const totalMinutes = timeOutMinutes - timeInMinutes;
        const roundedHours = Math.round(totalMinutes / 60);

        return Math.max(1, Math.min(12, roundedHours));
    };

    const computeTimeOutFromHours = (timeInValue, hoursValue) => {
        const timeInMinutes = toMinutes(timeInValue);
        if (timeInMinutes === null) {
            return null;
        }

        const normalizedHours = Number(hoursValue);
        if (!Number.isFinite(normalizedHours)) {
            return null;
        }

        const clampedHours = Math.max(1, Math.min(12, normalizedHours));
        return toTimeString(timeInMinutes + (clampedHours * 60));
    };

    const handleTimeOutChange = (index, timeOutValue) => {
        updateDetail(index, 'time_out', timeOutValue);

        const currentTimeIn = form.details[index]?.time_in;
        const computedHours = computeHoursFromRange(currentTimeIn, timeOutValue);

        applyRowTimeValidation(index, currentTimeIn, timeOutValue);

        if (computedHours !== null) {
            updateDetail(index, 'hours_required', computedHours);
        }
    };

    const handleTimeInChange = (index, timeInValue) => {
        updateDetail(index, 'time_in', timeInValue);

        const currentTimeOut = form.details[index]?.time_out;

        applyRowTimeValidation(index, timeInValue, currentTimeOut);
    };

    const handleHoursChange = (index, hoursValue) => {
        const parsedHours = Number(hoursValue);
        const clampedHours = Number.isFinite(parsedHours)
            ? Math.max(1, Math.min(12, parsedHours))
            : 1;

        updateDetail(index, 'hours_required', clampedHours);

        const currentTimeIn = form.details[index]?.time_in;
        const computedTimeOut = computeTimeOutFromHours(currentTimeIn, clampedHours);

        if (computedTimeOut !== null) {
            updateDetail(index, 'time_out', computedTimeOut);

            applyRowTimeValidation(index, currentTimeIn, computedTimeOut);
        }
    };

    return (
        <div className="mt-5 space-y-6">
            {errors.general && (
                <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">{errors.general}</p>
                </div>
            )}

            {/* Top fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Faculty" error={errors.faculty_id}>
                    <select
                        value={form.faculty_id}
                        onChange={(e) => setForm((f) => ({ ...f, faculty_id: e.target.value }))}
                        className="form-input"
                    >
                        <option value="">Select faculty...</option>
                        {faculties.map((f) => (
                            <option key={f.id} value={f.id}>{f.name} ({f.department})</option>
                        ))}
                    </select>
                </FormField>

                <FormField label="Schedule Code" error={errors.schedule_code}>
                    <input
                        type="text"
                        value={form.schedule_code}
                        onChange={(e) => setForm((f) => ({ ...f, schedule_code: e.target.value }))}
                        placeholder="e.g. SCH-FAC001-2S-2026"
                        className="form-input"
                    />
                </FormField>

                <FormField label="Academic Year" error={errors.academic_year}>
                    <input
                        type="number"
                        value={form.academic_year}
                        onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                        min="2020"
                        max="2100"
                        className="form-input"
                    />
                </FormField>

                <FormField label="Semester" error={errors.semester}>
                    <select
                        value={form.semester}
                        onChange={(e) => setForm((f) => ({ ...f, semester: Number(e.target.value) }))}
                        className="form-input"
                    >
                        {SEMESTERS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </FormField>

                <FormField label="Effective From" error={errors.effective_from}>
                    <input
                        type="date"
                        value={form.effective_from}
                        onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
                        className="form-input"
                    />
                </FormField>

                <FormField label="Effective Until" error={errors.effective_until}>
                    <input
                        type="date"
                        value={form.effective_until}
                        onChange={(e) => setForm((f) => ({ ...f, effective_until: e.target.value }))}
                        className="form-input"
                    />
                </FormField>

                <FormField label="Status" error={errors.status}>
                    <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="form-input"
                    >
                        {SCHEDULE_STATUSES.map((s) => (
                            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                </FormField>

                <FormField label="Schedule Type" error={errors.schedule_type}>
                    <select
                        value={form.schedule_type}
                        onChange={(e) => setForm((f) => ({ ...f, schedule_type: e.target.value }))}
                        className="form-input"
                    >
                        {SCHEDULE_TYPES.map((t) => (
                            <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </FormField>
            </div>

            {/* Notes */}
            <FormField label="Notes" error={errors.notes}>
                <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Optional notes..."
                    className="form-input resize-none"
                />
            </FormField>

            {/* Schedule Details */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Class Entries</p>
                    <button
                        type="button"
                        onClick={addDetailRow}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[#7a1315] dark:text-[#cc2127] bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Entry
                    </button>
                </div>

                {errors.details && (
                    <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errors.details}</p>
                )}

                <div className="space-y-3 pr-1">
                    {form.details.map((detail, index) => (
                        <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 p-4">
                            <div className="flex items-start justify-between mb-3">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">Entry #{index + 1}</span>
                                {form.details.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeDetailRow(index)}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Day</label>
                                    <select
                                        value={detail.day_of_week}
                                        onChange={(e) => updateDetail(index, 'day_of_week', e.target.value)}
                                        className="form-input-sm"
                                    >
                                        {DAYS.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    {errors[`details.${index}.day_of_week`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.day_of_week`]}</p>}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Time In</label>
                                    <input
                                        type="time"
                                        value={detail.time_in}
                                        onChange={(e) => handleTimeInChange(index, e.target.value)}
                                        min={ALLOWED_TIME_MIN}
                                        max={ALLOWED_TIME_MAX}
                                        className="form-input-sm"
                                    />
                                    {errors[`details.${index}.time_in`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.time_in`]}</p>}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Time Out</label>
                                    <input
                                        type="time"
                                        value={detail.time_out}
                                        onChange={(e) => handleTimeOutChange(index, e.target.value)}
                                        min={ALLOWED_TIME_MIN}
                                        max={ALLOWED_TIME_MAX}
                                        className="form-input-sm"
                                    />
                                    {errors[`details.${index}.time_out`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.time_out`]}</p>}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Hours</label>
                                    <input
                                        type="number"
                                        value={detail.hours_required}
                                        onChange={(e) => handleHoursChange(index, e.target.value)}
                                        min="1"
                                        max="12"
                                        className="form-input-sm"
                                    />
                                    {errors[`details.${index}.hours_required`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.hours_required`]}</p>}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Subject Code *</label>
                                    <input
                                        type="text"
                                        value={detail.subject_code}
                                        onChange={(e) => updateDetail(index, 'subject_code', e.target.value)}
                                        placeholder="CS101"
                                        required
                                        className="form-input-sm"
                                    />
                                    {errors[`details.${index}.subject_code`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.subject_code`]}</p>}
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={detail.subject_desc}
                                        onChange={(e) => updateDetail(index, 'subject_desc', e.target.value)}
                                        placeholder="Introduction to Computer Science"
                                        className="form-input-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Room *</label>
                                    <input
                                        type="text"
                                        value={detail.room}
                                        onChange={(e) => updateDetail(index, 'room', e.target.value)}
                                        placeholder="Room 201"
                                        required
                                        className="form-input-sm"
                                    />
                                    {errors[`details.${index}.room`] && <p className="text-xs text-red-500 mt-0.5">{errors[`details.${index}.room`]}</p>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Form field wrapper
   ────────────────────────────────────────────── */
function FormField({ label, error, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            {children}
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Info field (view modal)
   ────────────────────────────────────────────── */
function InfoField({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{value ?? '—'}</p>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Filter select component
   ────────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, options }) {
    return (
        <div className="min-w-[120px]">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7a1315]/30 focus:border-[#7a1315] outline-none transition-all cursor-pointer capitalize"
            >
                <option value="">All</option>
                {options.map((o) => (
                    <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
            </select>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Action button (table row)
   ────────────────────────────────────────────── */
function ActionButton({ icon, label, onClick, danger = false }) {
    const iconSvg = {
        eye: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
        ),
        edit: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
        ),
        trash: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
        ),
    };

    return (
        <button
            onClick={onClick}
            title={label}
            className={`rounded-lg p-2 transition-all duration-200 ${
                danger
                    ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white'
            }`}
        >
            {iconSvg[icon]}
        </button>
    );
}
