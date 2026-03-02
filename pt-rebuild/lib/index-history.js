/**
 * index-history.js — pure history transforms for the index (tracker) page.
 *
 * Reuses groupLogsByDate from lib/pt-view.js. Adds index-specific helpers:
 * exercise-context filtering and adherence badge data for ExercisePicker.
 *
 * No React, no side effects. All functions accept plain data and return plain data.
 */

export { groupLogsByDate } from './pt-view.js';

/**
 * Filter logs to a single exercise when a session is active.
 * Returns all logs when exerciseId is null (default — no exercise open).
 *
 * @param {Array}  logs        - Full log array from useIndexData
 * @param {string|null} exerciseId - Active exercise ID, or null for unfiltered
 * @returns {Array} filtered logs
 */
export function filterHistoryByExercise(logs, exerciseId) {
    if (!exerciseId) return logs;
    return logs.filter(log => log.exercise_id === exerciseId);
}

/**
 * Compute adherence badge data for an exercise card in ExercisePicker.
 * Returns days since last session, total sessions, and a color class.
 *
 * @param {Array}  logs       - Full log array
 * @param {string} exerciseId - Exercise to check
 * @returns {{ daysSince: number|null, totalSessions: number, colorClass: string }}
 */
export function getAdherenceInfo(logs, exerciseId) {
    const exerciseLogs = logs.filter(log => log.exercise_id === exerciseId);
    const totalSessions = exerciseLogs.length;

    if (totalSessions === 0) {
        return { daysSince: null, totalSessions: 0, colorClass: 'never' };
    }

    const mostRecent = exerciseLogs.reduce((latest, log) =>
        new Date(log.performed_at) > new Date(latest.performed_at) ? log : latest
    );
    const daysSince = Math.floor(
        (Date.now() - new Date(mostRecent.performed_at)) / (1000 * 60 * 60 * 24)
    );

    let colorClass = 'good';     // 0-3 days — green
    if (daysSince >= 14) colorClass = 'overdue';  // 14+ days — red
    else if (daysSince >= 7) colorClass = 'due';  // 7-13 days — orange

    return { daysSince, totalSessions, colorClass };
}

/**
 * Get the last logged form parameters for an exercise (for pre-filling logger modal).
 * Returns form_data from the most recent set of the most recent session, or null.
 *
 * @param {Array}  logs       - Full log array
 * @param {string} exerciseId
 * @returns {object|null} form_data object or null
 */
export function getLastFormParams(logs, exerciseId) {
    const exerciseLogs = logs
        .filter(log => log.exercise_id === exerciseId)
        .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));

    if (exerciseLogs.length === 0) return null;

    const sets = exerciseLogs[0].sets ?? [];
    if (sets.length === 0) return null;

    // Return form_data from the first set of the most recent session
    return sets[0].form_data ?? null;
}
