import React, { useState, useEffect, useRef } from 'react';

// Utility to generate array of numbers with padding
const generateNumbers = (start, end, pad = 2) => {
    const result = [];
    for (let i = start; i <= end; i++) {
        result.push(String(i).padStart(pad, '0'));
    }
    return result;
};

const HOURS = generateNumbers(1, 12);
const MINUTES = generateNumbers(0, 59);

export default function CustomTimePicker({ value, onChange, id, placeholder = '--:-- --', disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Parse initial value (expected format: "HH:mm" 24h format from DB, or empty)
    const [hour, setHour] = useState('12');
    const [minute, setMinute] = useState('00');
    const [ampm, setAmpm] = useState('AM');
    const dropdownRef = useRef(null);

    const hourRef = useRef(null);
    const minuteRef = useRef(null);
    const dragStateRef = useRef({
        type: null,
        pointerId: null,
        startY: 0,
        startScrollTop: 0,
    });

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':');
            let hr = parseInt(h, 10);
            const isPm = hr >= 12;
            if (hr === 0) hr = 12;
            if (hr > 12) hr -= 12;
            
            setHour(String(hr).padStart(2, '0'));
            setMinute(m || '00');
            setAmpm(isPm ? 'PM' : 'AM');
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

    // Update parent when values change
    useEffect(() => {
        if (!isOpen) return; // Only update when interacting? Actually let's just use a submit button or update on change.
        
        let h24 = parseInt(hour, 10);
        if (ampm === 'PM' && h24 !== 12) h24 += 12;
        if (ampm === 'AM' && h24 === 12) h24 = 0;
        
        const formatted = `${String(h24).padStart(2, '0')}:${minute}`;
        if (formatted !== value) {
            onChange(formatted);
        }
    }, [hour, minute, ampm, isOpen]);

    // Handle scroll snapping
    const handleScroll = (e, type) => {
        const target = e.target;
        const itemHeight = 40; // 40px per item
        clearTimeout(target.scrollTimeout);
        
        target.scrollTimeout = setTimeout(() => {
            const index = Math.round(target.scrollTop / itemHeight);
            if (type === 'hour') {
                const h = HOURS[index] || HOURS[0];
                setHour(h);
            } else if (type === 'minute') {
                const m = MINUTES[index] || MINUTES[0];
                setMinute(m);
            }
        }, 100);
    };

    const handlePointerDown = (e, type) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const target = type === 'hour' ? hourRef.current : minuteRef.current;
        if (!target) return;

        if (dragStateRef.current.pointerId !== null) return;

        dragStateRef.current = {
            type,
            pointerId: e.pointerId,
            startY: e.clientY,
            startScrollTop: target.scrollTop,
        };

        target.setPointerCapture?.(e.pointerId);
        target.style.scrollBehavior = 'auto';
        target.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    };

    const handlePointerMove = (e, type) => {
        const target = type === 'hour' ? hourRef.current : minuteRef.current;
        const dragState = dragStateRef.current;

        if (!target || dragState.type !== type || dragState.pointerId !== e.pointerId) {
            return;
        }

        const deltaY = e.clientY - dragState.startY;
        target.scrollTop = dragState.startScrollTop - deltaY;
    };

    const handlePointerEnd = (e, type) => {
        const target = type === 'hour' ? hourRef.current : minuteRef.current;
        const dragState = dragStateRef.current;

        if (!target || dragState.type !== type || dragState.pointerId !== e.pointerId) {
            return;
        }

        target.releasePointerCapture?.(e.pointerId);
        target.style.scrollBehavior = 'smooth';
        target.style.cursor = 'grab';
        document.body.style.userSelect = '';
        dragStateRef.current = {
            type: null,
            pointerId: null,
            startY: 0,
            startScrollTop: 0,
        };

        handleScroll({ target }, type);
    };

    useEffect(() => {
        if (isOpen) return undefined;

        const activeType = dragStateRef.current.type;
        const activeTarget = activeType === 'hour'
            ? hourRef.current
            : activeType === 'minute'
                ? minuteRef.current
                : null;

        if (activeTarget) {
            activeTarget.style.scrollBehavior = 'smooth';
            activeTarget.style.cursor = 'grab';
        }

        dragStateRef.current = {
            type: null,
            pointerId: null,
            startY: 0,
            startScrollTop: 0,
        };
        document.body.style.userSelect = '';

        return undefined;
    }, [isOpen]);

    useEffect(() => {
        return () => {
            document.body.style.userSelect = '';
        };
    }, []);

    // Scroll to active on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (hourRef.current) {
                    const idx = HOURS.indexOf(hour);
                    hourRef.current.scrollTop = idx * 40;
                }
                if (minuteRef.current) {
                    const idx = MINUTES.indexOf(minute);
                    minuteRef.current.scrollTop = idx * 40;
                }
            }, 10);
        }
    }, [isOpen, hour, minute]);

    const displayValue = value ? (() => {
        const [h, m] = value.split(':');
        let hr = parseInt(h, 10);
        const isPm = hr >= 12;
        if (hr === 0) hr = 12;
        if (hr > 12) hr -= 12;
        return `${String(hr).padStart(2, '0')}:${m} ${isPm ? 'PM' : 'AM'}`;
    })() : '';

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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-2 p-5 rounded-xl border border-gray-700 bg-[#2d2d2d] shadow-xl min-w-[280px]">
                    
                    <div className="flex items-center justify-center gap-3">
                        {/* Hours Drum */}
                        <div className="relative h-[120px] w-16 overflow-hidden rounded-lg border border-gray-600 bg-[#252525]">
                            <div className="absolute top-1/2 left-0 right-0 h-10 -mt-5 border-y border-gray-600 bg-black/10 pointer-events-none z-10"></div>
                            <div 
                                ref={hourRef}
                                onScroll={(e) => handleScroll(e, 'hour')}
                                onPointerDown={(e) => handlePointerDown(e, 'hour')}
                                onPointerMove={(e) => handlePointerMove(e, 'hour')}
                                onPointerUp={(e) => handlePointerEnd(e, 'hour')}
                                onPointerCancel={(e) => handlePointerEnd(e, 'hour')}
                                className="h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar cursor-grab touch-none"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                <div className="h-10"></div> {/* padding top */}
                                {HOURS.map(h => (
                                    <div 
                                        key={h} 
                                        className={`h-10 flex items-center justify-center snap-center text-xl font-bold transition-colors
                                            ${h === hour ? 'text-white' : 'text-gray-500'}
                                        `}
                                    >
                                        {h}
                                    </div>
                                ))}
                                <div className="h-10"></div> {/* padding bottom */}
                            </div>
                        </div>

                        <div className="text-2xl font-bold text-gray-500 pb-1">:</div>

                        {/* Minutes Drum */}
                        <div className="relative h-[120px] w-16 overflow-hidden rounded-lg border border-gray-600 bg-[#252525]">
                            <div className="absolute top-1/2 left-0 right-0 h-10 -mt-5 border-y border-gray-600 bg-black/10 pointer-events-none z-10"></div>
                            <div 
                                ref={minuteRef}
                                onScroll={(e) => handleScroll(e, 'minute')}
                                onPointerDown={(e) => handlePointerDown(e, 'minute')}
                                onPointerMove={(e) => handlePointerMove(e, 'minute')}
                                onPointerUp={(e) => handlePointerEnd(e, 'minute')}
                                onPointerCancel={(e) => handlePointerEnd(e, 'minute')}
                                className="h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar cursor-grab touch-none"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                <div className="h-10"></div>
                                {MINUTES.map(m => (
                                    <div 
                                        key={m} 
                                        className={`h-10 flex items-center justify-center snap-center text-xl font-bold transition-colors
                                            ${m === minute ? 'text-white' : 'text-gray-500'}
                                        `}
                                    >
                                        {m}
                                    </div>
                                ))}
                                <div className="h-10"></div>
                            </div>
                        </div>

                        <div className="text-2xl font-bold text-gray-500 pb-1">:</div>

                        {/* AM/PM Toggle */}
                        <div className="flex flex-col gap-2 justify-center">
                            <button
                                type="button"
                                onClick={() => setAmpm('AM')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                                    ampm === 'AM' 
                                    ? 'bg-gray-700 border-gray-500 text-white' 
                                    : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                                }`}
                            >
                                AM
                            </button>
                            <button
                                type="button"
                                onClick={() => setAmpm('PM')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                                    ampm === 'PM' 
                                    ? 'bg-gray-700 border-gray-500 text-white' 
                                    : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                                }`}
                            >
                                PM
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-4 text-center text-xs font-semibold text-gray-400">
                        Drag up/down to scroll hours & minutes
                    </div>
                    
                    {/* Hide scrollbar styles locally */}
                    <style dangerouslySetInnerHTML={{__html: `
                        .hide-scrollbar::-webkit-scrollbar { display: none; }
                        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    `}} />
                </div>
            )}
        </div>
    );
}
