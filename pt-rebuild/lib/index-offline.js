/**
 * index-offline.js — pure helpers for the offline session queue.
 *
 * Queue is stored in localStorage under a user-scoped key to prevent
 * cross-account data carryover on shared devices (addresses DN-022 concern).
 *
 * No React, no side effects. Callers manage state; these are pure read/write helpers.
 */

/** @param {string} userId - Supabase user ID */
export function queueKey(userId) {
    return `pt_offline_queue_${userId}`;
}

/**
 * Load the offline queue from localStorage.
 * @param {string} userId
 * @returns {Array} queue (empty array if nothing stored or parse fails)
 */
export function loadQueue(userId) {
    try {
        const raw = localStorage.getItem(queueKey(userId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Persist the offline queue to localStorage.
 * @param {string} userId
 * @param {Array}  queue
 */
export function saveQueue(userId, queue) {
    localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

/**
 * Clear the offline queue (called on sign-out to prevent cross-user leakage).
 * @param {string} userId
 */
export function clearQueue(userId) {
    localStorage.removeItem(queueKey(userId));
}

/**
 * Remove a single session from the queue by its client_mutation_id.
 * Returns the new queue (caller is responsible for persisting with saveQueue).
 *
 * @param {Array}  queue
 * @param {string} clientMutationId
 * @returns {Array}
 */
export function removeFromQueue(queue, clientMutationId) {
    return queue.filter(s => s.client_mutation_id !== clientMutationId);
}

/**
 * Build the API payload for a queued session.
 * Transforms internal session format → /api/logs POST body.
 *
 * @param {object} session - Queued session object
 * @returns {object} API-ready payload
 */
export function buildApiPayload(session) {
    return {
        exercise_id:        session.exercise_id ?? null,
        exercise_name:      session.exercise_name,
        activity_type:      session.activity_type,
        notes:              session.notes ?? null,
        performed_at:       session.performed_at,
        client_mutation_id: session.client_mutation_id,
        sets: (session.sets ?? []).map(set => ({
            set_number:    set.set_number,
            reps:          set.reps ?? null,
            seconds:       set.seconds ?? null,
            distance_feet: set.distance_feet ?? null,
            side:          set.side ?? null,
            form_data:     set.form_data ?? null,
            manual_log:    set.manual_log ?? false,
            partial_rep:   set.partial_rep ?? false,
            performed_at:  set.performed_at ?? session.performed_at,
        })),
    };
}
