const colorMap = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
};

function SummaryCard({ label, value, sub, color = 'red' }) {
    return (
        <div className={`rounded-xl border p-3 ${colorMap[color] ?? colorMap.red}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-extrabold leading-none">{value}</p>
            {sub && <p className="mt-0.5 text-xs opacity-70">{sub}</p>}
        </div>
    );
}

export function DtrSummary({ summary }) {
    const safeSummary = summary ?? {};

    return (
        <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Summary
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryCard label="Days Absent" value={safeSummary.daysAbsent ?? 0} color="red" />
                <SummaryCard label="Times Tardy" value={safeSummary.timesLate ?? 0} sub={`${safeSummary.totalLateMinutes ?? 0} mins`} color="amber" />
                <SummaryCard label="Under Time" value={safeSummary.timesUndertime ?? 0} sub={`${safeSummary.totalUndertimeMinutes ?? 0} mins`} color="orange" />
                <SummaryCard label="Night" value={safeSummary.timesNight ?? 0} sub={`${safeSummary.totalNightMinutes ?? 0} mins`} color="indigo" />
                <SummaryCard label="Overtime" value={safeSummary.timesOvertime ?? 0} sub={`${safeSummary.totalOvertimeMinutes ?? 0} mins`} color="emerald" />
                <SummaryCard label="OT Night" value={safeSummary.timesOvertimeNight ?? 0} sub={`${safeSummary.totalOvertimeNightMinutes ?? 0} mins`} color="purple" />
            </div>
        </div>
    );
}

export function DtrTimeLog({ rows, totalHours, mode = 'official', onModeChange }) {
    const activePrefix = mode === 'internal' ? 'internal_' : 'official_';
    const totalHoursText = Number(rows.reduce((total, row) => total + Number(row[`${activePrefix}total_hours_rendered`] ?? row.total_hours_rendered ?? 0), 0)).toFixed(2);

    return (
        <div>
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Time Logs
                </h3>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={() => onModeChange('official')}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                            mode === 'official'
                                ? 'bg-[#7a1315] text-white'
                                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                        Official
                    </button>
                    <button
                        type="button"
                        onClick={() => onModeChange('internal')}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                            mode === 'internal'
                                ? 'bg-[#7a1315] text-white'
                                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                        Internal
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            <th className="w-12 px-3 py-2 text-center font-semibold">Day</th>
                            <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Morning</th>
                            <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Afternoon</th>
                            <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Night</th>
                            <th className="w-20 px-2 py-2 text-center font-semibold">Total</th>
                            <th className="w-20 px-2 py-2 text-center font-semibold">Required</th>
                            <th className="w-16 px-2 py-2 text-center font-semibold">Tardy</th>
                            <th className="w-20 px-2 py-2 text-center font-semibold">Under Time</th>
                        </tr>
                        <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                            <th></th>
                            <th className="px-2 py-1 font-medium">IN</th>
                            <th className="px-2 py-1 font-medium">OUT</th>
                            <th className="px-2 py-1 font-medium">IN</th>
                            <th className="px-2 py-1 font-medium">OUT</th>
                            <th className="px-2 py-1 font-medium">IN</th>
                            <th className="px-2 py-1 font-medium">OUT</th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map((row) => {
                            const isHoliday = row.is_holiday;
                            const isAbsent = row.status === 'absent' && !isHoliday;
                            const prefix = mode === 'internal' ? 'internal_' : 'official_';
                            const tardyMinutes = Number(row[`${prefix}tardy_minutes`] ?? row.tardy_minutes ?? 0);
                            const undertimeMinutes = Number(row[`${prefix}undertime_minutes`] ?? row.undertime_minutes ?? 0);
                            const hasTardy = tardyMinutes > 0 || undertimeMinutes > 0;
                            const displayDay = mode === 'internal' ? (row.internal_day ?? row.day) : (row.official_day ?? row.day);
                            const dayShift = mode === 'internal' ? (row.internal_day_shift ?? 0) : 0;
                            const morningIn = row[`${prefix}morning_in`] ?? row.morning_in ?? '';
                            const morningOut = row[`${prefix}morning_out`] ?? row.morning_out ?? '';
                            const afternoonIn = row[`${prefix}afternoon_in`] ?? row.afternoon_in ?? '';
                            const afternoonOut = row[`${prefix}afternoon_out`] ?? row.afternoon_out ?? '';
                            const nightIn = row[`${prefix}night_in`] ?? row.night_in ?? '';
                            const nightOut = row[`${prefix}night_out`] ?? row.night_out ?? '';
                            const morningAbsent = Boolean(row[`${prefix}morning_absent`]);
                            const afternoonAbsent = Boolean(row[`${prefix}afternoon_absent`]);
                            const nightAbsent = Boolean(row[`${prefix}night_absent`]);
                            const hasTimes = Boolean(morningIn || morningOut || afternoonIn || afternoonOut || nightIn || nightOut);
                            const totalHours = Number(row[`${prefix}total_hours_rendered`] ?? row.total_hours_rendered ?? 0).toFixed(2);
                            const requiredHours = Number(row[`${prefix}required_hours`] ?? row.required_hours ?? 0).toFixed(2);

                            let rowClass = '';
                            if (isHoliday) {
                                rowClass = 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400';
                            } else if (isAbsent) {
                                rowClass = 'bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400';
                            } else if (hasTardy) {
                                rowClass = 'text-red-600 dark:text-red-400';
                            }

                            return (
                                <tr key={row.day} className={`${rowClass} transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                                    <td className="px-3 py-1.5 text-center text-xs font-bold">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span>{displayDay}</span>
                                            {dayShift !== 0 && (
                                                <span className="text-[9px] font-semibold text-indigo-700 dark:text-indigo-300">
                                                    {dayShift > 0 ? `+${dayShift}d` : `${dayShift}d`}
                                                </span>
                                            )}
                                            {isHoliday && hasTimes && (
                                                <span className="text-[9px] font-semibold uppercase text-green-700 dark:text-green-400">
                                                    {row.holiday_label || 'Holiday'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {isHoliday && !hasTimes ? (
                                        <td colSpan={6} className="px-2 py-1.5 text-center text-xs italic">
                                            {row.holiday_label || 'HOLIDAY'}
                                        </td>
                                    ) : (
                                        <>
                                            <td className={`px-2 py-1.5 text-center text-xs ${morningAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {morningIn}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center text-xs ${morningAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {morningOut}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center text-xs ${afternoonAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {afternoonIn}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center text-xs ${afternoonAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {afternoonOut}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center text-xs ${nightAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {nightIn}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center text-xs ${nightAbsent ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 font-semibold' : ''}`}>
                                                {nightOut}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-2 py-1.5 text-center text-xs font-semibold">
                                        {totalHours}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-xs font-semibold">
                                        {requiredHours}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-xs font-medium">
                                        {tardyMinutes > 0 ? tardyMinutes : ''}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-xs font-medium">
                                        {undertimeMinutes > 0 ? undertimeMinutes : ''}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold">
                                Totals
                            </td>
                            <td className="px-2 py-2 text-center text-xs font-bold">
                                {totalHoursText}
                            </td>
                            <td className="px-2 py-2 text-center text-xs font-bold">
                                {Number(rows.reduce((total, row) => total + Number(row[`${activePrefix}required_hours`] ?? row.required_hours ?? 0), 0)).toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-center text-xs font-bold">
                                {rows.reduce((total, row) => total + Number(row[`${activePrefix}tardy_minutes`] ?? row.tardy_minutes ?? 0), 0)}
                            </td>
                            <td className="px-2 py-2 text-center text-xs font-bold">
                                {rows.reduce((total, row) => total + Number(row[`${activePrefix}undertime_minutes`] ?? row.undertime_minutes ?? 0), 0)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
