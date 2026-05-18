import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DtrPreviewModal from '@/Components/Admin/DtrPreviewModal';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

const EXPORT_MODES = {
    default: {
        label: 'Default DTR',
        description: 'All active faculty members.',
    },
    temporary: {
        label: 'Temporary Substitution',
        description: 'Faculty members with temporary substitution schedules only.',
    },
};

export default function DtrExport({ facultyOptions = [], dtrExportDefaults = {}, dtrExportYears = [] }) {
    const [exportMode, setExportMode] = useState('default');
    const [selectedFacultyIds, setSelectedFacultyIds] = useState(
        dtrExportDefaults.faculty_id ? [dtrExportDefaults.faculty_id] : []
    );
    const [selectedMonth, setSelectedMonth] = useState(dtrExportDefaults.month ?? new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(dtrExportDefaults.year ?? new Date().getFullYear());
    const [showPreview, setShowPreview] = useState(false);
    const [search, setSearch] = useState('');

    const monthOptions = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];

    const temporaryFacultyOptions = useMemo(
        () => facultyOptions.filter((faculty) => Boolean(faculty.has_temporary_substitution)),
        [facultyOptions],
    );
    const activeFacultyOptions = exportMode === 'temporary' ? temporaryFacultyOptions : facultyOptions;
    const allFacultyIds = useMemo(() => activeFacultyOptions.map((faculty) => faculty.id), [activeFacultyOptions]);
    const filteredFacultyOptions = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return activeFacultyOptions;

        return activeFacultyOptions.filter((faculty) => {
            const name = String(faculty.name ?? '').toLowerCase();
            const department = String(faculty.department ?? '').toLowerCase();

            return name.includes(query) || department.includes(query);
        });
    }, [activeFacultyOptions, search]);
    const allSelected = selectedFacultyIds.length > 0 && selectedFacultyIds.length === allFacultyIds.length;

    const switchExportMode = (mode) => {
        setExportMode(mode);
        setSearch('');
        setSelectedFacultyIds([]);
    };

    const toggleSelectAll = () => {
        setSelectedFacultyIds(allSelected ? [] : allFacultyIds);
    };

    const toggleFaculty = (facultyId) => {
        setSelectedFacultyIds((prev) => {
            if (prev.includes(facultyId)) {
                return prev.filter((id) => id !== facultyId);
            }

            return [...prev, facultyId];
        });
    };

    const handlePreview = () => {
        if (selectedFacultyIds.length === 0) return;
        setShowPreview(true);
    };

    return (
        <AuthenticatedLayout>
            <Head title="DTR Export" />

            <section className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Export Monthly Time Record
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Select a DTR type, choose faculty, month and year, then preview before exporting.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:w-auto">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:ring-[#7a1315] focus:border-[#7a1315]"
                        >
                            {monthOptions.map((month) => (
                                <option key={month.value} value={month.value}>
                                    {month.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:ring-[#7a1315] focus:border-[#7a1315]"
                        >
                            {dtrExportYears.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={handlePreview}
                            disabled={selectedFacultyIds.length === 0}
                            className="rounded-xl bg-gradient-to-br from-[#7a1315] to-[#cc2127] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Preview Selected ({selectedFacultyIds.length})
                        </button>
                    </div>
                </div>

                <div className="mt-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(EXPORT_MODES).map(([mode, config]) => {
                            const isActive = exportMode === mode;

                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => switchExportMode(mode)}
                                    className={`rounded-t-xl px-4 py-3 text-left transition-all ${
                                        isActive
                                            ? 'bg-[#7a1315] text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <span className="block text-sm font-bold">{config.label}</span>
                                    <span className={`block text-xs ${isActive ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {mode === 'temporary'
                                            ? `${temporaryFacultyOptions.length} faculty with temporary substitution`
                                            : config.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search faculty or department..."
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold w-12">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                                    />
                                </th>
                                <th className="px-4 py-2 text-left font-semibold">Faculty</th>
                                <th className="px-4 py-2 text-left font-semibold">Department</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredFacultyOptions.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                        {activeFacultyOptions.length === 0
                                            ? (exportMode === 'temporary' ? 'No faculty with temporary substitution schedules.' : 'No faculty available.')
                                            : 'No matching faculty found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredFacultyOptions.map((faculty) => {
                                    const isSelected = selectedFacultyIds.includes(faculty.id);

                                    return (
                                        <tr key={faculty.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleFaculty(faculty.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                                                />
                                            </td>
                                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                                {faculty.name}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                                {faculty.department}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <DtrPreviewModal
                open={showPreview}
                onClose={() => setShowPreview(false)}
                facultyIds={selectedFacultyIds}
                month={selectedMonth}
                year={selectedYear}
                exportType={exportMode === 'temporary' ? 'temporary_substitute' : 'default'}
            />
        </AuthenticatedLayout>
    );
}
