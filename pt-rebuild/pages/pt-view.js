/**
 * pt-view.js — Rehab History Dashboard (Phase 2 migration of pt_view.html).
 *
 * Architecture:
 *   Data fetching  → lib/pt-view.js (pure functions)
 *   Auth           → hooks/useAuth.js
 *   Messages       → hooks/useMessages.js + components/MessagesModal.js
 *   Exercise modal → components/ExerciseHistoryModal.js
 *   Styles         → pt-view.module.css
 */
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import NavMenu from '../components/NavMenu';
import AuthForm from '../components/AuthForm';
import MessagesModal from '../components/MessagesModal';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import PatientNotes from '../components/PatientNotes';
import HistoryList from '../components/HistoryList';
import {
    fetchLogs, fetchPrograms, fetchUsers, patchEmailNotifications,
    groupLogsByDate, findNeedsAttention, needsAttentionUrgency,
    computeSummaryStats, detectKeywords, applyFilters,
} from '../lib/pt-view';
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
                        <select value={filters.exercise} onChange={e => onChange({ ...filters, exercise: e.target.value })}>
                            <option value="">All exercises</option>
                            {programs.map(p => (
                                <option key={p.exercise_id} value={p.exercise_id}>{p.exercise_name}</option>
                            ))}
                        </select>
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

    // Data
    const [logs, setLogs]         = useState([]);
    const [programs, setPrograms] = useState([]);
    const [patientId, setPatientId]   = useState(null);
    const [recipientId, setRecipientId] = useState(null);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [userRole, setUserRole] = useState('patient');
    const [dataError, setDataError] = useState(null);
    // DB user id (users table `id`) — needed because messages use DB ids, not Supabase auth ids
    const [currentDbId, setCurrentDbId] = useState(null);

    // Messages via hook — viewerId is DB user id (set after data loads, null until then)
    const msgs = useMessages(session?.access_token ?? null, currentDbId);

    // UI state
    const [filters, setFilters] = useState({ exercise: '', dateFrom: '', dateTo: '', query: '' });
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [notesCollapsed, setNotesCollapsed] = useState(
        // typeof window guard: localStorage is not available during Next.js SSR
        () => typeof window !== 'undefined' && localStorage.getItem('notesCollapsed') === 'true'
    );
    const [filtersExpanded, setFiltersExpanded] = useState(
        () => typeof window !== 'undefined' && localStorage.getItem('filtersExpanded') === 'true'
    );
    const [dismissedNotes, setDismissedNotes] = useState(
        () => typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('dismissedNotes') ?? '[]') : []
    );

    // Modal state
    const [messagesOpen, setMessagesOpen] = useState(false);
    const [historyTarget, setHistoryTarget] = useState(null); // { name, logs }

    // Load all data after sign-in
    useEffect(() => {
        if (!session) return;
        const token = session.access_token;

        async function load() {
            try {
                const [usersData, logsData] = await Promise.all([
                    fetchUsers(token),
                    // We need patientId first — fetch users then logs
                ]);
                const currentUser = usersData.find(u => u.auth_id === session.user.id);
                // Patient = the user who has a therapist assigned (therapist_id non-null).
                // Roles in DB are 'admin' and 'therapist' — there is no 'patient' role.
                const patientUser = usersData.find(u => u.therapist_id !== null);
                if (!patientUser) throw new Error('No patient found');

                const pid = patientUser.id;
                setPatientId(pid);
                setCurrentDbId(currentUser?.id ?? null); // DB user id for message sender comparisons
                setUserRole(currentUser?.role ?? 'patient');
                setEmailEnabled(currentUser?.email_notifications_enabled ?? true);

                // Recipient = the other party — use DB user `id` (messages use DB ids, not auth_id)
                const otherUser = usersData.find(u => u.auth_id !== session.user.id);
                setRecipientId(otherUser?.id ?? null);

                const [logsArr, programsArr] = await Promise.all([
                    fetchLogs(token, pid),
                    fetchPrograms(token, pid),
                ]);
                setLogs(logsArr);
                setPrograms(programsArr.filter(p => !p.exercises?.archived));
            } catch (err) {
                console.error('pt-view load:', err);
                setDataError(err.message);
            }
        }
        load();
    }, [session]);

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
        localStorage.setItem('dismissedNotes', JSON.stringify(next));
    }

    function toggleNotesCollapsed() {
        const next = !notesCollapsed;
        setNotesCollapsed(next);
        localStorage.setItem('notesCollapsed', String(next));
    }

    function toggleFilters() {
        const next = !filtersExpanded;
        setFiltersExpanded(next);
        localStorage.setItem('filtersExpanded', String(next));
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
        setEmailEnabled(enabled);
        try {
            await patchEmailNotifications(session.access_token, enabled);
        } catch (err) {
            console.error('emailToggle:', err);
            setEmailEnabled(!enabled); // revert on error
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
                        isAdmin={userRole !== 'patient'}
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

            <PatientNotes
                notes={processedNotes}
                collapsed={notesCollapsed}
                onToggle={toggleNotesCollapsed}
                onDismiss={dismissNote}
            />

            <NeedsAttention items={needsAttention} onCardClick={openExerciseHistory} />

            <SummaryStats stats={stats} />

            <FiltersPanel
                filters={filters}
                programs={programs}
                expanded={filtersExpanded}
                onToggle={toggleFilters}
                onChange={setFilters}
            />

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
                viewerId={currentDbId}
                recipientId={recipientId}
                emailEnabled={emailEnabled}
                onSend={msgs.send}
                onArchive={msgs.archive}
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
