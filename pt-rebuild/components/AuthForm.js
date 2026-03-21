/**
 * AuthForm — shared sign-in form component.
 *
 * Manages its own email/password state and loading state.
 * Delegates actual authentication to the onSignIn callback.
 * Every Next.js page that requires auth uses this instead of inline auth forms.
 *
 * Usage:
 *   <AuthForm
 *     title="Coverage Analysis Sign In"
 *     onSignIn={signIn}   // from useAuth()
 *   />
 *
 * @param {{
 *   title?: string,       Heading text (default: 'Sign In')
 *   onSignIn: function,   (email, password) => Promise<string|null> — error message or null
 * }} props
 */
import { useEffect, useState } from 'react';
import styles from './AuthForm.module.css';

export default function AuthForm({ title = 'Sign In', onSignIn }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

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

    return (
        <div className={styles['auth-modal']}>
            <div className={styles['auth-content']}>
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
            </div>
        </div>
    );
}
