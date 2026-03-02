/**
 * useIndexOfflineQueue — manages the offline session queue for the index page.
 *
 * Queue is stored under a user-scoped localStorage key (pt_offline_queue_${userId})
 * to prevent cross-account data carryover on shared devices (DN-022 fix).
 *
 * Responsibilities:
 *  - Load queue on mount
 *  - Enqueue new sessions when logging offline
 *  - Sync queue to /api/logs on demand or when coming back online
 *  - Expose clearQueue for sign-out (prevents cross-user leakage)
 *
 * @param {string|null} userId      - Supabase user ID (null when not signed in)
 * @param {string|null} accessToken - Supabase access token for authenticated API calls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    loadQueue,
    saveQueue,
    clearQueue as clearQueueHelper,
    removeFromQueue,
    buildApiPayload,
} from '../lib/index-offline';

export function useIndexOfflineQueue(userId, accessToken) {
    const [queue, setQueue] = useState([]);
    const [syncing, setSyncing] = useState(false);

    // Ref so sync callback always sees the latest queue without re-registering
    const queueRef = useRef(queue);
    useEffect(() => { queueRef.current = queue; }, [queue]);

    // Load queue from localStorage when userId becomes available
    useEffect(() => {
        if (!userId) return;
        const stored = loadQueue(userId);
        setQueue(stored);
    }, [userId]);

    /**
     * Add a session to the offline queue and persist immediately.
     * Called from useSessionLogging when a POST fails or device is offline.
     *
     * @param {object} session - Session object with client_mutation_id, exercise_id,
     *                           exercise_name, activity_type, performed_at, sets[]
     */
    const enqueue = useCallback((session) => {
        if (!userId) return;
        setQueue(prev => {
            const next = [...prev, session];
            saveQueue(userId, next);
            return next;
        });
    }, [userId]);

    /**
     * Attempt to sync all queued sessions to /api/logs.
     * Each session is POSTed individually. On success (200 or 409 duplicate),
     * it is removed from the queue. Failures stay queued for the next attempt.
     *
     * @returns {Promise<{ succeeded: number, failed: number }>}
     */
    const sync = useCallback(async () => {
        if (!userId || !accessToken || syncing) return { succeeded: 0, failed: 0 };

        const currentQueue = queueRef.current;
        if (currentQueue.length === 0) return { succeeded: 0, failed: 0 };

        setSyncing(true);
        let succeeded = 0;
        let failed = 0;

        for (const session of [...currentQueue]) {
            try {
                const res = await fetch('/api/logs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(buildApiPayload(session)),
                });

                // 200 success or 409 duplicate — either way, remove from queue
                if (res.ok || res.status === 409) {
                    setQueue(prev => {
                        const next = removeFromQueue(prev, session.client_mutation_id);
                        saveQueue(userId, next);
                        return next;
                    });
                    succeeded++;
                } else {
                    failed++;
                }
            } catch {
                // Network error — leave in queue for next attempt
                failed++;
            }
        }

        setSyncing(false);
        return { succeeded, failed };
    }, [userId, accessToken, syncing]);

    /**
     * Clear the queue entirely.
     * Must be called on sign-out to prevent cross-user data leakage.
     */
    const clearQueue = useCallback(() => {
        if (!userId) return;
        clearQueueHelper(userId);
        setQueue([]);
    }, [userId]);

    // Auto-sync when coming back online
    useEffect(() => {
        function handleOnline() {
            if (queueRef.current.length > 0) sync();
        }
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [sync]);

    return {
        queue,
        pendingCount: queue.length,
        syncing,
        enqueue,
        sync,
        clearQueue,
    };
}
