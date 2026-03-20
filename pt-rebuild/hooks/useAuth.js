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

export function useAuth() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an existing session on mount (handles page reload + return from OAuth).
        // Supabase auth persistence is backed by the shared IndexedDB storage adapter.
        supabase.auth.getSession().then(({ data: { session: sess } }) => {
            setSession(sess);
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
