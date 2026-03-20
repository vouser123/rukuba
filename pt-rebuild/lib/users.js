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

function formatDisplayName(user) {
    if (!user) return '';
    const first = String(user.first_name ?? '').trim();
    const last = String(user.last_name ?? '').trim();
    const full = `${first} ${last}`.trim();
    return full || user.email || '';
}

/**
 * Resolve the current signed-in profile row plus the effective patient context
 * for patient-scoped routes such as pt-view and /program dosage editing.
 *
 * Therapists default to their first assigned patient. Patients and admins default
 * to their own profile row so they can edit their own patient-scoped data.
 *
 * @param {Array} users
 * @param {string} authUserId
 * @returns {{ currentUser: object, patientUser: object, patientDisplayName: string, fallbackRecipientId: string|null }}
 */
export function resolvePatientScopedUserContext(users, authUserId) {
    const currentUser = (users ?? []).find((user) => user.auth_id === authUserId);
    if (!currentUser) throw new Error('Current user profile not found');

    let patientUser = null;
    let fallbackRecipientId = null;

    if (currentUser.role === 'therapist') {
        const patients = users.filter((user) => user.therapist_id === currentUser.id);
        patientUser = patients[0] ?? null;
        fallbackRecipientId = patientUser?.id ?? null;
    } else {
        patientUser = currentUser;
        fallbackRecipientId = currentUser.therapist_id ?? null;
    }

    if (!patientUser) throw new Error('No patient context found');

    return {
        currentUser,
        patientUser,
        patientDisplayName: formatDisplayName(patientUser),
        fallbackRecipientId,
    };
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
