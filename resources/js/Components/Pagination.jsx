import CustomDatePicker from '@/Components/CustomDatePicker';

/**
 * Reusable Pagination component.
 *
 * Props
 * ─────────────────────────────────────────────
 *  currentPage   : number        – active page (1-indexed)
 *  totalItems    : number        – total number of records
 *  perPage       : number        – rows shown per page
 *  onPageChange  : (page) => void
 *  onPerPageChange : (size) => void
 *  perPageOptions: number[]      – dropdown choices (default [5,10,25,50])
 *  className     : string        – extra wrapper classes
 */

const CHEVRON_LEFT = (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
);

const CHEVRON_RIGHT = (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
);

/* ── helpers ────────────────────────────────── */

/**
 * Build an array of page numbers / ellipsis markers.
 * Example: [1, '…', 4, 5, 6, '…', 20]
 */
function buildPageRange(current, total) {
    const delta = 1; // pages on each side of current
    const pages = [];
    const rangeStart = Math.max(2, current - delta);
    const rangeEnd = Math.min(total - 1, current + delta);

    pages.push(1);

    if (rangeStart > 2) pages.push('…');

    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    if (rangeEnd < total - 1) pages.push('…');

    if (total > 1) pages.push(total);

    return pages;
}

/* ── component ─────────────────────────────── */

export default function Pagination({
    currentPage,
    totalItems,
    perPage,
    onPageChange,
    onPerPageChange,
    perPageOptions = [5, 10, 25, 50],
    className = '',
    // Optional Date Range Filter
    showDateRange = false,
    dateRange = { start: '', end: '' },
    onDateRangeChange = () => { },
}) {
    const totalPages = Math.ceil(totalItems / perPage);
    if (totalItems === 0 && !showDateRange) return null; // If empty and not forcing display for filter, hide. If filtering, still show so they can reset filter.

    const from = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const to = Math.min(currentPage * perPage, totalItems);

    const pages = buildPageRange(currentPage, totalPages);

    /* ── button base styles ── */
    const btnBase =
        'inline-flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed';
    const btnIdle =
        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700';
    const btnActive =
        'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md';

    return (
        <div className={`mt-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
            {/* ── Left: Entries dropdown + info + (Optional Date Range) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Show</span>
                        <select
                            id="pagination-per-page"
                            value={perPage}
                            onChange={(e) => onPerPageChange(Number(e.target.value))}
                            className="appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 pr-7 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 transition-all cursor-pointer"
                        >
                            {perPageOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                        <span className="font-medium">entries</span>
                    </label>

                    <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">
                        Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{from}–{to}</span> of{' '}
                        <span className="font-semibold text-gray-600 dark:text-gray-300">{totalItems}</span>
                    </span>
                </div>

                {/* Optional Date Range Search */}
                {showDateRange && (
                    <div className="flex items-center gap-2">
                        <div className="w-[156px]">
                            <CustomDatePicker
                                id="pagination-date-start"
                                value={dateRange.start}
                                onChange={(value) => onDateRangeChange({ ...dateRange, start: value })}
                                placeholder="mm/dd/yyyy"
                            />
                        </div>
                        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold px-1">to</span>
                        <div className="w-[156px]">
                            <CustomDatePicker
                                id="pagination-date-end"
                                value={dateRange.end}
                                onChange={(value) => onDateRangeChange({ ...dateRange, end: value })}
                                placeholder="mm/dd/yyyy"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right: Page buttons ── */}
            {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                    {/* Previous */}
                    <button
                        id="pagination-prev"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`${btnBase} ${btnIdle} gap-1 px-3 py-2`}
                    >
                        {CHEVRON_LEFT}
                        <span className="hidden sm:inline">Previous</span>
                    </button>

                    {/* Page numbers */}
                    {pages.map((p, idx) =>
                        p === '…' ? (
                            <span
                                key={`ellipsis-${idx}`}
                                className="px-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 select-none"
                            >
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={`${btnBase} h-8 w-8 ${p === currentPage ? btnActive : btnIdle}`}
                            >
                                {p}
                            </button>
                        ),
                    )}

                    {/* Next */}
                    <button
                        id="pagination-next"
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={`${btnBase} ${btnIdle} gap-1 px-3 py-2`}
                    >
                        <span className="hidden sm:inline">Next</span>
                        {CHEVRON_RIGHT}
                    </button>
                </div>
            )}
        </div>
    );
}
