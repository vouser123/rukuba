// pages/index.js — Phase 4 tracker page (Strangler Fig: replaces public/index.html on cutover)
// 4a: shell + auth + data (Codex) | 4e: HistoryPanel + BottomNav (Claude) | 4g: offline queue (Claude)

import { useMemo, useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { useIndexData } from '../hooks/useIndexData';
import { useIndexOfflineQueue } from '../hooks/useIndexOfflineQueue';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import HistoryPanel from '../components/HistoryPanel';
import BottomNav from '../components/BottomNav';
import ExercisePicker from '../components/ExercisePicker';
import NextSetConfirmModal from '../components/NextSetConfirmModal';
import SessionLoggerModal from '../components/SessionLoggerModal';
import SessionNotesModal from '../components/SessionNotesModal';
import TimerPanel from '../components/TimerPanel';
import { useSessionLogging } from '../hooks/useSessionLogging';
import { useLoggerFeedback } from '../hooks/useLoggerFeedback';
import { useMessages } from '../hooks/useMessages';
import MessagesModal from '../components/MessagesModal';
import { fetchUsers } from '../lib/users';
import { getAdherenceBadgeState } from '../lib/index-history';
import { buildOptimisticLogEntry, buildSessionProgress, createDraftSession, toLocalDateTimeInputValue } from '../lib/index-tracker-session';
import { buildDefaultFormDataForExercise, collectGlobalParameterValues } from '../lib/session-form-params';
import { getProgressComparison } from '../lib/logger-progress-comparison';
import { buildCreatePayload, createDefaultSet, inferActivityType, normalizeSet } from '../lib/session-logging';
import styles from './index.module.css';

function emptyManualLogState() {
    return { isOpen: false, exercise: null, sets: [], error: null };
}

export default function IndexPage() {
    const { session, loading: authLoading, signIn } = useAuth();

    const userId = session?.user?.id ?? null;
    const token = session?.access_token ?? null;

    const { exercises, programs, logs, loading, error, reload } = useIndexData(token, userId);
    const { pendingCount, enqueue, sync, clearQueue } = useIndexOfflineQueue(userId, token);

    const [activeTab, setActiveTab] = useState('exercises');
    const [sortMode, setSortMode] = useState('pt_order');
    const [selectedExerciseId, setSelectedExerciseId] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState(null);
    const [draftSession, setDraftSession] = useState(null);
    const [isTimerOpen, setIsTimerOpen] = useState(false);
    const [panelResetToken, setPanelResetToken] = useState(0);
    const [pendingSetPatch, setPendingSetPatch] = useState(null);
    const [manualLogState, setManualLogState] = useState(emptyManualLogState);
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [backdateEnabled, setBackdateEnabled] = useState(false);
    const [backdateValue, setBackdateValue] = useState('');
    const [pageMessage, setPageMessage] = useState('');
    const [optimisticLogs, setOptimisticLogs] = useState([]);
    const [activeExercise, setActiveExercise] = useState(null);
    const [isMessagesOpen, setIsMessagesOpen] = useState(false);
    const [recipientId, setRecipientId] = useState(null);
    const [emailEnabled, setEmailEnabled] = useState(true);
    // DB user id (users.id, not auth id) — needed for message sender comparisons
    const [currentDbId, setCurrentDbId] = useState(null);

    const sessionStartedAt = draftSession?.date ?? new Date().toISOString();

    const {
        successMessage,
        maybeAnnounceAllSetsComplete,
        showSaveSuccess,
        speakText,
    } = useLoggerFeedback(selectedExercise, sessionStartedAt);

    // Messages polling — currentDbId is null until user data loads; hook no-ops until set
    const msgs = useMessages(token, currentDbId);

    const allLogs = useMemo(() => [...optimisticLogs, ...logs], [logs, optimisticLogs]);

    const pickerExercises = useMemo(() => {
        if (programs.length > 0) {
            return programs
                .map((program) => {
                    const exercise = program.exercises || {};
                    return {
                        ...exercise,
                        id: exercise.id || program.exercise_id,
                        current_sets: program.current_sets ?? program.sets,
                        current_reps: program.current_reps ?? program.reps_per_set,
                        seconds_per_rep: program.seconds_per_rep ?? null,
                        seconds_per_set: program.seconds_per_set ?? null,
                        dosage_type: program.dosage_type ?? null,
                        distance_feet: program.distance_feet ?? null,
                    };
                })
                .filter((exercise) => Boolean(exercise.id));
        }
        return exercises;
    }, [exercises, programs]);

    const historicalFormParams = useMemo(() => collectGlobalParameterValues(allLogs), [allLogs]);

    const pickerPrograms = useMemo(() => {
        if (programs.length > 0) {
            return programs.map((program) => {
                const exerciseName = program?.exercises?.canonical_name ?? null;
                const adherence = getAdherenceBadgeState(allLogs, program.exercise_id, exerciseName);
                return {
                    ...program,
                    ...adherence,
                };
            });
        }

        return exercises.map((exercise) => ({
            exercise_id: exercise.id,
            ...getAdherenceBadgeState(allLogs, exercise.id, exercise.canonical_name ?? null),
        }));
    }, [allLogs, exercises, programs]);

    const sessionProgress = useMemo(
        () => buildSessionProgress(selectedExercise, draftSession?.sets ?? []),
        [draftSession?.sets, selectedExercise]
    );

    const logger = useSessionLogging(token, userId, reload, enqueue);

    const abandonDraftSession = useCallback(() => {
        setDraftSession(null);
        setSelectedExerciseId(null);
        setSelectedExercise(null);
        setIsTimerOpen(false);
        setPendingSetPatch(null);
        setManualLogState(emptyManualLogState());
        setNotesModalOpen(false);
        setBackdateEnabled(false);
        setBackdateValue('');
        setPageMessage('');
    }, []);

    const handleExerciseSelect = useCallback((exerciseId) => {
        setSelectedExerciseId(exerciseId);
        const selected = pickerExercises.find((exercise) => exercise.id === exerciseId) || null;
        const enrichedSelected = selected ? {
            ...selected,
            default_form_data: selected.default_form_data ?? buildDefaultFormDataForExercise(selected, allLogs),
        } : null;
        setSelectedExercise(enrichedSelected);
        if (enrichedSelected) {
            setDraftSession(createDraftSession(enrichedSelected, inferActivityType(enrichedSelected)));
            setPendingSetPatch(null);
            setPageMessage('');
            setActiveExercise({ id: enrichedSelected.id, name: enrichedSelected.canonical_name || '' });
            setIsTimerOpen(true);
        }
    }, [allLogs, pickerExercises]);

    const handleTimerBack = useCallback(() => {
        abandonDraftSession();
        setActiveExercise(null);
    }, [abandonDraftSession]);

    const handleFinishSession = useCallback(() => {
        if (!draftSession || draftSession.sets.length === 0) {
            setPageMessage('Please log at least one set before finishing');
            return;
        }
        setPageMessage('');
        setNotesModalOpen(true);
    }, [draftSession]);

    const handleNotesModalClose = useCallback(() => {
        setNotesModalOpen(false);
        setBackdateEnabled(false);
        setBackdateValue('');
    }, []);

    const handleCancelSession = useCallback(() => {
        if (typeof window !== 'undefined') {
            const confirmed = window.confirm('Cancel this session? Your in-progress session will be discarded.');
            if (!confirmed) return;
        }
        handleNotesModalClose();
        handleTimerBack();
    }, [handleNotesModalClose, handleTimerBack]);

    const handleToggleBackdate = useCallback(() => {
        if (!draftSession) return;
        setBackdateEnabled((previous) => {
            if (!previous) {
                setBackdateValue(toLocalDateTimeInputValue(draftSession.date));
            } else {
                setBackdateValue('');
            }
            return !previous;
        });
    }, [draftSession]);

    const handleTimerApplySet = useCallback((setPatch) => {
        if (!selectedExercise) return;
        setPendingSetPatch({
            ...setPatch,
            form_data: setPatch.form_data ?? selectedExercise.default_form_data ?? null,
        });
    }, [selectedExercise]);

    const handleTimerOpenManual = useCallback((options = {}) => {
        if (!selectedExercise || !draftSession) return;
        setManualLogState({
            isOpen: true,
            exercise: selectedExercise,
            sets: [{
                ...createDefaultSet(selectedExercise, 1),
                ...(options.seedSet ?? {}),
                side: selectedExercise.pattern === 'side' ? (options.side ?? 'right') : null,
                manual_log: true,
                form_data: options.seedSet?.form_data ?? selectedExercise.default_form_data ?? null,
                performed_at: draftSession.date,
            }],
            error: null,
        });
        setIsTimerOpen(false);
    }, [draftSession, selectedExercise]);

    const handleConfirmNextSet = useCallback(() => {
        if (!selectedExercise || !pendingSetPatch || !draftSession) return;
        showSaveSuccess('');
        const normalizedSet = normalizeSet({
            ...pendingSetPatch,
            set_number: draftSession.sets.length + 1,
            performed_at: draftSession.date,
        }, draftSession.sets.length, draftSession.activityType);
        const nextLoggedSets = [...draftSession.sets, normalizedSet];
        const comparison = getProgressComparison(
            allLogs,
            selectedExercise,
            nextLoggedSets,
            selectedExercise.pattern === 'side' ? normalizedSet.side : null,
            sessionStartedAt
        );
        setDraftSession((previous) => previous ? { ...previous, sets: nextLoggedSets } : previous);
        maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        setPendingSetPatch(null);
        setPanelResetToken((value) => value + 1);
        if (comparison?.text) {
            speakText(comparison.text, 1500);
        }
    }, [allLogs, draftSession, maybeAnnounceAllSetsComplete, pendingSetPatch, selectedExercise, sessionStartedAt, showSaveSuccess, speakText]);

    const handleEditNextSet = useCallback(() => {
        if (!selectedExercise || !pendingSetPatch) return;
        handleTimerOpenManual({
            side: pendingSetPatch.side,
            seedSet: pendingSetPatch,
        });
        setPendingSetPatch(null);
    }, [handleTimerOpenManual, pendingSetPatch, selectedExercise]);

    const handleHistoryModalSubmit = useCallback(async () => {
        const didSave = await logger.submit();
        if (!didSave) return;
        showSaveSuccess(logger.notes);
    }, [logger, showSaveSuccess]);

    const handleManualAddSet = useCallback(() => {
        setManualLogState((previous) => ({
            ...previous,
            sets: [...previous.sets, createDefaultSet(previous.exercise, previous.sets.length + 1)],
        }));
    }, []);

    const handleManualRemoveSet = useCallback((index) => {
        setManualLogState((previous) => {
            const nextSets = previous.sets
                .filter((_, setIndex) => setIndex !== index)
                .map((set, setIndex) => ({ ...set, set_number: setIndex + 1 }));
            return { ...previous, sets: nextSets };
        });
    }, []);

    const updateManualSet = useCallback((index, patch) => {
        setManualLogState((previous) => ({
            ...previous,
            sets: previous.sets.map((set, setIndex) => (setIndex === index ? { ...set, ...patch } : set)),
        }));
    }, []);

    const updateManualFormParam = useCallback((index, paramName, paramValue, paramUnit = null) => {
        setManualLogState((previous) => ({
            ...previous,
            sets: previous.sets.map((set, setIndex) => {
                if (setIndex !== index) return set;
                const existing = Array.isArray(set.form_data) ? [...set.form_data] : [];
                const matchIndex = existing.findIndex((item) => item.parameter_name === paramName);
                if (!paramValue) {
                    const filtered = existing.filter((item) => item.parameter_name !== paramName);
                    return { ...set, form_data: filtered.length > 0 ? filtered : null };
                }
                const nextParam = {
                    parameter_name: paramName,
                    parameter_value: paramValue,
                    parameter_unit: paramUnit,
                };
                if (matchIndex >= 0) existing[matchIndex] = nextParam;
                else existing.push(nextParam);
                return { ...set, form_data: existing };
            }),
        }));
    }, []);

    const handleManualModalSubmit = useCallback(() => {
        if (!manualLogState.exercise || !draftSession) return;
        if (manualLogState.sets.length === 0) {
            setManualLogState((previous) => ({ ...previous, error: 'Add at least one set before saving.' }));
            return;
        }

        const normalizedSets = manualLogState.sets.map((set, index) => normalizeSet({
            ...set,
            set_number: draftSession.sets.length + index + 1,
            performed_at: draftSession.date,
            manual_log: true,
        }, draftSession.sets.length + index, draftSession.activityType));
        const nextLoggedSets = [...draftSession.sets, ...normalizedSets];

        setDraftSession((previous) => previous ? { ...previous, sets: nextLoggedSets } : previous);
        setManualLogState(emptyManualLogState());
        setIsTimerOpen(true);
        showSaveSuccess('');
        maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        setPanelResetToken((value) => value + 1);
    }, [draftSession, manualLogState.exercise, manualLogState.sets, maybeAnnounceAllSetsComplete, selectedExercise, showSaveSuccess]);

    const handleManualModalClose = useCallback(() => {
        setManualLogState(emptyManualLogState());
        if (selectedExercise) {
            setIsTimerOpen(true);
        }
    }, [selectedExercise]);

    const handleSaveFinishedSession = useCallback(async () => {
        if (!draftSession || !selectedExercise) return;

        const trimmedNotes = draftSession.notes ? draftSession.notes.trim() : '';
        const finalPerformedAt = backdateEnabled && backdateValue
            ? new Date(backdateValue).toISOString()
            : draftSession.date;
        const finalSession = {
            ...draftSession,
            date: finalPerformedAt,
            notes: trimmedNotes || null,
            sets: draftSession.sets.map((set, index) => normalizeSet({
                ...set,
                set_number: index + 1,
                performed_at: finalPerformedAt,
            }, index, draftSession.activityType)),
        };

        const payload = buildCreatePayload(selectedExercise, finalSession.date, finalSession.notes, finalSession.sets);
        payload.client_mutation_id = finalSession.sessionId;

        enqueue(payload);

        let syncResult = { succeeded: 0, failed: 0 };
        try {
            syncResult = await sync();
        } catch {
            // Queue-first flow treats sync failure as non-blocking.
        }

        setOptimisticLogs((previous) => [buildOptimisticLogEntry(finalSession), ...previous]);
        handleNotesModalClose();
        abandonDraftSession();
        setActiveExercise(null);
        setActiveTab('history');
        showSaveSuccess(trimmedNotes);

        if (syncResult.failed === 0) {
            await reload();
            setOptimisticLogs((previous) => previous.filter((log) => log.client_mutation_id !== finalSession.sessionId));
        }
    }, [abandonDraftSession, backdateEnabled, backdateValue, draftSession, enqueue, handleNotesModalClose, reload, selectedExercise, showSaveSuccess, sync]);

    const handleEditLog = useCallback((log) => {
        const byId = pickerExercises.find((exercise) => exercise.id === log.exercise_id);
        const byName = pickerExercises.find((exercise) => exercise.canonical_name === log.exercise_name);
        const exercise = byId || byName || {
            id: log.exercise_id ?? null,
            canonical_name: log.exercise_name ?? 'Exercise',
            pattern_modifiers: [],
            form_parameters_required: [],
            pattern: null,
            dosage_type: null,
        };
        setActiveExercise({ id: exercise.id, name: exercise.canonical_name || log.exercise_name || '' });
        logger.openEdit(exercise, log);
    }, [logger, pickerExercises]);

    useEffect(() => {
        if (!logger.isOpen) {
            setActiveExercise(null);
        }
    }, [logger.isOpen]);

    // Fetch DB user id and recipient id for messages (runs once after sign-in)
    useEffect(() => {
        if (!session) return;
        fetchUsers(token).then((users) => {
            const current = users.find((u) => u.auth_id === session.user.id);
            if (!current) return;
            setCurrentDbId(current.id);
            setEmailEnabled(current.email_notifications_enabled ?? true);
            // Recipient: therapist for patient, or first patient for therapist
            if (current.role === 'therapist') {
                const patient = users.find((u) => u.therapist_id === current.id);
                setRecipientId(patient?.id ?? null);
            } else {
                setRecipientId(current.therapist_id ?? null);
            }
        }).catch((err) => console.error('index fetchUsers:', err));
    }, [session, token]);

    const handleSignOut = useCallback(async () => {
        clearQueue();
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signOut();
    }, [clearQueue]);

    async function handleEmailToggle(enabled) {
        setEmailEnabled(enabled);
        try {
            const { patchEmailNotifications } = await import('../lib/users');
            await patchEmailNotifications(token, enabled);
        } catch (err) {
            console.error('emailToggle:', err);
            setEmailEnabled(!enabled); // revert on error
        }
    }

    if (authLoading) return null;

    if (!session) {
        return <AuthForm title="PT Tracker Sign In" onSignIn={signIn} />;
    }

    const backdateWarningVisible = Boolean(
        draftSession
        && backdateEnabled
        && backdateValue
        && Math.abs(new Date(backdateValue).getTime() - new Date(draftSession.date).getTime()) > 120000
    );

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
                        {/* Messages button with unread badge */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className={styles.refreshButton}
                                onPointerUp={() => { setIsMessagesOpen(true); msgs.markModalOpened(); }}
                                aria-label="Open messages"
                            >
                                ✉️
                                {msgs.unreadCount > 0 && (
                                    <span className={styles.messagesBadge}>{msgs.unreadCount}</span>
                                )}
                            </button>
                        </div>
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

                {pageMessage && (
                    <div className={styles.errorBanner} role="alert">{pageMessage}</div>
                )}

                {successMessage && (
                    <div className={styles.successBanner} role="status" aria-live="polite">{successMessage}</div>
                )}

                <main className={styles.main}>
                    {activeTab === 'exercises' && (
                        <ExercisePicker
                            exercises={pickerExercises}
                            programs={pickerPrograms}
                            selectedId={selectedExerciseId}
                            onSelect={handleExerciseSelect}
                            sortMode={sortMode}
                            onSortChange={setSortMode}
                        />
                    )}

                    {activeTab === 'history' && (
                        <HistoryPanel
                            logs={allLogs}
                            activeExerciseId={activeExercise?.id ?? null}
                            activeExerciseName={activeExercise?.name ?? null}
                            onClearFilter={() => setActiveExercise(null)}
                            onEditLog={handleEditLog}
                        />
                    )}
                </main>

                <BottomNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    pendingSync={pendingCount}
                />

                <SessionLoggerModal
                    isOpen={manualLogState.isOpen || logger.isOpen}
                    isEdit={manualLogState.isOpen ? false : logger.isEdit}
                    exercise={manualLogState.isOpen ? manualLogState.exercise : logger.exercise}
                    title={manualLogState.isOpen ? 'Log Set' : null}
                    submitLabel={manualLogState.isOpen ? 'Save Set' : null}
                    showPerformedAt={!manualLogState.isOpen}
                    showNotes={!manualLogState.isOpen}
                    performedAt={manualLogState.isOpen ? draftSession?.date ?? new Date().toISOString() : logger.performedAt}
                    notes={manualLogState.isOpen ? '' : logger.notes}
                    sets={manualLogState.isOpen ? manualLogState.sets : logger.sets}
                    submitting={manualLogState.isOpen ? false : logger.submitting}
                    error={manualLogState.isOpen ? manualLogState.error : logger.error}
                    onClose={manualLogState.isOpen ? handleManualModalClose : logger.close}
                    onPerformedAtChange={manualLogState.isOpen ? (() => {}) : logger.setPerformedAt}
                    onNotesChange={manualLogState.isOpen ? (() => {}) : logger.setNotes}
                    onAddSet={manualLogState.isOpen ? handleManualAddSet : logger.addSet}
                    onRemoveSet={manualLogState.isOpen ? handleManualRemoveSet : logger.removeSet}
                    onSetChange={manualLogState.isOpen ? updateManualSet : logger.updateSet}
                    onFormParamChange={manualLogState.isOpen ? updateManualFormParam : logger.updateFormParam}
                    onSubmit={manualLogState.isOpen ? handleManualModalSubmit : handleHistoryModalSubmit}
                    historicalFormParams={historicalFormParams}
                />

                <TimerPanel
                    isOpen={isTimerOpen}
                    exercise={selectedExercise}
                    resetToken={panelResetToken}
                    sessionProgress={sessionProgress}
                    onClose={handleTimerBack}
                    onFinish={handleFinishSession}
                    onBack={handleTimerBack}
                    onApplySet={handleTimerApplySet}
                    onOpenManual={handleTimerOpenManual}
                />

                <NextSetConfirmModal
                    isOpen={Boolean(pendingSetPatch)}
                    exercise={selectedExercise}
                    setPatch={pendingSetPatch}
                    submitting={false}
                    error={null}
                    onClose={() => setPendingSetPatch(null)}
                    onEdit={handleEditNextSet}
                    onConfirm={handleConfirmNextSet}
                />

                <SessionNotesModal
                    isOpen={notesModalOpen && Boolean(draftSession)}
                    notes={draftSession?.notes ?? ''}
                    backdateEnabled={backdateEnabled}
                    backdateValue={backdateValue}
                    warningVisible={backdateWarningVisible}
                    onClose={handleNotesModalClose}
                    onCancel={handleCancelSession}
                    onNotesChange={(value) => {
                        setDraftSession((previous) => previous ? { ...previous, notes: value } : previous);
                    }}
                    onToggleBackdate={handleToggleBackdate}
                    onBackdateChange={setBackdateValue}
                    onSave={handleSaveFinishedSession}
                />

                <MessagesModal
                    isOpen={isMessagesOpen}
                    onClose={() => setIsMessagesOpen(false)}
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
            </div>
        </>
    );
}
