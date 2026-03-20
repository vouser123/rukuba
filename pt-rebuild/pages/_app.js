/**
 * Custom App component for Next.js Pages Router.
 * Minimal pass-through — wraps all pages.
 * Add global providers here as the migration progresses.
 */
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    }, []);

    return <Component {...pageProps} />;
}
