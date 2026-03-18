// lib/users.js — shared user and email-notification API helpers (used by index and pt-view)

/** @param {string} token - Supabase access token */
function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Fetch all users (admin only).
 * Returns the full users array from /api/users.
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
