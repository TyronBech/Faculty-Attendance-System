import Dropdown from "@/Components/Dropdown";
import Sidebar from "@/Components/Sidebar/Sidebar";
import { Link, usePage } from "@inertiajs/react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function AuthenticatedLayout({ header, children }) {
    const { auth, flash } = usePage().props;
    const user = auth.user;
    const roles = auth.roles ?? [];

    const isAdmin =
        roles.includes("super_admin") ||
        roles.includes("admin") ||
        roles.includes("hr_staff") ||
        roles.includes("head_academic_program");
    const isFaculty = roles.includes("faculty");

    const profileRoute = isAdmin ? "admin.profile.edit" : "profile.edit";
    const logoutRoute = isAdmin ? "admin.logout" : "logout";
    const displayName = auth.display_name ?? user.username ?? user.email;
    const avatarInitial =
        displayName?.charAt(0)?.toUpperCase() ??
        user.email.charAt(0).toUpperCase();

    // Sidebar collapsed state
    // Desktop: collapsed = true means mini sidebar; Mobile: collapsed = true means hidden
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            return true; // Start collapsed (hidden) on mobile
        }
        // Persist desktop preference
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("sidebar-collapsed");
            return saved === "true";
        }
        return false;
    });

    const toggleSidebar = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("sidebar-collapsed", String(next));
            }
            return next;
        });
    };

    // ── Global flash → toast ──────────────────────────────────────────────
    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning)
            toast(flash.warning, {
                icon: "⚠️",
                style: {
                    background: "#fffbeb",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    borderRadius: "12px",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                },
            });
        if (flash?.info)
            toast(flash.info, {
                icon: "ℹ️",
                style: {
                    background: "#eff6ff",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    borderRadius: "12px",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                },
            });
    }, [flash]);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans antialiased selection:bg-[#7a1315] selection:text-white transition-colors duration-300">
            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onCollapse={toggleSidebar}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                {/* Top Header Bar */}
                <header className="sticky top-0 z-30 flex min-h-[4rem] py-3 items-center gap-4 border-b border-gray-200/80 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-4 sm:px-6 shrink-0">
                    {/* Menu toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg
                            className="h-5 w-5"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>

                    {/* Page Header */}
                    {header && (
                        <div className="flex-1 min-w-0 pl-2">{header}</div>
                    )}
                    {!header && <div className="flex-1" />}

                    {/* Desktop User Menu */}
                    <div className="flex items-center gap-3">
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-semibold leading-4 text-gray-700 dark:text-gray-200 transition-all duration-300 ease-in-out hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-[#a81a1e] focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm"
                                >
                                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#7a1315] to-[#cc2127] flex items-center justify-center text-xs text-white uppercase shadow-sm">
                                        {avatarInitial}
                                    </div>
                                    <span className="hidden sm:inline">
                                        {displayName}
                                    </span>
                                    <svg
                                        className="-me-0.5 ms-1 h-4 w-4 opacity-70 hidden sm:block"
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
                            </Dropdown.Trigger>

                            <Dropdown.Content>
                                <div className="block px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    Manage Account
                                </div>
                                <Dropdown.Link
                                    href={route(profileRoute)}
                                    className="font-medium"
                                >
                                    Profile Settings
                                </Dropdown.Link>
                                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                <Dropdown.Link
                                    href={route(logoutRoute)}
                                    method="post"
                                    as="button"
                                    className="font-medium text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                                >
                                    Sign Out
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
