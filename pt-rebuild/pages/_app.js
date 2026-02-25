/**
 * Custom App component for Next.js Pages Router.
 * Minimal pass-through — wraps all pages.
 * Add global providers here as the migration progresses.
 */
export default function App({ Component, pageProps }) {
    return <Component {...pageProps} />;
}
