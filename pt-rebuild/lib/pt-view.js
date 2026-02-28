/**
 * pt-view.js — pure data logic for the pt-view page.
 *
 * No React, no side effects. All functions are async and return data or throw.
 * Import these in pages/pt-view.js and call them from useEffect / event handlers.
 *
 * Same pattern as lib/rehab-coverage.js.
 */

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** @param {string} token - Supabase access token */
function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Fetch all logs for a patient (up to 1000).
 * @param {string} token
 * @param {string} patientId
 * @returns {Promise<Array>} logs array
 */
export async function fetchLogs(token, patientId) {
    const res = await fetch(`/api/logs?patient_id=${patientId}&limit=1000`, {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`fetchLogs failed: ${res.status}`);
    const data = await res.json();
    return data.logs ?? [];
}

/**
 * Fetch the patient's exercise programs.
 * @param {string} token
 * @param {string} patientId
 * @returns {Promise<Array>} programs array
 */
export async function fetchPrograms(token, patientId) {
    const res = await fetch(`/api/programs?patient_id=${patientId}`, {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`fetchPrograms failed: ${res.status}`);
    const data = await res.json();
    return data.programs ?? [];
}

/**
 * Fetch all users (for role resolution and messaging).
 * @param {string} token
 * @returns {Promise<Array>} users array
 */
export async function fetchUsers(token) {
    const res = await fetch('/api/users', {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`fetchUsers failed: ${res.status}`);
    const data = await res.json();
    return data.users ?? [];
}

/**
 * Fetch all messages for the current user.
 * @param {string} token
 * @returns {Promise<Array>} messages array
 */
export async function fetchMessages(token) {
    const res = await fetch('/api/logs?type=messages', {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`fetchMessages failed: ${res.status}`);
    const data = await res.json();
    return data.messages ?? [];
}

/**
 * Send a new message.
 * @param {string} token
 * @param {string} recipientId
 * @param {string} body
 * @returns {Promise<object>} created message
 */
export async function sendMessage(token, recipientId, body) {
    const res = await fetch('/api/logs?type=messages', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ recipient_id: recipientId, body }),
    });
    if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
    return res.json();
}

/**
 * Patch a message (mark read, archive, etc.).
 * @param {string} token
 * @param {string} messageId
 * @param {object} patch - e.g. { read: true } or { archived: true }
 * @returns {Promise<object>} updated message
 */
export async function patchMessage(token, messageId, patch) {
    const res = await fetch(`/api/logs?type=messages&id=${messageId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`patchMessage failed: ${res.status}`);
    return res.json();
}

/**
 * Delete a message permanently.
 * @param {string} token
 * @param {string} messageId
 */
export async function deleteMessage(token, messageId) {
    const res = await fetch(`/api/logs?type=messages&id=${messageId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`deleteMessage failed: ${res.status}`);
}

/**
 * Update email notification preference for the current user.
 * @param {string} token
 * @param {boolean} enabled
 */
export async function patchEmailNotifications(token, enabled) {
    const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ email_notifications_enabled: enabled }),
    });
    if (!res.ok) throw new Error(`patchEmailNotifications failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Data transforms
// ---------------------------------------------------------------------------

/**
 * Group logs by calendar date (locale date string), sorted newest first.
 *
 * @param {Array} logs
 * @returns {Array<{ dateKey: string, displayDate: string, logs: Array }>}
 */
export function groupLogsByDate(logs) {
    const grouped = {};
    for (const log of logs) {
        const d = new Date(log.performed_at);
        const key = d.toLocaleDateString();
        if (!grouped[key]) {
            grouped[key] = {
                dateKey: key,
                displayDate: d.toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                }),
                logs: [],
            };
        }
        grouped[key].logs.push(log);
    }
    // Sort descending (newest first)
    return Object.values(grouped).sort(
        (a, b) => new Date(b.dateKey) - new Date(a.dateKey)
    );
}

/**
 * Find prescribed exercises not performed in 7+ days.
 * Sorted by daysSince descending (worst first). Returns up to 10.
 *
 * @param {Array} logs
 * @param {Array} programs - active (non-archived) programs
 * @returns {Array<{ exerciseId, exerciseName, daysSince, neverDone }>}
 */
export function findNeedsAttention(logs, programs) {
    // Build map: exerciseId → most recent performed_at date
    const lastDoneMap = {};
    for (const log of logs) {
        const id = log.exercise_id;
        const date = new Date(log.performed_at);
        if (!lastDoneMap[id] || date > lastDoneMap[id]) {
            lastDoneMap[id] = date;
        }
    }

    const now = Date.now();
    const overdue = [];

    for (const program of programs) {
        if (program.exercises?.archived) continue;
        const id = program.exercise_id;
        const name = program.exercise_name ?? program.exercises?.canonical_name ?? id;
        const lastDone = lastDoneMap[id];

        if (!lastDone) {
            overdue.push({ exerciseId: id, exerciseName: name, daysSince: Infinity, neverDone: true });
        } else {
            const daysSince = Math.floor((now - lastDone) / (1000 * 60 * 60 * 24));
            if (daysSince >= 7) {
                overdue.push({ exerciseId: id, exerciseName: name, daysSince, neverDone: false });
            }
        }
    }

    // Sort worst first, cap at 10
    return overdue
        .sort((a, b) => b.daysSince - a.daysSince)
        .slice(0, 10);
}

/**
 * Urgency level for a needs-attention item.
 * Returns 'red' | 'orange' | 'yellow'
 *
 * @param {{ daysSince: number, neverDone: boolean }} item
 */
export function needsAttentionUrgency(item) {
    if (item.neverDone || item.daysSince > 14) return 'red';
    if (item.daysSince > 10) return 'orange';
    return 'yellow';
}

/**
 * Compute summary stats for the history dashboard.
 *
 * @param {Array} logs
 * @returns {{ daysActive: number, exercisesCovered: number, totalSessions: number }}
 */
export function computeSummaryStats(logs) {
    const uniqueDays = new Set(
        logs.map(l => new Date(l.performed_at).toLocaleDateString())
    );
    const uniqueExercises = new Set(logs.map(l => l.exercise_id));
    return {
        daysActive: uniqueDays.size,
        exercisesCovered: uniqueExercises.size,
        totalSessions: logs.length,
    };
}

/**
 * Concerning words — case-insensitive match against log notes.
 * Same list as the vanilla JS page.
 */
const CONCERNING_WORDS = [
    'pain', 'sharp', "couldn't", 'unable', 'stopped', 'worse',
    'difficult', 'hurt', 'ache', 'sore', 'swelling', 'tingling', 'numbness',
];

/**
 * Detect concerning keywords in a note string.
 * @param {string} noteText
 * @returns {string[]} matched words (lowercased, deduped)
 */
export function detectKeywords(noteText) {
    if (!noteText) return [];
    const found = new Set();
    for (const word of CONCERNING_WORDS) {
        if (new RegExp(word, 'i').test(noteText)) found.add(word);
    }
    return [...found];
}

/**
 * Apply client-side filters to a logs array.
 *
 * @param {Array} logs
 * @param {{ exercise: string, dateFrom: string, dateTo: string, query: string }} filters
 * @returns {Array} filtered logs
 */
export function applyFilters(logs, { exercise, dateFrom, dateTo, query }) {
    return logs.filter(log => {
        if (exercise && log.exercise_id !== exercise) return false;
        if (dateFrom && new Date(log.performed_at) < new Date(dateFrom)) return false;
        if (dateTo && new Date(log.performed_at) > new Date(dateTo + 'T23:59:59')) return false;
        if (query) {
            const q = query.toLowerCase();
            const inName = log.exercise_name?.toLowerCase().includes(q);
            const inNotes = log.notes?.toLowerCase().includes(q);
            if (!inName && !inNotes) return false;
        }
        return true;
    });
}

/**
 * Count unread messages (from others, newer than lastReadTime).
 * @param {Array} messages
 * @param {string} viewerId - current user's auth_id or id
 * @param {string} lastReadTime - ISO string
 * @returns {number}
 */
export function countUnreadMessages(messages, viewerId, lastReadTime) {
    const since = new Date(lastReadTime ?? 0);
    return messages.filter(m =>
        m.sender_id !== viewerId && new Date(m.created_at) > since
    ).length;
}

/**
 * Count recently sent messages not yet acknowledged (within 24h, newer than lastSentTime).
 * @param {Array} messages
 * @param {string} viewerId
 * @param {string} lastSentTime - ISO string
 * @returns {number}
 */
export function countRecentSent(messages, viewerId, lastSentTime) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since = new Date(lastSentTime ?? 0);
    return messages.filter(m =>
        m.sender_id === viewerId &&
        new Date(m.created_at) > oneDayAgo &&
        new Date(m.created_at) > since
    ).length;
}
