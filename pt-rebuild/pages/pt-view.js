/**
 * pt-view.js — Rehab History Dashboard (Phase 2 migration of pt_view.html).
 *
 * Architecture:
 *   Data bootstrap → hooks/usePtViewData.js
 *   Data helpers   → lib/pt-view.js (pure functions)
 *   Auth           → hooks/useAuth.js
 *   Messages       → hooks/useMessages.js + components/MessagesModal.js
 *   Exercise modal → components/ExerciseHistoryModal.js
 *   Styles         → pt-view.module.css
 */
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserContext } from '../hooks/useUserContext';
import { useMessages } from '../hooks/useMessages';
import NavMenu from '../components/NavMenu';
import AuthForm from '../components/AuthForm';
import MessagesModal from '../components/MessagesModal';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import PatientNotes from '../components/PatientNotes';
import HistoryList from '../components/HistoryList';
import NativeSelect from '../components/NativeSelect';
import { usePtViewData } from '../hooks/usePtViewData';
import {
    groupLogsByDate, findNeedsAttention, needsAttentionUrgency,
    computeSummaryStats, detectKeywords, applyFilters,
} from '../lib/pt-view';
import { patchEmailNotifications } from '../lib/users';
import { offlineCache } from '../lib/offline-cache';
import styles from './pt-view.module.css';

// ── Local sub-components ────────────────────────────────────────────────────

/** Overdue exercise cards — tap to open exercise history modal. */
function NeedsAttention({ items, onCardClick }) {
    if (items.length === 0) return null;
    const urgencyColor = { red: '#dc3545', orange: '#ff5722', yellow: '#ff9800' };

    return (
        <div className={styles.section}>
            <div className={styles['section-title']}>⚠️ Needs Attention</div>
            <div className={styles['top-exercises-grid']}>
                {items.map(item => (
                    <div
                        key={item.exerciseId}
                        className={styles['exercise-card']}
                        onPointerUp={() => onCardClick(item.exerciseId, item.exerciseName)}
                        style={{ borderLeft: `4px solid ${urgencyColor[needsAttentionUrgency(item)]}` }}
                    >
                        <div className={styles['exercise-card-title']}>{item.exerciseName}</div>
                        <div className={styles['exercise-card-meta']}>
                            {item.neverDone ? 'Never performed' : `${item.daysSince} days ago`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Three summary stat chips. */
function SummaryStats({ stats }) {
    return (
        <div className={styles['summary-section']}>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.daysActive}</span>
                <span className={styles['summary-label']}>Days active</span>
            </div>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.exercisesCovered}</span>
                <span className={styles['summary-label']}>Exercises covered</span>
            </div>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.totalSessions}</span>
                <span className={styles['summary-label']}>Total sessions</span>
            </div>
        </div>
    );
}

/** Collapsible filter controls. */
function FiltersPanel({ filters, programs, expanded, onToggle, onChange }) {
    return (
        <div className={styles['filters-section']}>
            <div className={styles['filters-toggle']} onPointerUp={onToggle}>
                {expanded ? '▲ Hide filters' : '▼ Show filters'}
            </div>
            {expanded && (
                <div className={styles['filters-content']}>
                    <div className={styles['filter-group']}>
                        <label>Exercise</label>
                        <NativeSelect
                            value={filters.exercise}
                            onChange={(value) => onChange({ ...filters, exercise: value })}
                            placeholder="All exercises"
                            options={programs.map((p) => ({
                                value: p.exercise_id,
                                label: p.exercise_name,
                            }))}
                        />
                    </div>
                    <div className={styles['filter-group']}>
                        <label>Date range</label>
                        <div className={styles['date-range']}>
                            <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })} />
                            <input type="date" value={filters.dateTo}   onChange={e => onChange({ ...filters, dateTo:   e.target.value })} />
                        </div>
                    </div>
                    <div className={styles['filter-group']}>
                        <label>Search</label>
                        <input type="text" placeholder="Exercise name or notes…" value={filters.query}
                            onChange={e => onChange({ ...filters, query: e.target.value })} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Page ────────────────────────────────────────────────────────────────────

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

    // UI state
    const [filters, setFilters] = useState({ exercise: '', dateFrom: '', dateTo: '', query: '' });
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [notesCollapsed, setNotesCollapsed] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [dismissedNotes, setDismissedNotes] = useState([]);
    const [uiStateLoaded, setUiStateLoaded] = useState(false);

    // Modal state
    const [messagesOpen, setMessagesOpen] = useState(false);
    const [historyTarget, setHistoryTarget] = useState(null); // { name, logs }

    useEffect(() => {
        let cancelled = false;

        async function loadUiState() {
            try {
                await offlineCache.init();
                const [nextNotesCollapsed, nextFiltersExpanded, nextDismissedNotes] = await Promise.all([
                    offlineCache.getUiState('pt_view_notes_collapsed', false),
                    offlineCache.getUiState('pt_view_filters_expanded', false),
                    offlineCache.getUiState('pt_view_dismissed_notes', []),
                ]);
                if (cancelled) return;
                setNotesCollapsed(Boolean(nextNotesCollapsed));
                setFiltersExpanded(Boolean(nextFiltersExpanded));
                setDismissedNotes(Array.isArray(nextDismissedNotes) ? nextDismissedNotes : []);
                setUiStateLoaded(true);
            } catch {
                // Keep default UI state if IndexedDB is unavailable.
                if (!cancelled) setUiStateLoaded(true);
            }
        }

        loadUiState();

        return () => {
            cancelled = true;
        };
    }, []);

    // Derived data
    const filteredLogs    = applyFilters(logs, filters);
    const dateGroups      = groupLogsByDate(filteredLogs);
    const needsAttention  = findNeedsAttention(logs, programs);
    const stats           = computeSummaryStats(logs);

    // Pre-process notes for PatientNotes component (components cannot import from lib/)
    const processedNotes  = logs
        .filter(l => l.notes && !dismissedNotes.includes(l.id))
        .slice(0, 10)
        .map(log => {
            const keywords = detectKeywords(log.notes);
            const isConcerning = keywords.length > 0;
            // Highlight concerning words in the note text for dangerouslySetInnerHTML
            let displayText = log.notes;
            if (isConcerning) {
                keywords.forEach(word => {
                    displayText = displayText.replace(
                        new RegExp(`(${word})`, 'gi'),
                        `<span class="concerning-word">$1</span>`
                    );
                });
            }
            return { ...log, isConcerning, displayText };
        });

    function dismissNote(logId) {
        const next = [...dismissedNotes, logId];
        setDismissedNotes(next);
        void offlineCache.setUiState('pt_view_dismissed_notes', next);
    }

    function toggleNotesCollapsed() {
        const next = !notesCollapsed;
        setNotesCollapsed(next);
        void offlineCache.setUiState('pt_view_notes_collapsed', next);
    }

    function toggleFilters() {
        const next = !filtersExpanded;
        setFiltersExpanded(next);
        void offlineCache.setUiState('pt_view_filters_expanded', next);
    }

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
        return <AuthForm title="Rehab History Sign In" onSignIn={signIn} />;
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

            {dataError && (
                <p style={{ color: 'red', padding: '1rem' }}>Error loading data: {dataError}</p>
            )}
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

            <NeedsAttention items={needsAttention} onCardClick={openExerciseHistory} />

            <SummaryStats stats={stats} />

            {uiStateLoaded ? (
                <FiltersPanel
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
