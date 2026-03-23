/**
 * pages/pt-view.js — Rehab History Dashboard: exercise history, notes, messages.
 * Replaces public/pt_view.html (Phase 2 migration).
 *
 * ⚠️  ORCHESTRATOR ONLY — this file wires hooks and components together. Nothing else.
 * Before adding ANY code here, ask: "Is this pure wiring?"
 * If the answer is no → it belongs in a hook, component, or lib file, not this file.
 * Adding non-wiring code here is how fixed pages regress. See AGENTS.md Pre-Coding Layer Check.
 *
 * Wires:
 *   Auth           → hooks/useAuth.js
 *   User context   → hooks/useUserContext.js
 *   Data bootstrap → hooks/usePtViewData.js
 *   UI state       → hooks/usePtViewUiState.js
 *   Data helpers   → lib/pt-view.js (pure functions)
 *   Messages       → hooks/useMessages.js
 *   UI             → components/MessagesModal.js, components/ExerciseHistoryModal.js,
 *                    components/PtView*.js, components/NavMenu.js, components/AuthForm.js
 *   Styles         → pt-view.module.css
 */
import Head from 'next/head';
import { useMemo, useState } from 'react';
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
import { useEmailNotifications } from '../hooks/useEmailNotifications';
import {
    groupLogsByDate, findNeedsAttention, needsAttentionUrgency,
    computeSummaryStats, applyFilters,
} from '../lib/pt-view';
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

    // Email notification toggle — optimistic update with API revert on failure.
    const { emailEnabled, handleEmailToggle } = useEmailNotifications({
        token: session?.access_token ?? null,
        initialEnabled: userCtx.emailEnabled,
        loading: userCtx.loading,
    });

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
        return findNeedsAttention(logs, programs).map((item) => ({
            ...item,
            urgency: needsAttentionUrgency(item),
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
