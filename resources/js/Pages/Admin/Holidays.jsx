import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/Pagination';
import ScrollToTop from '@/Components/ScrollToTop';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import { Head, router, useForm } from '@inertiajs/react';
import { useState, useCallback } from 'react';

/* ─────────────────────────────────────
   Constants
   ───────────────────────────────────── */
const HOLIDAY_TYPES = ['national', 'local', 'observance'];

const TYPE_STYLES = {
    national:    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300',
    local:       'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300',
    observance:  'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300',
};

const TYPE_ICONS = {
    national:   '🇵🇭',
    local:      '📍',
    observance: '📅',
};

/* ─────────────────────────────────────
   Sub-components
   ───────────────────────────────────── */
function TypeBadge({ type }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${TYPE_STYLES[type] ?? TYPE_STYLES.observance}`}>
            <span>{TYPE_ICONS[type] ?? '📅'}</span>
            {type}
        </span>
    );
}

function RecurringBadge({ recurring }) {
    return recurring ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300">
            ↺ Recurring
        </span>
    ) : (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-700 dark:text-gray-400">
            One-time
        </span>
    );
}

/* ─────────────────────────────────────
   Empty state
   ───────────────────────────────────── */
function EmptyState({ onAdd }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7a1315]/10 to-[#cc2127]/10 text-4xl shadow-inner">
                🗓️
            </div>
            <h3 className="mb-1 text-lg font-bold text-gray-800 dark:text-gray-100">No holidays found</h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                Add a holiday to prevent faculty from being marked absent on that day.
            </p>
            <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 active:scale-95 transition-all"
            >
                <span>+</span> Add Holiday
            </button>
        </div>
    );
}

/* ─────────────────────────────────────
   Holiday Form (create + edit)
   ───────────────────────────────────── */
function HolidayForm({ form, errors, onSubmit, processing, submitLabel }) {
    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {/* Date */}
            <div>
                <InputLabel htmlFor="holiday_date" value="Date *" />
                <input
                    id="holiday_date"
                    type="date"
                    className="mt-1 block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315]"
                    value={form.data.holiday_date}
                    onChange={(e) => form.setData('holiday_date', e.target.value)}
                />
                <InputError message={errors.holiday_date} className="mt-1" />
            </div>

            {/* Name */}
            <div>
                <InputLabel htmlFor="holiday_name" value="Name *" />
                <input
                    id="holiday_name"
                    type="text"
                    placeholder="e.g., Independence Day"
                    className="mt-1 block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315]"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                />
                <InputError message={errors.name} className="mt-1" />
            </div>

            {/* Type */}
            <div>
                <InputLabel htmlFor="holiday_type" value="Type *" />
                <select
                    id="holiday_type"
                    className="mt-1 block w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315]"
                    value={form.data.type}
                    onChange={(e) => form.setData('type', e.target.value)}
                >
                    {HOLIDAY_TYPES.map((t) => (
                        <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>
                <InputError message={errors.type} className="mt-1" />
            </div>

            {/* Recurring */}
            <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3">
                <input
                    id="is_recurring"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315] dark:border-gray-600"
                    checked={form.data.is_recurring}
                    onChange={(e) => form.setData('is_recurring', e.target.checked)}
                />
                <div>
                    <label htmlFor="is_recurring" className="block text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                        Recurring Holiday
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        If checked, this holiday applies on the same month &amp; day every year (e.g., Christmas, New Year).
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
                <PrimaryButton type="submit" disabled={processing}>
                    {processing ? 'Saving…' : submitLabel}
                </PrimaryButton>
            </div>
        </form>
    );
}

/* ─────────────────────────────────────
   Main Component
   ───────────────────────────────────── */
export default function AdminHolidays({ holidays, filters }) {
    // ── Filter state ─────────────────────────────────────────────────────
    const [search, setSearch]         = useState(filters.search || '');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [typeFilter, setTypeFilter] = useState(filters.type || '');
    const [yearFilter, setYearFilter] = useState(filters.year || '');
    const [perPage, setPerPage]       = useState(Number(filters.per_page) || 15);

    // ── Modals ────────────────────────────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal,   setShowEditModal]   = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selected,        setSelected]        = useState(null);

    // ── Forms ─────────────────────────────────────────────────────────────
    const defaultData = { holiday_date: '', name: '', type: 'national', is_recurring: false };

    const createForm = useForm({ ...defaultData });
    const editForm   = useForm({ ...defaultData });

    /* ── Navigation ───────────────────────────────────────────────────── */
    const reload = useCallback((overrides = {}) => {
        router.get(
            route('admin.holidays.index'),
            { search, type: typeFilter, year: yearFilter, per_page: perPage, ...overrides },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }, [search, typeFilter, yearFilter, perPage]);

    const handleFilter = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        reload({ search: searchInput, page: 1 });
    };

    const clearFilters = () => {
        setSearch(''); setSearchInput(''); setTypeFilter(''); setYearFilter('');
        reload({ search: '', type: '', year: '', page: 1 });
    };

    const handleTypeChange = (val) => {
        setTypeFilter(val);
        reload({ type: val, page: 1 });
    };

    const handleYearChange = (val) => {
        setYearFilter(val);
        reload({ year: val, page: 1 });
    };

    const handlePerPageChange = (size) => {
        setPerPage(size);
        reload({ per_page: size, page: 1 });
    };

    /* ── Create ───────────────────────────────────────────────────────── */
    const openCreate = () => {
        createForm.reset();
        createForm.setData({ ...defaultData });
        createForm.clearErrors();
        setShowCreateModal(true);
    };

    const handleCreate = (e) => {
        e.preventDefault();
        createForm.post(route('admin.holidays.store'), {
            preserveScroll: true,
            onSuccess: () => setShowCreateModal(false),
        });
    };

    /* ── Edit ─────────────────────────────────────────────────────────── */
    const openEdit = (holiday) => {
        setSelected(holiday);
        editForm.setData({
            holiday_date: holiday.holiday_date,
            name:         holiday.name,
            type:         holiday.type,
            is_recurring: !!holiday.is_recurring,
        });
        editForm.clearErrors();
        setShowEditModal(true);
    };

    const handleEdit = (e) => {
        e.preventDefault();
        editForm.put(route('admin.holidays.update', selected.id), {
            preserveScroll: true,
            onSuccess: () => setShowEditModal(false),
        });
    };

    /* ── Delete ───────────────────────────────────────────────────────── */
    const openDelete = (holiday) => {
        setSelected(holiday);
        setShowDeleteModal(true);
    };

    const handleDelete = () => {
        router.delete(route('admin.holidays.destroy', selected.id), {
            preserveScroll: true,
            onSuccess: () => setShowDeleteModal(false),
        });
    };

    /* ── Year options (current year ± 5) ──────────────────────────────── */
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Holiday Management
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Manage public &amp; local holidays — faculty won't be marked absent on these days.
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 active:scale-95 transition-all"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Holiday
                    </button>
                </div>
            }
        >
            <Head title="Holiday Management" />
            <ScrollToTop />

            {/* ── Filters ──────────────────────────────────────────────────── */}
            <div className="mb-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                <form onSubmit={handleFilter} className="flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="flex-1 min-w-48">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                            Search
                        </label>
                        <div className="relative">
                            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search holiday name…"
                                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#7a1315] focus:ring-[#7a1315]"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Type filter */}
                    <div className="min-w-40">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                            Type
                        </label>
                        <select
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-[#7a1315] focus:ring-[#7a1315]"
                            value={typeFilter}
                            onChange={(e) => handleTypeChange(e.target.value)}
                        >
                            <option value="">All Types</option>
                            {HOLIDAY_TYPES.map((t) => (
                                <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year filter */}
                    <div className="min-w-36">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                            Year
                        </label>
                        <select
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-[#7a1315] focus:ring-[#7a1315]"
                            value={yearFilter}
                            onChange={(e) => handleYearChange(e.target.value)}
                        >
                            <option value="">All Years</option>
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Rows per page */}
                    <div className="min-w-28">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                            Per Page
                        </label>
                        <select
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-[#7a1315] focus:ring-[#7a1315]"
                            value={perPage}
                            onChange={(e) => handlePerPageChange(Number(e.target.value))}
                        >
                            {[10, 15, 25, 50].map((n) => (
                                <option key={n} value={n}>{n} rows</option>
                            ))}
                        </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#9b1618] active:scale-95 transition-all"
                        >
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all"
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Stats chips ──────────────────────────────────────────────── */}
            {holidays.total > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-medium">
                        {holidays.total} holiday{holidays.total !== 1 ? 's' : ''} found
                    </span>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-medium">
                        Page {holidays.current_page} of {holidays.last_page}
                    </span>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {holidays.data.length === 0 ? (
                    <EmptyState onAdd={openCreate} />
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        {['Date', 'Name', 'Type', 'Recurrence', 'Actions'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {holidays.data.map((holiday) => (
                                        <tr key={holiday.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            {/* Date */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315]/10 to-[#cc2127]/10 text-lg font-bold text-[#7a1315] dark:text-red-400">
                                                        {new Date(holiday.holiday_date.substring(0, 10) + 'T00:00:00').getDate()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                            {new Date(holiday.holiday_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {new Date(holiday.holiday_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Name */}
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{holiday.name}</span>
                                            </td>

                                            {/* Type */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <TypeBadge type={holiday.type} />
                                            </td>

                                            {/* Recurrence */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <RecurringBadge recurring={holiday.is_recurring} />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEdit(holiday)}
                                                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => openDelete(holiday)}
                                                        className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                            {holidays.data.map((holiday) => (
                                <div key={holiday.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{holiday.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(holiday.holiday_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <TypeBadge type={holiday.type} />
                                            <RecurringBadge recurring={holiday.is_recurring} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(holiday)}
                                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => openDelete(holiday)}
                                            className="flex-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 active:scale-95 transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {holidays.last_page > 1 && (
                <div className="mt-6 flex justify-center">
                    <Pagination links={holidays.links} />
                </div>
            )}

            {/* ═══════════════════════════════
                  CREATE MODAL
                ═══════════════════════════════ */}
            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="md">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] text-white shadow">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Holiday</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Faculty won't be marked absent on this date.</p>
                        </div>
                    </div>

                    <HolidayForm
                        form={createForm}
                        errors={createForm.errors}
                        onSubmit={handleCreate}
                        processing={createForm.processing}
                        submitLabel="Add Holiday"
                    />

                    <div className="mt-4 flex justify-end">
                        <SecondaryButton onClick={() => setShowCreateModal(false)}>Cancel</SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* ═══════════════════════════════
                  EDIT MODAL
                ═══════════════════════════════ */}
            <Modal show={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="md">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Holiday</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Update the details for <strong>{selected?.name}</strong>.</p>
                        </div>
                    </div>

                    <HolidayForm
                        form={editForm}
                        errors={editForm.errors}
                        onSubmit={handleEdit}
                        processing={editForm.processing}
                        submitLabel="Save Changes"
                    />

                    <div className="mt-4 flex justify-end">
                        <SecondaryButton onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* ═══════════════════════════════
                  DELETE MODAL
                ═══════════════════════════════ */}
            <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} maxWidth="sm">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-500">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m2-3h6a1 1 0 011 1v1H6V5a1 1 0 011-1z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Remove Holiday</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
                        Are you sure you want to remove <strong className="text-gray-900 dark:text-white">{selected?.name}</strong>
                        {selected && (
                            <> ({new Date(selected.holiday_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })})</>
                        )}? Faculty may be marked absent on this date afterwards.
                    </p>

                    <div className="flex justify-end gap-3">
                        <SecondaryButton onClick={() => setShowDeleteModal(false)}>Cancel</SecondaryButton>
                        <DangerButton onClick={handleDelete}>Remove Holiday</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
