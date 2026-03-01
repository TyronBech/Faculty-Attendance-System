import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AuthenticatedLayout({ header, children }) {
    const { auth, flash } = usePage().props;
    const user = auth.user;
    const roles = auth.roles ?? [];

    // Determine the correct dashboard route based on user role
    const isFaculty = roles.includes('faculty');
    const isAdmin = roles.includes('super_admin') || roles.includes('admin') || roles.includes('hr_staff');
    const dashboardRoute = isAdmin ? 'admin.dashboard' : (isFaculty ? 'faculty.dashboard' : 'dashboard');
    const logoutRoute = isAdmin ? 'admin.logout' : 'logout';
    const dashboardActive = isAdmin
        ? route().current('admin.dashboard')
        : (isFaculty
            ? route().current('faculty.dashboard')
            : route().current('dashboard'));

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);
    const [mobileAttendanceOpen, setMobileAttendanceOpen] = useState(false);
    const [mobileFacultyRequestsOpen, setMobileFacultyRequestsOpen] = useState(false);
    const [mobileAdminRequestsOpen, setMobileAdminRequestsOpen] = useState(false);

    // ── Global flash → toast ──────────────────────────────────────────────
    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning) toast(
            flash.warning,
            {
                icon: '⚠️',
                style: {
                    background: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    borderRadius: '12px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                },
            }
        );
        if (flash?.info) toast(
            flash.info,
            {
                icon: 'ℹ️',
                style: {
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                },
            }
        );
    }, [flash]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans antialiased selection:bg-[#7a1315] selection:text-white transition-colors duration-300">
            {/* Top Navigation Bar */}
            <nav className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between items-center">
                        <div className="flex items-center">
                            {/* Brand Logo */}
                            <div className="flex shrink-0 items-center">
                                <Link href={route(dashboardRoute)} className="transition-transform hover:scale-105 active:scale-95">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] shadow-lg shadow-red-900/20">
                                        <ApplicationLogo className="h-6 w-6 text-white fill-white" />
                                    </div>
                                </Link>
                            </div>

                            {/* Desktop Links */}
                            <div className="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex h-16 items-center">
                                <NavLink
                                    href={route(dashboardRoute)}
                                    active={dashboardActive}
                                >
                                    Dashboard
                                </NavLink>

                                {isFaculty && (
                                    <>
                                        <NavLink
                                            href={route('faculty.schedule')}
                                            active={route().current('faculty.schedule')}
                                        >
                                            Schedule
                                        </NavLink>

                                        {/* ── Attendance dropdown ───────────── */}
                                        <Dropdown>
                                            <Dropdown.Trigger>
                                                <button
                                                    type="button"
                                                    className={
                                                        'inline-flex items-center gap-1 border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition-all duration-300 ease-in-out focus:outline-none h-16 ' +
                                                        (route().current('faculty.attendance') || route().current('faculty.biometric-logs')
                                                            ? 'border-[#7a1315] text-gray-900 font-bold dark:border-red-500 dark:text-white'
                                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300')
                                                    }
                                                >
                                                    Attendance
                                                    <svg className="h-4 w-4 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </Dropdown.Trigger>
                                            <Dropdown.Content align="left" width="48" contentClasses="py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                <Dropdown.Link
                                                    href={route('faculty.attendance')}
                                                    className={route().current('faculty.attendance') ? '!bg-red-50 !text-[#7a1315] dark:!bg-gray-700 dark:!text-white' : ''}
                                                >
                                                    Attendance Records
                                                </Dropdown.Link>
                                                <Dropdown.Link
                                                    href={route('faculty.biometric-logs')}
                                                    className={route().current('faculty.biometric-logs') ? '!bg-red-50 !text-[#7a1315] dark:!bg-gray-700 dark:!text-white' : ''}
                                                >
                                                    Biometric Logs
                                                </Dropdown.Link>
                                            </Dropdown.Content>
                                        </Dropdown>

                                        {/* ── Requests dropdown ─────────────── */}
                                        <Dropdown>
                                            <Dropdown.Trigger>
                                                <button
                                                    type="button"
                                                    className={
                                                        'inline-flex items-center gap-1 border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition-all duration-300 ease-in-out focus:outline-none h-16 ' +
                                                        (route().current('faculty.schedule-change-requests.*') || route().current('faculty.online-attendance.*')
                                                            ? 'border-[#7a1315] text-gray-900 font-bold dark:border-red-500 dark:text-white'
                                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300')
                                                    }
                                                >
                                                    Requests
                                                    <svg className="h-4 w-4 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </Dropdown.Trigger>
                                            <Dropdown.Content align="left" width="48" contentClasses="py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                <Dropdown.Link
                                                    href={route('faculty.schedule-change-requests.index')}
                                                    className={route().current('faculty.schedule-change-requests.*') ? '!bg-red-50 !text-[#7a1315] dark:!bg-gray-700 dark:!text-white' : ''}
                                                >
                                                    Change Schedule
                                                </Dropdown.Link>
                                                <Dropdown.Link
                                                    href={route('faculty.online-attendance.index')}
                                                    className={route().current('faculty.online-attendance.*') ? '!bg-red-50 !text-[#7a1315] dark:!bg-gray-700 dark:!text-white' : ''}
                                                >
                                                    Online Attendance
                                                </Dropdown.Link>
                                            </Dropdown.Content>
                                        </Dropdown>
                                    </>
                                )}

                                {isAdmin && (
                                    <>
                                        <NavLink
                                            href={route('admin.schedules.index')}
                                            active={route().current('admin.schedules.*')}
                                        >
                                            Schedules
                                        </NavLink>

                                        {/* ── Admin Requests dropdown ───────── */}
                                        <Dropdown>
                                            <Dropdown.Trigger>
                                                <button
                                                    type="button"
                                                    className={
                                                        'inline-flex items-center gap-1 border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition-all duration-300 ease-in-out focus:outline-none h-16 ' +
                                                        (route().current('admin.schedule-change-requests.*')
                                                            ? 'border-[#7a1315] text-gray-900 font-bold dark:border-red-500 dark:text-white'
                                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300')
                                                    }
                                                >
                                                    Requests
                                                    <svg className="h-4 w-4 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </Dropdown.Trigger>
                                            <Dropdown.Content align="left" width="48" contentClasses="py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                <Dropdown.Link
                                                    href={route('admin.schedule-change-requests.index')}
                                                    className={route().current('admin.schedule-change-requests.*') ? '!bg-red-50 !text-[#7a1315] dark:!bg-gray-700 dark:!text-white' : ''}
                                                >
                                                    Schedule Changes
                                                </Dropdown.Link>
                                            </Dropdown.Content>
                                        </Dropdown>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Desktop User Menu */}
                        <div className="hidden sm:ms-6 sm:flex sm:items-center">
                            <div className="relative ms-3">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-semibold leading-4 text-gray-700 dark:text-gray-200 transition-all duration-300 ease-in-out hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-[#a81a1e] focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm"
                                            >
                                                {/* User Avatar Placeholder */}
                                                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#7a1315] to-[#cc2127] flex items-center justify-center text-xs text-white uppercase shadow-sm">
                                                    {user.email.charAt(0).toUpperCase()}
                                                </div>

                                                {user.email}

                                                <svg
                                                    className="-me-0.5 ms-1 h-4 w-4 opacity-70"
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
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <div className="block px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            Manage Account
                                        </div>
                                        <Dropdown.Link
                                            href={route('profile.edit')}
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
                        </div>

                        {/* Mobile Menu Toggle */}
                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                onClick={() =>
                                    setShowingNavigationDropdown(
                                        (previousState) => !previousState,
                                    )
                                }
                                className="inline-flex items-center justify-center rounded-xl p-2.5 text-gray-500 dark:text-gray-400 transition-colors duration-300 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 focus:bg-gray-100 dark:focus:bg-gray-800 focus:text-gray-700 dark:focus:text-gray-200 focus:outline-none"
                            >
                                <svg
                                    className="h-6 w-6"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        className={
                                            !showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                    <path
                                        className={
                                            showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                <div
                    className={
                        (showingNavigationDropdown ? 'block' : 'hidden') +
                        ' sm:hidden border-t border-gray-200 dark:border-gray-800 absolute w-full bg-white dark:bg-gray-900 shadow-xl dark:shadow-2xl'
                    }
                >
                    <div className="space-y-1 pb-3 pt-2">
                        <ResponsiveNavLink
                            href={route(dashboardRoute)}
                            active={dashboardActive}
                        >
                            Dashboard
                        </ResponsiveNavLink>

                        {isFaculty && (
                            <>
                                <ResponsiveNavLink
                                    href={route('faculty.schedule')}
                                    active={route().current('faculty.schedule')}
                                >
                                    Schedule
                                </ResponsiveNavLink>

                                {/* ── Attendance group ───────────── */}
                                <div>
                                    <button
                                        onClick={() => setMobileAttendanceOpen(!mobileAttendanceOpen)}
                                        className={
                                            'flex w-full items-center justify-between border-l-4 py-2 pe-4 ps-3 text-start text-base font-medium transition-all duration-300 ' +
                                            (route().current('faculty.attendance') || route().current('faculty.biometric-logs')
                                                ? 'border-[#7a1315] bg-red-50 text-[#7a1315] dark:border-red-500 dark:bg-red-900/20 dark:text-red-400'
                                                : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200')
                                        }
                                    >
                                        Attendance
                                        <svg className={'h-4 w-4 transition-transform duration-200 ' + (mobileAttendanceOpen ? 'rotate-180' : '')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {mobileAttendanceOpen && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 ps-4">
                                            <ResponsiveNavLink
                                                href={route('faculty.attendance')}
                                                active={route().current('faculty.attendance')}
                                            >
                                                Attendance Records
                                            </ResponsiveNavLink>
                                            <ResponsiveNavLink
                                                href={route('faculty.biometric-logs')}
                                                active={route().current('faculty.biometric-logs')}
                                            >
                                                Biometric Logs
                                            </ResponsiveNavLink>
                                        </div>
                                    )}
                                </div>

                                {/* ── Requests group ─────────────── */}
                                <div>
                                    <button
                                        onClick={() => setMobileFacultyRequestsOpen(!mobileFacultyRequestsOpen)}
                                        className={
                                            'flex w-full items-center justify-between border-l-4 py-2 pe-4 ps-3 text-start text-base font-medium transition-all duration-300 ' +
                                            (route().current('faculty.schedule-change-requests.*') || route().current('faculty.online-attendance.*')
                                                ? 'border-[#7a1315] bg-red-50 text-[#7a1315] dark:border-red-500 dark:bg-red-900/20 dark:text-red-400'
                                                : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200')
                                        }
                                    >
                                        Requests
                                        <svg className={'h-4 w-4 transition-transform duration-200 ' + (mobileFacultyRequestsOpen ? 'rotate-180' : '')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {mobileFacultyRequestsOpen && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 ps-4">
                                            <ResponsiveNavLink
                                                href={route('faculty.schedule-change-requests.index')}
                                                active={route().current('faculty.schedule-change-requests.*')}
                                            >
                                                Change Schedule
                                            </ResponsiveNavLink>
                                            <ResponsiveNavLink
                                                href={route('faculty.online-attendance.index')}
                                                active={route().current('faculty.online-attendance.*')}
                                            >
                                                Online Attendance
                                            </ResponsiveNavLink>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {isAdmin && (
                            <>
                                <ResponsiveNavLink
                                    href={route('admin.schedules.index')}
                                    active={route().current('admin.schedules.*')}
                                >
                                    Schedules
                                </ResponsiveNavLink>

                                {/* ── Admin Requests group ─────────── */}
                                <div>
                                    <button
                                        onClick={() => setMobileAdminRequestsOpen(!mobileAdminRequestsOpen)}
                                        className={
                                            'flex w-full items-center justify-between border-l-4 py-2 pe-4 ps-3 text-start text-base font-medium transition-all duration-300 ' +
                                            (route().current('admin.schedule-change-requests.*')
                                                ? 'border-[#7a1315] bg-red-50 text-[#7a1315] dark:border-red-500 dark:bg-red-900/20 dark:text-red-400'
                                                : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200')
                                        }
                                    >
                                        Requests
                                        <svg className={'h-4 w-4 transition-transform duration-200 ' + (mobileAdminRequestsOpen ? 'rotate-180' : '')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {mobileAdminRequestsOpen && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 ps-4">
                                            <ResponsiveNavLink
                                                href={route('admin.schedule-change-requests.index')}
                                                active={route().current('admin.schedule-change-requests.*')}
                                            >
                                                Schedule Changes
                                            </ResponsiveNavLink>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-800 pb-1 pt-4 bg-gray-50 dark:bg-gray-800/50">
                        <div className="px-4 flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#7a1315] to-[#cc2127] flex items-center justify-center text-sm font-bold text-white uppercase shadow-sm">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-base font-bold text-gray-800 dark:text-gray-100">
                                    {user.email}
                                </div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>
                                Profile Settings
                            </ResponsiveNavLink>
                            <ResponsiveNavLink
                                method="post"
                                href={route(logoutRoute)}
                                as="button"
                                className="!text-red-600 dark:!text-red-400 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                            >
                                Sign Out
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Page Header Area */}
            {header && (
                <header className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
                    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-between">
                        {header}
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
