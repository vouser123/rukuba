/**
 * pages/reset-password.js — Password reset: handles Supabase recovery tokens from email links.
 *
 * ⚠️  ORCHESTRATOR ONLY — this file wires hooks and components together. Nothing else.
 * Before adding ANY code here, ask: "Is this pure wiring?"
 * If the answer is no → it belongs in a hook, component, or lib file, not this file.
 * Adding non-wiring code here is how fixed pages regress. See AGENTS.md Pre-Coding Layer Check.
 *
 * Wires:
 *   Auth          → lib/supabase.js (direct — no auth hook needed; recovery token flow)
 *   Styles        → styles/reset-password.module.css
 */
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import styles from '../styles/reset-password.module.css';

/**
 * Reset password page — handles Supabase recovery tokens delivered via email link.
 *
 * Flow:
 * 1. User clicks recovery link → lands here with #type=recovery&access_token=... in URL hash
 * 2. Supabase client (detectSessionInUrl: true) auto-processes the hash on module init,
 *    establishes a session, and fires the PASSWORD_RECOVERY auth event.
 * 3. We only show the form on PASSWORD_RECOVERY — not on any generic active session,
 *    which would be a false positive for logged-in users visiting /reset-password directly.
 * 4. On success: updateUser({ password }), sign out, show confirmation.
 * 5. Redirect target is / (Next.js tracker root), not /index.html (legacy static shell).
 */
export default function ResetPassword() {
  /** 'loading' | 'form' | 'success' | 'invalid' */
  const [view, setView] = useState('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    /**
     * Only show the form on PASSWORD_RECOVERY event — not on a generic active session.
     * getSession() returns true for any logged-in user, causing false positives.
     * Recovery links are single-use: if the hash is gone (e.g. page refresh), show invalid.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('form');
      }
    });

    // If no PASSWORD_RECOVERY event arrives within 3s, the link is invalid/expired.
    const timeout = setTimeout(() => {
      setView((prev) => (prev === 'loading' ? 'invalid' : prev));
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  /** Handle password update form submission */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // Sign out so the user logs in fresh with the new password.
      await supabase.auth.signOut();
      setView('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password – PT Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest-tracker.json" />
        <link rel="icon" href="/icons/icon.svg" />
      </Head>

      <div className={styles.page}>
        <div className={styles.card}>

          {view === 'loading' && (
            <p className={styles.center}>Verifying reset link…</p>
          )}

          {view === 'invalid' && (
            <div className={styles.center}>
              <h2>Invalid or expired link</h2>
              <p>This password reset link is no longer valid.</p>
              <p>Please request a new one from the sign-in page.</p>
            </div>
          )}

          {view === 'form' && (
            <>
              <h2 className={styles.heading}>Set New Password</h2>
              <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={styles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.button}
                >
                  {submitting ? 'Updating…' : 'Update Password'}
                </button>
                {error && <p className={styles.error}>{error}</p>}
              </form>
            </>
          )}

          {view === 'success' && (
            <div className={styles.center}>
              <h2>Password Updated</h2>
              <p>Your password has been changed successfully.</p>
              <p><a href="/" className={styles.link}>Go to PT Tracker</a></p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
