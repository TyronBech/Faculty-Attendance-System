/**
 * Convert decimal hours to hours and minutes format
 * @param {number} decimalHours - Hours in decimal format (e.g., 10.5)
 * @returns {string} Formatted string (e.g., "10 hours 30 minutes" or "30 minutes")
 */
export const formatHours = (decimalHours) => {
    if (!decimalHours || decimalHours === 0) return '0 minutes';
    
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    // Handle edge case where rounding minutes gives 60
    if (minutes === 60) {
        return `${hours + 1} ${hours + 1 === 1 ? 'hour' : 'hours'}`;
    }
    
    if (hours === 0) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    
    if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

/**
 * Shorter version of formatHours that returns abbreviated format
 * @param {number} decimalHours - Hours in decimal format (e.g., 10.5)
 * @returns {string} Formatted string (e.g., "10h 30m")
 */
export const formatHoursShort = (decimalHours) => {
    if (!decimalHours || decimalHours === 0) return '0m';
    
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    // Handle edge case where rounding minutes gives 60
    if (minutes === 60) {
        return `${hours + 1}h`;
    }
    
    if (hours === 0) {
        return `${minutes}m`;
    }
    
    if (minutes === 0) {
        return `${hours}h`;
    }
    
    return `${hours}h ${minutes}m`;
};
