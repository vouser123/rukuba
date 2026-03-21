/**
 * pt-view.js — Rehab History Dashboard (Phase 2 migration of pt_view.html).
 *
 * Architecture:
 *   Data bootstrap → hooks/usePtViewData.js
 *   Page UI state  → hooks/usePtViewUiState.js
 *   Data helpers   → lib/pt-view.js (pure functions)
 *   Auth           → hooks/useAuth.js
 *   Messages       → hooks/useMessages.js + components/MessagesModal.js
 *   Exercise modal → components/ExerciseHistoryModal.js
 *   Page panels    → components/PtView*.js
 *   Styles         → pt-view.module.css
 */
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserContext } from '../hooks/useUserContext';
import { useMessages } from '../hooks/useMessages';
import NavMenu from '../components/NavMenu';
import AuthForm from '../components/AuthForm';
import MessagesModal from '../components/MessagesModal';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import PatientNotes from '../components/PatientNotes';
import HistoryList from '../components/HistoryList';
import PtViewNeedsAttention from '../components/PtViewNeedsAttention';
import PtViewSummaryStats from '../components/PtViewSummaryStats';
import PtViewFiltersPanel from '../components/PtViewFiltersPanel';
import { usePtViewData } from '../hooks/usePtViewData';
import { usePtViewUiState } from '../hooks/usePtViewUiState';
import {
    groupLogsByDate, findNeedsAttention, needsAttentionUrgency,
    computeSummaryStats, applyFilters,
} from '../lib/pt-view';
import { patchEmailNotifications } from '../lib/users';
import styles from './pt-view.module.css';

export default function PtViewPage() {
    const { session, loading: authLoading, signIn, signOut } = useAuth();

    // User identity and messaging context — shared hook, reusable on any page.
    const userCtx = useUserContext(session);

    // Logs and programs for this patient — waits for patientId from userCtx.
    const { logs, programs, dataError, offlineNotice } = usePtViewData({
        token: session?.access_token ?? null,
        patientId: userCtx.patientId,
    });

    // Local emailEnabled state — initialized from server value once userCtx loads.
    // Kept local so the toggle can optimistically update without re-fetching users.
    const [emailEnabled, setEmailEnabled] = useState(true);
    useEffect(() => {
        if (!userCtx.loading) setEmailEnabled(userCtx.emailEnabled);
    }, [userCtx.emailEnabled, userCtx.loading]);

    // Messages compare against sender_id / recipient_id, which use users.id profile values.
    const msgs = useMessages(session?.access_token ?? null, userCtx.profileId);

    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const {
        filters,
        setFilters,
        notesCollapsed,
        filtersExpanded,
        uiStateLoaded,
        processedNotes,
        dismissNote,
        toggleNotesCollapsed,
        toggleFilters,
    } = usePtViewUiState(logs);

    // Modal state
    const [messagesOpen, setMessagesOpen] = useState(false);
    const [historyTarget, setHistoryTarget] = useState(null); // { name, logs }

    // Derived data
    const filteredLogs    = applyFilters(logs, filters);
    const dateGroups      = groupLogsByDate(filteredLogs);
    const needsAttention  = useMemo(() => {
        const urgencyColor = { red: '#dc3545', orange: '#ff5722', yellow: '#ff9800' };
        return findNeedsAttention(logs, programs).map((item) => ({
            ...item,
            urgencyColor: urgencyColor[needsAttentionUrgency(item)],
        }));
    }, [logs, programs]);
    const stats           = computeSummaryStats(logs);

    function toggleSession(id) {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function openExerciseHistory(exerciseId, exerciseName) {
        const exerciseLogs = logs.filter(l => l.exercise_id === exerciseId);
        setHistoryTarget({ name: exerciseName, logs: exerciseLogs });
    }

    async function handleEmailToggle(enabled) {
        setEmailEnabled(enabled); // optimistic update
        try {
            await patchEmailNotifications(session.access_token, enabled);
        } catch {
            setEmailEnabled(!enabled); // revert on API error
        }
    }

    // ── Render ──

    if (authLoading) return null;

    if (!session) {
        return <AuthForm onSignIn={signIn} />;
    }

    return (
        <>
            <Head>
                <title>Rehab History</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
                <link rel="apple-touch-icon" href="/icons/icon.svg" />
            </Head>

            <div className={styles.header}>
                <h1>Rehab History</h1>
                <div className={styles['header-actions']}>
                    {/* Messages button with badge */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className={`${styles.btn} ${styles['messages-header-btn']}`}
                            onPointerUp={() => { setMessagesOpen(true); msgs.markModalOpened(); }}
                        >
                            ✉️
                            {msgs.unreadCount > 0 && (
                                <span className={styles['messages-header-badge']}>{msgs.unreadCount}</span>
                            )}
                        </button>
                    </div>
                    <NavMenu
                        user={session.user}
                        isAdmin={userCtx.userRole !== 'patient'}
                        onSignOut={signOut}
                        currentPage="pt_view"
                        actions={[]}
                        onAction={() => {}}
                    />
                </div>
            </div>

            {dataError && <p style={{ color: 'red', padding: '1rem' }}>Error loading data: {dataError}</p>}
            {offlineNotice && (
                <p className={styles['offline-notice']}>{offlineNotice}</p>
            )}

            {uiStateLoaded ? (
                <PatientNotes
                    notes={processedNotes}
                    collapsed={notesCollapsed}
                    onToggle={toggleNotesCollapsed}
                    onDismiss={dismissNote}
                />
            ) : (
                <div className={styles['ui-state-placeholder']} />
            )}

            <PtViewNeedsAttention items={needsAttention} onCardClick={openExerciseHistory} />

            <PtViewSummaryStats stats={stats} />

            {uiStateLoaded ? (
                <PtViewFiltersPanel
                    filters={filters}
                    programs={programs}
                    expanded={filtersExpanded}
                    onToggle={toggleFilters}
                    onChange={setFilters}
                />
            ) : (
                <div className={styles['ui-state-placeholder']} />
            )}

            <HistoryList
                groups={dateGroups}
                expandedSessions={expandedSessions}
                onToggleSession={toggleSession}
                onExerciseClick={openExerciseHistory}
            />

            <MessagesModal
                isOpen={messagesOpen}
                onClose={() => setMessagesOpen(false)}
                messages={msgs.messages}
                viewerId={userCtx.profileId}
                viewerName={userCtx.viewerName}
                otherName={userCtx.otherName}
                otherIsTherapist={userCtx.otherIsTherapist}
                recipientId={userCtx.recipientId}
                emailEnabled={emailEnabled}
                onSend={msgs.send}
                onArchive={msgs.archive}
                onUnarchive={msgs.unarchive}
                onRemove={msgs.remove}
                onMarkRead={msgs.markRead}
                onEmailToggle={handleEmailToggle}
                onOpened={msgs.markModalOpened}
            />

            {historyTarget && (
                <ExerciseHistoryModal
                    isOpen={true}
                    onClose={() => setHistoryTarget(null)}
                    exerciseName={historyTarget.name}
                    logs={historyTarget.logs}
                />
            )}
        </>
    );
}
