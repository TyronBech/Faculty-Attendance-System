import ApplicationLogo from "@/Components/ApplicationLogo";
import SidebarLink from "./SidebarLink";
import SidebarGroup from "./SidebarGroup";
import { PERMISSIONS } from "@/Constants/permissions";
import { hasPermission } from "@/Utils/permissions";
import { Link, usePage } from "@inertiajs/react";

export default function Sidebar({ collapsed, onCollapse }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const roles = auth.roles ?? [];
    const permissions = auth.permissions ?? [];
    const can = (required) => hasPermission(permissions, required);

    const isFaculty = roles.includes("faculty");
    const isAdmin =
        roles.includes("super_admin") ||
        roles.includes("admin") ||
        roles.includes("hr_staff") ||
        roles.includes("head_academic_program");
    const isSuperAdmin = roles.includes("super_admin");

    // Faculty permissions
    const canViewFacultyAttendance = can(PERMISSIONS.VIEW_ATTENDANCE);
    const canGenerateFacultyDtr = can(PERMISSIONS.GENERATE_DTR);
    const canViewFacultyRequests = can(PERMISSIONS.VIEW_OWN_REQUESTS);

    // Admin permissions
    const canViewAdminSchedules = can(PERMISSIONS.VIEW_SCHEDULES);
    const canManageRbac = can([
        PERMISSIONS.MANAGE_ROLES,
        PERMISSIONS.MANAGE_PERMISSIONS,
    ]);
    const canViewAdminRequests = can(PERMISSIONS.VIEW_REQUESTS);
    const canViewAdminHolidays = can(PERMISSIONS.VIEW_HOLIDAYS);
    const canViewAdminLogs = can(PERMISSIONS.VIEW_LOGS);
    const canViewAdminAttendanceImports = can(PERMISSIONS.VIEW_BIOMETRIC_LOGS);
    const canViewAdminManualAttendance =
        isSuperAdmin || can(PERMISSIONS.VIEW_ATTENDANCE);
    const canViewAdminBackups =
        isSuperAdmin || can(PERMISSIONS.BACKUP_DATABASE);
    const canViewAdminDtrExport = can(PERMISSIONS.GENERATE_DTR);
    const canSeeAdminAttendanceDropdown =
        canViewAdminAttendanceImports ||
        canViewAdminManualAttendance ||
        canViewAdminBackups ||
        canViewAdminDtrExport;

    const dashboardRoute = isAdmin
        ? "admin.dashboard"
        : isFaculty
          ? "faculty.dashboard"
          : "dashboard";
    const profileRoute = isAdmin ? "admin.profile.edit" : "profile.edit";
    const logoutRoute = isAdmin ? "admin.logout" : "logout";
    const displayName = auth.display_name ?? user.username ?? user.email;
    const avatarInitial =
        displayName?.charAt(0)?.toUpperCase() ??
        user.email.charAt(0).toUpperCase();

    const dashboardActive = isAdmin
        ? route().current("admin.dashboard")
        : isFaculty
          ? route().current("faculty.dashboard")
          : route().current("dashboard");

    // Faculty Requests group active state
    const facultyRequestsActive =
        route().current("faculty.schedule-change-requests.*") ||
        route().current("faculty.online-attendance.*") ||
        route().current("faculty.undertime-requests.*") ||
        route().current("faculty.manual-attendance-requests.*");

    // Admin Requests group active state
    const adminRequestsActive =
        route().current("admin.schedule-change-requests.*") ||
        route().current("admin.online-requests.*") ||
        route().current("admin.undertime-justifications.*") ||
        route().current("admin.manual-attendance-requests.*");

    // Admin Attendance group active state
    const adminAttendanceActive =
        route().current("admin.attendance-imports.*") ||
        route().current("admin.manual-attendance.*") ||
        route().current("admin.backups.*") ||
        route().current("admin.dtr-export.*");

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={
                    "fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden " +
                    (collapsed === false
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none")
                }
                onClick={onCollapse}
            />

            {/* Sidebar */}
            <aside
                className={
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl transition-all duration-300 ease-in-out " +
                    "lg:relative lg:z-auto " +
                    // Mobile: slide in/out
                    (collapsed === false
                        ? "translate-x-0 w-[272px]"
                        : "-translate-x-full w-[272px] lg:translate-x-0 " +
                          // Desktop collapsed width
                          "lg:w-[72px]")
                }
            >
                {/* ── Brand Header ──────────────────────────── */}
                <div className="flex h-16 items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-4 shrink-0">
                    <Link
                        href={route(dashboardRoute)}
                        className="transition-transform hover:scale-105 active:scale-95"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] shadow-lg shadow-red-900/20">
                            <ApplicationLogo className="h-6 w-6 text-white fill-white" />
                        </div>
                    </Link>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                FAS
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                Faculty Attendance
                            </span>
                        </div>
                    )}
                    {/* Close button — visible on mobile only */}
                    <button
                        onClick={onCollapse}
                        className="ml-auto flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* ── Navigation Links ──────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1 scrollbar-thin">
                    {/* Section Label */}
                    {!collapsed && (
                        <p className="px-3 mb-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Menu
                        </p>
                    )}

                    {/* Dashboard */}
                    <SidebarLink
                        href={route(dashboardRoute)}
                        active={dashboardActive}
                        icon="fa-gauge-high"
                        collapsed={collapsed}
                    >
                        Dashboard
                    </SidebarLink>

                    {/* ── Faculty Links ───────────────────────── */}
                    {isFaculty && (
                        <>
                            <SidebarLink
                                href={route("faculty.schedule")}
                                active={route().current("faculty.schedule")}
                                icon="fa-calendar-days"
                                collapsed={collapsed}
                            >
                                Schedule
                            </SidebarLink>

                            {canViewFacultyAttendance && (
                                <SidebarLink
                                    href={route("faculty.attendance")}
                                    active={route().current(
                                        "faculty.attendance",
                                    )}
                                    icon="fa-clipboard-check"
                                    collapsed={collapsed}
                                >
                                    Attendance
                                </SidebarLink>
                            )}

                            {canGenerateFacultyDtr && (
                                <SidebarLink
                                    href={route("faculty.dtr.index")}
                                    active={route().current("faculty.dtr.*")}
                                    icon="fa-file-lines"
                                    collapsed={collapsed}
                                >
                                    My DTR
                                </SidebarLink>
                            )}

                            {/* Faculty Requests Group */}
                            {canViewFacultyRequests && (
                                <SidebarGroup
                                    label="Requests"
                                    icon="fa-paper-plane"
                                    active={facultyRequestsActive}
                                    collapsed={collapsed}
                                >
                                    <SidebarLink
                                        href={route(
                                            "faculty.schedule-change-requests.index",
                                        )}
                                        active={route().current(
                                            "faculty.schedule-change-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Change Schedule
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "faculty.online-attendance.index",
                                        )}
                                        active={route().current(
                                            "faculty.online-attendance.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Online Attendance
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "faculty.undertime-requests.index",
                                        )}
                                        active={route().current(
                                            "faculty.undertime-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Undertime Requests
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "faculty.manual-attendance-requests.index",
                                        )}
                                        active={route().current(
                                            "faculty.manual-attendance-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Manual Attendance
                                    </SidebarLink>
                                </SidebarGroup>
                            )}
                        </>
                    )}

                    {/* ── Admin Links ─────────────────────────── */}
                    {isAdmin && (
                        <>
                            {!collapsed && (
                                <p className="px-3 mt-6 mb-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    Management
                                </p>
                            )}
                            {collapsed && (
                                <div className="my-3 mx-2 border-t border-gray-100 dark:border-gray-800" />
                            )}

                            {canViewAdminSchedules && (
                                <SidebarLink
                                    href={route("admin.schedules.index")}
                                    active={route().current(
                                        "admin.schedules.*",
                                    )}
                                    icon="fa-calendar-days"
                                    collapsed={collapsed}
                                >
                                    Schedules
                                </SidebarLink>
                            )}

                            {(isSuperAdmin || canManageRbac) && (
                                <SidebarLink
                                    href={route("admin.rbac.index")}
                                    active={route().current("admin.rbac.*")}
                                    icon="fa-users-gear"
                                    collapsed={collapsed}
                                >
                                    Manage Users
                                </SidebarLink>
                            )}

                            {/* Admin Requests Group */}
                            {canViewAdminRequests && (
                                <SidebarGroup
                                    label="Requests"
                                    icon="fa-inbox"
                                    active={adminRequestsActive}
                                    collapsed={collapsed}
                                >
                                    <SidebarLink
                                        href={route(
                                            "admin.schedule-change-requests.index",
                                        )}
                                        active={route().current(
                                            "admin.schedule-change-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Schedule Changes
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "admin.online-requests.index",
                                        )}
                                        active={route().current(
                                            "admin.online-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Online Class Requests
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "admin.undertime-justifications.index",
                                        )}
                                        active={route().current(
                                            "admin.undertime-justifications.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Undertime Justifications
                                    </SidebarLink>
                                    <SidebarLink
                                        href={route(
                                            "admin.manual-attendance-requests.index",
                                        )}
                                        active={route().current(
                                            "admin.manual-attendance-requests.*",
                                        )}
                                        collapsed={false}
                                    >
                                        Manual Log Requests
                                    </SidebarLink>
                                </SidebarGroup>
                            )}

                            {canViewAdminHolidays && (
                                <SidebarLink
                                    href={route("admin.holidays.index")}
                                    active={route().current(
                                        "admin.holidays.*",
                                    )}
                                    icon="fa-umbrella-beach"
                                    collapsed={collapsed}
                                >
                                    Holidays
                                </SidebarLink>
                            )}

                            {canViewAdminLogs && (
                                <SidebarLink
                                    href={route("admin.activity-logs.index")}
                                    active={route().current(
                                        "admin.activity-logs.*",
                                    )}
                                    icon="fa-clock-rotate-left"
                                    collapsed={collapsed}
                                >
                                    Activity Logs
                                </SidebarLink>
                            )}

                            {/* Admin Attendance Group */}
                            {canSeeAdminAttendanceDropdown && (
                                <SidebarGroup
                                    label="Attendance"
                                    icon="fa-fingerprint"
                                    active={adminAttendanceActive}
                                    collapsed={collapsed}
                                >
                                    {canViewAdminAttendanceImports && (
                                        <SidebarLink
                                            href={route(
                                                "admin.attendance-imports.index",
                                            )}
                                            active={route().current(
                                                "admin.attendance-imports.*",
                                            )}
                                            collapsed={false}
                                        >
                                            Attendance Imports
                                        </SidebarLink>
                                    )}
                                    {canViewAdminManualAttendance && (
                                        <SidebarLink
                                            href={route(
                                                "admin.manual-attendance.index",
                                            )}
                                            active={route().current(
                                                "admin.manual-attendance.*",
                                            )}
                                            collapsed={false}
                                        >
                                            Manual Attendance
                                        </SidebarLink>
                                    )}
                                    {canViewAdminBackups && (
                                        <SidebarLink
                                            href={route("admin.backups.index")}
                                            active={route().current(
                                                "admin.backups.*",
                                            )}
                                            collapsed={false}
                                        >
                                            Backups
                                        </SidebarLink>
                                    )}
                                    {canViewAdminDtrExport && (
                                        <SidebarLink
                                            href={route(
                                                "admin.dtr-export.index",
                                            )}
                                            active={route().current(
                                                "admin.dtr-export.*",
                                            )}
                                            collapsed={false}
                                        >
                                            DTR Export
                                        </SidebarLink>
                                    )}
                                </SidebarGroup>
                            )}
                        </>
                    )}
                </nav>

                {/* ── User Profile Footer ──────────────────── */}
                <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3">
                    {collapsed ? (
                        // Collapsed: just show avatar
                        <Link
                            href={route(profileRoute)}
                            className="flex items-center justify-center"
                            title={displayName}
                        >
                            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#7a1315] to-[#cc2127] flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm hover:shadow-md transition-shadow">
                                {avatarInitial}
                            </div>
                        </Link>
                    ) : (
                        // Expanded: full user card
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-[#7a1315] to-[#cc2127] flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                                {avatarInitial}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {displayName}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                    {user.email}
                                </p>
                            </div>
                            <Link
                                href={route(logoutRoute)}
                                method="post"
                                as="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                                title="Sign Out"
                            >
                                <i className="fa-solid fa-right-from-bracket text-[13px]" />
                            </Link>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
