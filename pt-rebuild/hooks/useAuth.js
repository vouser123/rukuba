/**
 * useAuth — shared authentication hook for all Next.js pages.
 *
 * Handles session initialization, auth state changes, sign-in, and sign-out.
 * Every page that requires auth uses this hook instead of calling Supabase directly.
 *
 * Usage:
 *   const { session, loading, signIn, signOut } = useAuth();
 *
 * @returns {{
 *   session: object|null,   Supabase session (has .user and .access_token)
 *   loading: boolean,       true until the initial session check resolves
 *   signIn: function,       (email, password) => Promise<string|null> — error msg or null
 *   signOut: function,      () => Promise<void>
 * }}
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function isOfflineSignInError(error) {
    const message = String(error?.message ?? '').toLowerCase();
    return (
        typeof navigator !== 'undefined' && navigator.onLine === false
    ) || message.includes('failed to fetch')
        || message.includes('network request failed')
        || message.includes('networkerror')
        || message.includes('fetch failed');
}

export function useAuth() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an existing session on mount (handles page reload + return from OAuth).
        // Supabase auth persistence is backed by the shared IndexedDB storage adapter.
        //
        // getSession() trusts whatever is stored in IndexedDB without a server round-trip.
        // A stored session can be stale if the password was reset or the token was revoked
        // server-side. We validate with getUser() (network call) when a session exists to
        // catch this case — if validation fails, sign out to clear the stale session and
        // let the page fall through to AuthForm.
        supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
            if (sess) {
                const { error: userError } = await supabase.auth.getUser();
                if (userError) {
                    // Session is stored but token is invalid (revoked, password changed, etc.)
                    // Sign out to clear stale IndexedDB state and prompt re-login.
                    await supabase.auth.signOut();
                    setSession(null);
                } else {
                    setSession(sess);
                }
            } else {
                setSession(null);
            }
            setLoading(false);
        });

        // Keep session state in sync with Supabase auth events.
        // Only clear session on an explicit SIGNED_OUT event — not on transient null
        // values that can occur during token refresh cycles.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
            } else if (sess) {
                setSession(sess);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    /**
     * Sign in with email and password.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<string|null>} error message, or null on success
     */
    async function signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return null;

        if (isOfflineSignInError(error)) {
            return 'Signing in requires an internet connection. If you already signed in on this device before going offline, reopen the app and it should restore your saved session.';
        }

        return error.message;
    }

    /** Sign out the current user. */
    async function signOut() {
        await supabase.auth.signOut();
    }

    return { session, loading, signIn, signOut };
}
