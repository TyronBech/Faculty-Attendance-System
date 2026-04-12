import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import Checkbox from "@/Components/Checkbox";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import Modal from "@/Components/Modal";
import PrimaryButton from "@/Components/PrimaryButton";
import ScrollToTop from "@/Components/ScrollToTop";
import SecondaryButton from "@/Components/SecondaryButton";
import { Head, router, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";

const SOURCE_BADGE = {
    internal:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-400/30",
    official:
        "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-400/30",
};

const SOURCE_LABEL = {
    internal: "Internal",
    official: "Official",
};

function ScheduleDetailPill({ detail }) {
    const subjectLabel = detail.course_code
        ? `${detail.course_code} - ${detail.subject_desc ?? "Untitled Subject"}`
        : (detail.subject_desc ?? "Operational Duty");

    return (
        <div className="rounded-lg border border-gray-200/70 dark:border-gray-700/70 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${SOURCE_BADGE[detail.source] ?? SOURCE_BADGE.official}`}
                >
                    {SOURCE_LABEL[detail.source] ?? "Official"}
                </span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {subjectLabel}
                </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {detail.time_in} - {detail.time_out} | Room:{" "}
                {detail.room_code ?? "TBA"} | Schedule: {detail.schedule_code}
            </p>
        </div>
    );
}

function StatCard({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {value}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {hint}
            </p>
        </div>
    );
}

export default function ManualAttendance({
    targetDate,
    targetDay,
    candidates = [],
}) {
    const form = useForm({
        attendance_date: targetDate,
        faculty_ids: [],
        remarks: "",
    });

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [filterText, setFilterText] = useState("");

    const allFacultyIds = candidates.map((candidate) => candidate.faculty_id);
    const allSelected =
        allFacultyIds.length > 0 &&
        allFacultyIds.every((facultyId) =>
            form.data.faculty_ids.includes(facultyId),
        );
    const selectedCount = form.data.faculty_ids.length;

    const filteredCandidates = useMemo(() => {
        if (!filterText.trim()) {
            return candidates;
        }

        const searchValue = filterText.toLowerCase();

        return candidates.filter((candidate) => {
            const scheduleText = candidate.schedule_details
                .map(
                    (detail) =>
                        `${detail.course_code ?? ""} ${detail.subject_desc ?? ""} ${detail.room_code ?? ""} ${detail.schedule_code ?? ""}`,
                )
                .join(" ")
                .toLowerCase();

            return (
                candidate.faculty_name.toLowerCase().includes(searchValue) ||
                scheduleText.includes(searchValue)
            );
        });
    }, [candidates, filterText]);

    const internalQualifiedCount = useMemo(
        () =>
            candidates.filter((candidate) =>
                candidate.sources.includes("internal"),
            ).length,
        [candidates],
    );

    const officialFallbackCount = useMemo(
        () =>
            candidates.filter(
                (candidate) =>
                    !candidate.sources.includes("internal") &&
                    candidate.sources.includes("official"),
            ).length,
        [candidates],
    );

    const selectedFacultySummaries = useMemo(
        () =>
            candidates
                .filter((candidate) =>
                    form.data.faculty_ids.includes(candidate.faculty_id),
                )
                .map((candidate) => ({
                    id: candidate.faculty_id,
                    name: candidate.faculty_name,
                })),
        [candidates, form.data.faculty_ids],
    );

    function handleDateChange(event) {
        const nextDate = event.target.value;

        form.setData("attendance_date", nextDate);
        form.setData("faculty_ids", []);
        form.setData("remarks", "");
        setFilterText("");
        setShowConfirmModal(false);

        router.get(
            route("admin.manual-attendance.index"),
            { date: nextDate },
            {
                preserveState: false,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    function toggleFaculty(facultyId) {
        if (form.data.faculty_ids.includes(facultyId)) {
            form.setData(
                "faculty_ids",
                form.data.faculty_ids.filter((id) => id !== facultyId),
            );
            return;
        }

        form.setData("faculty_ids", [...form.data.faculty_ids, facultyId]);
    }

    function toggleAll() {
        form.setData("faculty_ids", allSelected ? [] : allFacultyIds);
    }

    function openConfirmModal() {
        if (selectedCount === 0) {
            return;
        }

        setShowConfirmModal(true);
    }

    function closeConfirmModal() {
        setShowConfirmModal(false);
    }

    function submitManualAttendance(event) {
        event.preventDefault();

        form.post(route("admin.manual-attendance.store"), {
            preserveScroll: true,
            onSuccess: () => {
                form.setData("faculty_ids", []);
                form.setData("remarks", "");
                setShowConfirmModal(false);
            },
        });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Manual Attendance" />
            <ScrollToTop />

            <section className="rounded-3xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm overflow-hidden">
                <div className="border-b border-gray-200/70 dark:border-gray-700/70 bg-gradient-to-r from-[#7a1315]/10 via-[#7a1315]/5 to-transparent dark:from-red-900/20 dark:via-red-900/10 dark:to-transparent px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a1315] dark:text-red-300">
                                Admin Tools
                            </p>
                            <h3 className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                Manual Attendance Entry
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
                                Use this when classes are suspended and faculty
                                cannot clock in/out. The system prioritizes
                                internal operational schedules and falls back to
                                official schedules for the selected date.
                            </p>
                        </div>

                        <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-[auto_auto] gap-3">
                            <div>
                                <InputLabel
                                    htmlFor="attendance_date"
                                    value="Attendance Date"
                                />
                                <input
                                    id="attendance_date"
                                    type="date"
                                    value={form.data.attendance_date}
                                    onChange={handleDateChange}
                                    className="w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-red-500 dark:focus:ring-red-500"
                                />
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Target Day
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {targetDay}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {form.data.attendance_date}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <StatCard
                            label="Qualified Faculty"
                            value={candidates.length}
                            hint="Active and effective schedule"
                        />
                        <StatCard
                            label="Selected"
                            value={selectedCount}
                            hint="Ready for manual encoding"
                        />
                        <StatCard
                            label="Internal Priority"
                            value={internalQualifiedCount}
                            hint="With operational schedule"
                        />
                        <StatCard
                            label="Official Fallback"
                            value={officialFallbackCount}
                            hint="No internal schedule for day"
                        />
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-900/40 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-lg bg-white dark:bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                    Select rows, then confirm with required
                                    remarks.
                                </span>
                                {selectedFacultySummaries
                                    .slice(0, 3)
                                    .map((faculty) => (
                                        <span
                                            key={faculty.id}
                                            className="inline-flex items-center rounded-lg bg-red-50 dark:bg-red-900/20 px-2.5 py-1 text-xs font-semibold text-[#7a1315] dark:text-red-300 border border-red-200 dark:border-red-800/50"
                                        >
                                            {faculty.name}
                                        </span>
                                    ))}
                                {selectedFacultySummaries.length > 3 && (
                                    <span className="inline-flex items-center rounded-lg bg-gray-200/70 dark:bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                                        +{selectedFacultySummaries.length - 3} more
                                        selected
                                    </span>
                                )}
                            </div>

                            <div className="w-full lg:w-72">
                                <InputLabel
                                    htmlFor="candidate_filter"
                                    value="Quick Search"
                                />
                                <input
                                    id="candidate_filter"
                                    type="text"
                                    value={filterText}
                                    onChange={(event) =>
                                        setFilterText(event.target.value)
                                    }
                                    placeholder="Search faculty, subject, room, code..."
                                    className="w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-red-500 dark:focus:ring-red-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
                        <div className="overflow-x-auto max-h-[58vh]">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 text-gray-600 dark:text-gray-400 backdrop-blur">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold w-14">
                                            <Checkbox
                                                checked={allSelected}
                                                onChange={toggleAll}
                                                aria-label="Select all rows"
                                                title="Select all rows"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold">
                                            Faculty
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold">
                                            Operational Time In
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold">
                                            Operational Time Out
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold">
                                            Schedule Details
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredCandidates.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-4 py-12 text-center"
                                            >
                                                <div className="mx-auto max-w-lg">
                                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                                                        <svg
                                                            className="h-6 w-6 text-gray-500 dark:text-gray-400"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            strokeWidth={1.5}
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M3.75 4.5h16.5m-16.5 7.5h16.5m-16.5 7.5h16.5"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <h4 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                                                        {candidates.length === 0
                                                            ? "No qualified schedules found"
                                                            : "No match for your search"}
                                                    </h4>
                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                        {candidates.length === 0
                                                            ? "No faculty with active and effective schedule found for this date."
                                                            : `No rows matched "${filterText}".`}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCandidates.map((candidate) => {
                                            const isChecked =
                                                form.data.faculty_ids.includes(
                                                    candidate.faculty_id,
                                                );

                                            return (
                                                <tr
                                                    key={candidate.faculty_id}
                                                    className={`align-top transition-colors ${
                                                        isChecked
                                                            ? "bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/60 dark:hover:bg-red-900/20"
                                                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                    }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onChange={() =>
                                                                toggleFaculty(
                                                                    candidate.faculty_id,
                                                                )
                                                            }
                                                            aria-label={`Select ${candidate.faculty_name}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {
                                                                candidate.faculty_name
                                                            }
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {
                                                                candidate.entry_count
                                                            }{" "}
                                                            schedule block(s)
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                                                        {
                                                            candidate.operational_time_in
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                                                        {
                                                            candidate.operational_time_out
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-2 max-w-xl">
                                                            {candidate.schedule_details.map(
                                                                (
                                                                    detail,
                                                                    index,
                                                                ) => (
                                                                    <ScheduleDetailPill
                                                                        key={`${candidate.faculty_id}-${detail.schedule_code}-${detail.time_in}-${index}`}
                                                                        detail={
                                                                            detail
                                                                        }
                                                                    />
                                                                ),
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                {selectedCount} faculty selected for {targetDay}
                            </p>
                            <InputError
                                message={form.errors.faculty_ids}
                                className="mt-1"
                            />
                        </div>
                        <PrimaryButton
                            type="button"
                            onClick={openConfirmModal}
                            disabled={
                                selectedCount === 0 || candidates.length === 0
                            }
                        >
                            Confirm Manual Attendance ({selectedCount})
                        </PrimaryButton>
                    </div>
                </div>
            </section>

            <Modal
                show={showConfirmModal}
                maxWidth="2xl"
                onClose={closeConfirmModal}
            >
                <form
                    onSubmit={submitManualAttendance}
                    className="flex h-full flex-col"
                >
                    <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-5 bg-gradient-to-r from-[#7a1315]/10 to-transparent dark:from-red-900/20 dark:to-transparent">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                            Confirm Manual Attendance Submission
                        </h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            You are about to create manual attendance for{" "}
                            {selectedCount} faculty member(s) on{" "}
                            {form.data.attendance_date} ({targetDay}).
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Date
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {form.data.attendance_date}
                                </p>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Day
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {targetDay}
                                </p>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Selected Faculty
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {selectedCount}
                                </p>
                            </div>
                        </div>

                        <div>
                            <InputLabel htmlFor="remarks" value="Remarks *" />
                            <textarea
                                id="remarks"
                                value={form.data.remarks}
                                onChange={(event) =>
                                    form.setData("remarks", event.target.value)
                                }
                                rows={4}
                                maxLength={1000}
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-red-500 dark:focus:ring-red-500"
                                placeholder="State why attendance is being manually encoded for this date."
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                                {form.data.remarks.length}/1000
                            </p>
                            <InputError
                                message={form.errors.remarks}
                                className="mt-2"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
                        <SecondaryButton
                            type="button"
                            onClick={closeConfirmModal}
                        >
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton
                            type="submit"
                            disabled={
                                form.processing ||
                                form.data.remarks.trim().length === 0
                            }
                        >
                            {form.processing
                                ? "Saving..."
                                : "Submit Manual Attendance"}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
