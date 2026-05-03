import { useEffect, useState, useCallback } from 'react';
import Modal from '@/Components/Modal';

/**
 * AttachmentPreviewModal
 *
 * Supports two call signatures:
 *   1. Multi-attachment slider  — pass `attachments` (array) + optional `startIndex`
 *   2. Single-attachment legacy — pass `url` + optional `label`  (backwards compat)
 */
export default function AttachmentPreviewModal({
    show,
    onClose,
    // Multi-attachment (new)
    attachments = null,
    startIndex = 0,
    // Single-attachment legacy
    url = null,
    label = 'Attachment Preview',
}) {
    // Normalise into a single `items` array
    const items = attachments && attachments.length > 0
        ? attachments
        : url
            ? [{ url, custom_label: label }]
            : [];

    const [current, setCurrent] = useState(startIndex);

    // Re-sync when the modal opens / startIndex changes
    useEffect(() => {
        if (show) {
            setCurrent(Math.min(startIndex, Math.max(0, items.length - 1)));
        }
    }, [show, startIndex, items.length]);

    const prev = useCallback(() => {
        setCurrent((c) => (c - 1 + items.length) % items.length);
    }, [items.length]);

    const next = useCallback(() => {
        setCurrent((c) => (c + 1) % items.length);
    }, [items.length]);

    // Keyboard navigation
    useEffect(() => {
        if (!show) return;
        const handler = (e) => {
            if (e.key === 'ArrowLeft')  prev();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'Escape')     onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [show, prev, next, onClose]);

    const activeItem = items[current] ?? null;
    const activeUrl  = activeItem?.url ?? null;
    const activeLabel = activeItem?.custom_label || activeItem?.label || `File ${current + 1}`;
    const isImage = activeUrl?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || activeUrl?.includes('image');
    const total = items.length;

    return (
        <Modal show={show} onClose={onClose} maxWidth="5xl">
            <div className="flex flex-col" style={{ maxHeight: '92vh' }}>

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 shrink-0">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {activeLabel}
                            </h2>
                            {total > 1 && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {current + 1} of {total} documents
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors shrink-0"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Main viewer ─────────────────────────────────────────── */}
                <div className="relative flex-1 bg-gray-900 dark:bg-gray-950 flex items-center justify-center overflow-hidden" style={{ minHeight: '55vh' }}>

                    {/* Prev arrow */}
                    {total > 1 && (
                        <button
                            onClick={prev}
                            className="absolute left-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors shadow-lg"
                            aria-label="Previous document"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}

                    {/* Document display */}
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {activeUrl ? (
                            isImage ? (
                                <img
                                    key={activeUrl}
                                    src={activeUrl}
                                    alt={activeLabel}
                                    className="max-w-full max-h-[65vh] rounded-lg object-contain shadow-2xl ring-1 ring-white/10 transition-opacity duration-200"
                                />
                            ) : (
                                <iframe
                                    key={activeUrl}
                                    src={activeUrl}
                                    className="w-full rounded-lg bg-white shadow-2xl border-0"
                                    style={{ height: '65vh' }}
                                    title={activeLabel}
                                />
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-500 py-20">
                                <svg className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v12.75a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-400">No preview available</p>
                            </div>
                        )}
                    </div>

                    {/* Next arrow */}
                    {total > 1 && (
                        <button
                            onClick={next}
                            className="absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors shadow-lg"
                            aria-label="Next document"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* ── Thumbnail strip (only when >1 doc) ──────────────────── */}
                {total > 1 && (
                    <div className="shrink-0 bg-gray-800 dark:bg-gray-900 border-t border-gray-700 px-4 py-3">
                        <div className="flex items-center justify-center gap-2 overflow-x-auto">
                            {items.map((item, idx) => {
                                const thumbIsImage = item.url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrent(idx)}
                                        className={`relative shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${
                                            idx === current
                                                ? 'border-blue-400 ring-2 ring-blue-400/40 scale-105'
                                                : 'border-gray-600 hover:border-gray-400 opacity-60 hover:opacity-90'
                                        }`}
                                        aria-label={`View document ${idx + 1}`}
                                    >
                                        {thumbIsImage ? (
                                            <img
                                                src={item.url}
                                                alt={item.custom_label || `File ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center gap-0.5">
                                                <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                </svg>
                                                <span className="text-[8px] text-gray-400 truncate w-full text-center px-0.5">
                                                    {(item.custom_label || `File ${idx + 1}`).split('.').pop()?.toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        {/* Active indicator dot */}
                                        {idx === current && (
                                            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Dot indicators for many files */}
                        {total <= 10 && (
                            <div className="flex justify-center gap-1.5 mt-2">
                                {items.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrent(idx)}
                                        className={`h-1.5 rounded-full transition-all ${
                                            idx === current
                                                ? 'w-4 bg-blue-400'
                                                : 'w-1.5 bg-gray-600 hover:bg-gray-400'
                                        }`}
                                        aria-label={`Go to document ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div className="shrink-0 px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-b-2xl">
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                        {activeLabel}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Close
                        </button>
                        {activeUrl && (
                            <a
                                href={activeUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-900/20 hover:scale-105 transition-all active:scale-95"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
                                </svg>
                                Download
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
