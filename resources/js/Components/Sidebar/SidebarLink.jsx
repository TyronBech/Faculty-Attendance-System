import { Link } from "@inertiajs/react";

export default function SidebarLink({
    href,
    active = false,
    icon,
    children,
    method,
    as,
    collapsed = false,
    className = "",
}) {
    return (
        <Link
            href={href}
            method={method}
            as={as}
            className={
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 " +
                (active
                    ? "bg-gradient-to-r from-[#7a1315]/10 to-[#cc2127]/5 text-[#7a1315] dark:from-red-500/15 dark:to-red-500/5 dark:text-red-400 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200") +
                " " +
                className
            }
            title={collapsed ? (typeof children === "string" ? children : "") : undefined}
        >
            {/* Active indicator pill */}
            {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-[#7a1315] to-[#cc2127] dark:from-red-500 dark:to-red-400" />
            )}

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

            {!collapsed && (
                <span className="truncate">{children}</span>
            )}
        </Link>
    );
}
