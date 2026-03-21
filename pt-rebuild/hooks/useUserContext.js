/**
 * hooks/useUserContext.js — Shared user identity and messaging context hook.
 *
 * Single source of truth for all user identity fields needed by MessagesModal
 * and any future page that adds messaging. Eliminates per-page duplication of
 * the fetchUsers → resolvePatientScopedUserContext → derive-names pattern.
 *
 * Returns:
 *   profileId        {string|null}  — users table PK (for sender_id comparison in messages)
 *   patientId        {string|null}  — patient's profile id (for fetching logs/programs)
 *   recipientId      {string|null}  — messaging recipient's profile id
 *   userRole         {string}       — 'patient' | 'therapist'
 *   emailEnabled     {boolean}      — email notification preference (initial server value)
 *   viewerName       {string}       — current user's first name (for message sender labels)
 *   otherName        {string}       — other participant's first name
 *   otherIsTherapist {boolean}      — whether the other participant is the therapist
 *   loading          {boolean}      — true until first fetch resolves
 *   error            {string|null}  — error message if fetch failed
 */
import { useState, useEffect } from 'react';
import { fetchUsers, resolvePatientScopedUserContext } from '../lib/users';
import { offlineCache } from '../lib/offline-cache';

/** @returns {ReturnType<typeof getDefaultState>} */
function getDefaultState() {
    return {
        profileId: null,
        patientId: null,
        recipientId: null,
        userRole: 'patient',
        emailEnabled: true,
        viewerName: '',
        otherName: '',
        otherIsTherapist: false,
        loading: true,
        error: null,
    };
}

/**
 * Derive all user context fields from the fetched users array and session.
 * @param {Array} users
 * @param {string} authUserId — session.user.id (Supabase auth UUID)
 * @returns {object}
 */
function deriveContext(users, authUserId) {
    const { currentUser, patientUser, fallbackRecipientId } = resolvePatientScopedUserContext(
        users,
        authUserId
    );

    // Resolve the other messaging participant
    let otherUser = null;
    if (currentUser.role === 'therapist') {
        // Therapist's other participant is their patient
        otherUser = users.find((u) => u.therapist_id === currentUser.id) ?? null;
    } else {
        // Patient's other participant is their therapist
        otherUser = users.find((u) => u.id === currentUser.therapist_id) ?? null;
    }

    return {
        profileId: currentUser.id,
        patientId: patientUser.id,
        recipientId: fallbackRecipientId,
        userRole: currentUser.role ?? 'patient',
        emailEnabled: currentUser.email_notifications_enabled ?? true,
        viewerName: currentUser.first_name || '',
        otherName: otherUser?.first_name || '',
        otherIsTherapist: otherUser?.role === 'therapist',
        loading: false,
        error: null,
    };
}

/**
 * @param {import('@supabase/supabase-js').Session|null} session
 * @returns {ReturnType<typeof getDefaultState>}
 */
export function useUserContext(session) {
    const [state, setState] = useState(getDefaultState);

    useEffect(() => {
        if (!session) {
            // Clear user cache on sign-out so stale data doesn't persist across accounts.
            void offlineCache.init()
                .then(() => offlineCache.clearStore('users'))
                .catch((err) => console.error('useUserContext cache clear failed:', err));
            setState({ ...getDefaultState(), loading: false });
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                await offlineCache.init();
                const users = await fetchUsers(session.access_token);

                // Cache users for offline fallback (consumed by usePtViewData offline path)
                await offlineCache.cacheUsers(users);

                if (cancelled) return;
                setState(deriveContext(users, session.user.id));
            } catch (err) {
                if (cancelled) return;

                // Try offline cache fallback
                try {
                    const cached = await offlineCache.getCachedUsers();
                    if (cached.length) {
                        setState(deriveContext(cached, session.user.id));
                        return;
                    }
                } catch {
                    // Cache also failed — fall through to error state
                }

                setState((prev) => ({ ...prev, loading: false, error: err.message }));
            }
        }

        void load();
        return () => { cancelled = true; };
    }, [session]);

    return state;
}
