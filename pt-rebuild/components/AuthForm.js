/**
 * AuthForm — shared sign-in form component.
 *
 * Manages its own email/password state and loading state.
 * Delegates actual authentication to the onSignIn callback.
 * Every Next.js page that requires auth uses this instead of inline auth forms.
 *
 * Also handles the forgot-password flow inline:
 * - "Forgot password?" link → email form → sends Supabase recovery email
 * - redirectTo is set to /reset-password on the current origin so the link
 *   works correctly on both preview and production domains.
 *
 * Usage:
 *   <AuthForm
 *     title="Sign In"
 *     onSignIn={signIn}   // from useAuth()
 *   />
 *
 * @param {{
 *   title?: string,       Heading text (default: 'Sign In')
 *   onSignIn: function,   (email, password) => Promise<string|null> — error message or null
 * }} props
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import styles from './AuthForm.module.css';

export default function AuthForm({ title = 'Sign In', onSignIn }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    /** 'signin' | 'forgot' | 'sent' */
    const [view, setView] = useState('signin');

    useEffect(() => {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') return undefined;

        const syncOnlineState = () => setIsOffline(navigator.onLine === false);
        syncOnlineState();
        window.addEventListener('online', syncOnlineState);
        window.addEventListener('offline', syncOnlineState);

        return () => {
            window.removeEventListener('online', syncOnlineState);
            window.removeEventListener('offline', syncOnlineState);
        };
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        const errMsg = await onSignIn(email, password);
        if (errMsg) setError(errMsg);
        setSubmitting(false);
    }

    /** Send Supabase password recovery email. redirectTo uses current origin so it works on preview and production. */
    async function handleForgotSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const redirectTo = `${window.location.origin}/reset-password`;
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (resetError) throw resetError;
            setView('sent');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    function backToSignIn() {
        setView('signin');
        setError('');
    }

    return (
        <div className={styles['auth-modal']}>
            <div className={styles['auth-content']}>

                {view === 'signin' && (
                    <>
                        <h2>{title}</h2>
                        {isOffline && (
                            <p className={styles['auth-hint']}>
                                Signing in needs internet access. If this device already has a saved session, reopening the app while offline may restore it automatically.
                            </p>
                        )}
                        <form onSubmit={handleSubmit} className={styles['auth-form']}>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                autoComplete="email"
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                autoComplete="current-password"
                            />
                            <button type="submit" disabled={submitting}>
                                {submitting ? 'Signing in…' : 'Sign In'}
                            </button>
                            {error && <div className={styles['auth-error']}>{error}</div>}
                        </form>
                        <button
                            type="button"
                            className={styles['auth-link']}
                            onPointerUp={() => { setView('forgot'); setError(''); }}
                        >
                            Forgot password?
                        </button>
                    </>
                )}

                {view === 'forgot' && (
                    <>
                        <h2>Reset Password</h2>
                        <p className={styles['auth-hint']}>
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <form onSubmit={handleForgotSubmit} className={styles['auth-form']}>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                autoComplete="email"
                            />
                            <button type="submit" disabled={submitting || isOffline}>
                                {submitting ? 'Sending…' : 'Send Reset Email'}
                            </button>
                            {error && <div className={styles['auth-error']}>{error}</div>}
                        </form>
                        <button
                            type="button"
                            className={styles['auth-link']}
                            onPointerUp={backToSignIn}
                        >
                            Back to sign in
                        </button>
                    </>
                )}

                {view === 'sent' && (
                    <>
                        <h2>Check Your Email</h2>
                        <p className={styles['auth-hint']}>
                            A password reset link has been sent to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
                        </p>
                        <button
                            type="button"
                            className={styles['auth-form-button']}
                            onPointerUp={backToSignIn}
                        >
                            Back to Sign In
                        </button>
                    </>
                )}

            </div>
        </div>
    );
}
