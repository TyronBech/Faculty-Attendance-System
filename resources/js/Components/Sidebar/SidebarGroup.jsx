import { useState, useEffect } from "react";

export default function SidebarGroup({
    label,
    icon,
    active = false,
    collapsed = false,
    defaultOpen = false,
    children,
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen || active);

    // Auto-open when a child becomes active
    useEffect(() => {
        if (active) {
            setIsOpen(true);
        }
    }, [active]);

    if (collapsed) {
        // In collapsed mode, just show the icon — children are hidden
        return (
            <div className="relative group/sidebar-group">
                <button
                    type="button"
                    className={
                        "flex w-full items-center justify-center rounded-xl px-3 py-2.5 transition-all duration-200 " +
                        (active
                            ? "bg-gradient-to-r from-[#7a1315]/10 to-[#cc2127]/5 text-[#7a1315] dark:from-red-500/15 dark:to-red-500/5 dark:text-red-400"
                            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300")
                    }
                    title={label}
                >
                    <span
                        className={
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 " +
                            (active
                                ? "bg-[#7a1315]/10 text-[#7a1315] dark:bg-red-500/15 dark:text-red-400"
                                : "")
                        }
                    >
                        <i className={`fa-solid ${icon} text-[13px]`} />
                    </span>
                </button>

                {/* Flyout tooltip on hover */}
                <div className="invisible opacity-0 group-hover/sidebar-group:visible group-hover/sidebar-group:opacity-100 transition-all duration-200 absolute left-full top-0 ml-2 z-50">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-2 min-w-[180px]">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {label}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 " +
                    (active
                        ? "text-[#7a1315] dark:text-red-400"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200")
                }
            >
                {icon && (
                    <span
                        className={
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 " +
                            (active
                                ? "bg-[#7a1315]/10 text-[#7a1315] dark:bg-red-500/15 dark:text-red-400"
                                : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300")
                        }
                    >
                        <i className={`fa-solid ${icon} text-[13px]`} />
                    </span>
                )}
                <span className="flex-1 truncate text-left">{label}</span>
                <svg
                    className={
                        "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 " +
                        (isOpen ? "rotate-180" : "")
                    }
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>

            {/* Accordion content with smooth expand/collapse */}
            <div
                className={
                    "overflow-hidden transition-all duration-300 ease-in-out " +
                    (isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0")
                }
            >
                <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                    {children}
                </div>
            </div>
        </div>
    );
}
