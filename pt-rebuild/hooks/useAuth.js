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

// Supabase stores the session under this localStorage key
const SUPABASE_SESSION_KEY = 'sb-zvgoaxdpkgfxklotqwpz-auth-token';

/**
 * Read a stored Supabase session from localStorage.
 * Used as an offline fallback when getSession() can't reach the network.
 * @returns {object|null}
 */
function getStoredSession() {
    try {
        const raw = typeof window !== 'undefined' && localStorage.getItem(SUPABASE_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function useAuth() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an existing session on mount (handles page reload + return from OAuth).
        // If offline and getSession() returns null, fall back to the stored session so the
        // app stays usable without a network connection.
        supabase.auth.getSession().then(({ data: { session: sess } }) => {
            if (!sess && typeof navigator !== 'undefined' && !navigator.onLine) {
                setSession(getStoredSession());
            } else {
                setSession(sess);
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
        return error ? error.message : null;
    }

    /** Sign out the current user. */
    async function signOut() {
        await supabase.auth.signOut();
    }

    return { session, loading, signIn, signOut };
}
