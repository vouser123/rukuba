/**
 * date-utils.js — shared calendar-day helpers for migrated Next.js pages.
 *
 * These helpers normalize to local midnight so "today" and day buckets follow
 * calendar-day semantics instead of rolling 24-hour elapsed-time math.
 */

/**
 * Days between two dates using local calendar boundaries.
 * Returns a non-negative integer when endDate is on or after startDate.
 *
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {number}
 */
export function daysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}
