import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

/**
 * Reset password page — handles Supabase recovery tokens delivered via email link.
 *
 * Flow:
 * 1. User clicks recovery link → lands here with #type=recovery&access_token=... in URL hash
 * 2. Supabase client (detectSessionInUrl: true) auto-processes the hash on module init,
 *    establishes a session, and fires the PASSWORD_RECOVERY auth event.
 * 3. We subscribe to that event via onAuthStateChange AND call getSession() to cover
 *    the case where the event fired before the subscription was set up (e.g. page refresh).
 * 4. On valid session: show password form.
 * 5. On success: updateUser({ password }), sign out, show confirmation.
 * 6. Redirect target is / (Next.js tracker root), not /index.html (legacy static shell).
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
     * getSession() would return true for any logged-in user, causing false positives.
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

      <div style={pageStyles.page}>
        <div style={pageStyles.card}>

          {view === 'loading' && (
            <p style={pageStyles.center}>Verifying reset link…</p>
          )}

          {view === 'invalid' && (
            <div style={pageStyles.center}>
              <h2>Invalid or expired link</h2>
              <p>This password reset link is no longer valid.</p>
              <p>Please request a new one from the sign-in page.</p>
            </div>
          )}

          {view === 'form' && (
            <>
              <h2 style={pageStyles.heading}>Set New Password</h2>
              <form onSubmit={handleSubmit}>
                <div style={pageStyles.field}>
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
                    style={pageStyles.input}
                  />
                </div>
                <div style={pageStyles.field}>
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
                    style={pageStyles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...pageStyles.button,
                    ...(submitting ? pageStyles.buttonDisabled : {}),
                  }}
                >
                  {submitting ? 'Updating…' : 'Update Password'}
                </button>
                {error && <p style={pageStyles.error}>{error}</p>}
              </form>
            </>
          )}

          {view === 'success' && (
            <div style={pageStyles.center}>
              <h2>Password Updated</h2>
              <p>Your password has been changed successfully.</p>
              <p>
                <a href="/" style={pageStyles.link}>Go to PT Tracker</a>
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/** Inline styles — isolated auth page, no shared layout needed */
const pageStyles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    margin: 0,
    padding: 0,
    background: '#f5f5f5',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: 'white',
    padding: '2rem',
    borderRadius: '8px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  heading: {
    margin: '0 0 1.5rem 0',
    color: '#333',
  },
  field: {
    marginBottom: '1rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'default',
  },
  error: {
    color: '#d32f2f',
    marginTop: '1rem',
    fontSize: '14px',
  },
  center: {
    textAlign: 'center',
    padding: '2rem 0',
  },
  link: {
    color: '#007bff',
  },
};
