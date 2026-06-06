import React, { useState, useEffect, useRef } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CustomDatePicker({ value, onChange, placeholder = 'mm/dd/yyyy', id, disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (value) {
            const parsed = new Date(value);
            if (!isNaN(parsed)) {
                setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
            }
        }
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDateSelect = (day) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const formatted = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
        onChange(formatted);
        setIsOpen(false);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const renderCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const days = [];
        
        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push(
                <div key={`prev-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-500/50 text-sm">
                    {daysInPrevMonth - i}
                </div>
            );
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isSelected = value === currentDateStr;
            const isToday = new Date().toDateString() === new Date(year, month, i).toDateString();
            
            days.push(
                <button
                    key={`curr-${i}`}
                    type="button"
                    onClick={() => handleDateSelect(i)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all
                        ${isSelected ? 'bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/50 font-bold' 
                        : isToday ? 'text-blue-400 font-semibold hover:bg-gray-700/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'}
                    `}
                >
                    {i}
                </button>
            );
        }
        
        // Next month days to complete grid (42 cells total)
        const totalCells = firstDay + daysInMonth;
        const nextMonthCells = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
        for (let i = 1; i <= nextMonthCells; i++) {
            days.push(
                <div key={`next-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-500/50 text-sm">
                    {i}
                </div>
            );
        }
        
        return days;
    };

    const displayValue = value ? new Date(value).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                className={`relative ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                    }
                }}
            >
                <input
                    id={id}
                    type="text"
                    readOnly
                    disabled={disabled}
                    value={displayValue}
                    placeholder={placeholder}
                    className={`w-full rounded-xl border-gray-300 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-red-500 dark:focus:ring-red-500 dark:[color-scheme:dark] transition-all duration-300 ${disabled ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'cursor-pointer'}`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-2 p-4 rounded-xl border border-gray-700 bg-[#1e232d] shadow-xl w-[280px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            type="button" 
                            onClick={prevMonth}
                            className="p-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-sm font-semibold text-gray-200">
                            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </div>
                        <button 
                            type="button" 
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAYS.map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendarDays()}
                    </div>
                </div>
            )}
        </div>
    );
}
