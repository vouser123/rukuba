// pages/index.js — Phase 4 tracker page (Strangler Fig: replaces public/index.html on cutover)
// 4a: shell + auth + data (Codex) | 4e: HistoryPanel + BottomNav (Claude) | 4g: offline queue (Claude)

import { useState, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { useIndexData } from '../hooks/useIndexData';
import { useIndexOfflineQueue } from '../hooks/useIndexOfflineQueue';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import HistoryPanel from '../components/HistoryPanel';
import BottomNav from '../components/BottomNav';
import styles from './index.module.css';

/**
 * Temporary placeholder for components not yet built (4b, 4c).
 * Removed when the real component is wired in.
 */
function Placeholder({ title, description }) {
    return (
        <section className={styles.panel} aria-label={title}>
            <h2 className={styles.panelTitle}>{title}</h2>
            <p className={styles.panelDescription}>{description}</p>
        </section>
    );
}

export default function IndexPage() {
    const { session, loading: authLoading, signIn } = useAuth();

    const userId = session?.user?.id ?? null;
    const token  = session?.access_token ?? null;

    const { exercises, programs, logs, loading, error, reload } = useIndexData(token, userId);
    const { pendingCount, enqueue, sync, clearQueue } = useIndexOfflineQueue(userId, token);

    // 'exercises' | 'history'
    const [activeTab, setActiveTab] = useState('exercises');

    /**
     * Currently open exercise (set by SessionLoggerModal in Phase 4c).
     * Drives the HistoryPanel exercise-filter (DN-014 behavior):
     *   null  → show all history
     *   { id, name } → show only that exercise's history
     */
    const [activeExercise, setActiveExercise] = useState(null);

    /**
     * Sign out — clear the offline queue first to prevent cross-user data leakage (DN-022 fix),
     * then end the Supabase session.
     */
    const handleSignOut = useCallback(async () => {
        clearQueue();
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signOut();
    }, [clearQueue]);

    if (authLoading) return null;

    if (!session) {
        return <AuthForm title="PT Tracker Sign In" onSignIn={signIn} />;
    }

    return (
        <>
            <Head>
                <title>PT Tracker</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
            </Head>

            <div className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.title}>PT Tracker</h1>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.refreshButton}
                            onPointerUp={reload}
                            disabled={loading}
                            aria-label="Refresh tracker data"
                        >
                            {loading ? 'Loading…' : 'Refresh'}
                        </button>
                        <NavMenu
                            user={session.user}
                            isAdmin={true}
                            onSignOut={handleSignOut}
                            currentPage="index"
                            actions={[
                                { action: 'manual-sync', label: 'Sync now' },
                            ]}
                            onAction={(action) => {
                                if (action === 'manual-sync') { sync(); return true; }
                                return false;
                            }}
                        />
                    </div>
                </header>

                {error && (
                    <div className={styles.errorBanner} role="alert">{error}</div>
                )}

                <main className={styles.main}>
                    {/* ── Exercises tab ── */}
                    {activeTab === 'exercises' && (
                        <>
                            {/* Phase 4b: ExercisePicker */}
                            <Placeholder
                                title="ExercisePicker"
                                description="DN-047 — exercise list/search/select, adherence badges, dosage summary, sort controls."
                            />
                            {/* Phase 4c: SessionLoggerModal */}
                            <Placeholder
                                title="SessionLoggerModal"
                                description="DN-048 — logging modal (sets/reps/side/form_data), timer, speech."
                            />
                        </>
                    )}

                    {/* ── History tab (DN-014 filter behavior) ── */}
                    {activeTab === 'history' && (
                        <HistoryPanel
                            logs={logs}
                            activeExerciseId={activeExercise?.id ?? null}
                            activeExerciseName={activeExercise?.name ?? null}
                            onClearFilter={() => setActiveExercise(null)}
                        />
                    )}
                </main>

                {/* ── Bottom navigation ── */}
                <BottomNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    pendingSync={pendingCount}
                />
            </div>
        </>
    );
}
