/**
 * pages/index.js — Tracker Logging Page: exercise picker, timer/counter logger, history panel.
 * Replaces public/index.html (Strangler Fig cutover target).
 *
 * ⚠️  ORCHESTRATOR ONLY — this file wires hooks and components together. Nothing else.
 * Before adding ANY code here, ask: "Is this pure wiring?"
 * If the answer is no → it belongs in a hook, component, or lib file, not this file.
 * Adding non-wiring code here is how fixed pages regress. See AGENTS.md Pre-Coding Layer Check.
 *
 * Wires:
 *   Auth           → hooks/useAuth.js
 *   User context   → hooks/useUserContext.js
 *   Data bootstrap → hooks/useIndexData.js, hooks/useIndexOfflineQueue.js
 *   Tracker state  → hooks/useTrackerSession.js, hooks/useSessionLogging.js,
 *                    hooks/useManualLog.js, hooks/useLoggerFeedback.js
 *   Recovery       → hooks/useTrackerReconnectRecovery.js
 *   UI state       → hooks/useExerciseSortState.js, hooks/useToast.js, hooks/useMessages.js
 *   Data helpers   → lib/index-history.js, lib/index-tracker-session.js,
 *                    lib/tracker-performance.js
 *   UI             → components/ExercisePicker.js, components/TimerPanel.js,
 *                    components/HistoryPanel.js, components/BottomNav.js,
 *                    components/NextSetConfirmModal.js, components/SessionLoggerModal.js,
 *                    components/SessionNotesModal.js, components/MessagesModal.js,
 *                    components/NavMenu.js, components/AuthForm.js, components/Toast.js
 *   Styles         → index.module.css
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { useIndexData } from '../hooks/useIndexData';
import { useIndexOfflineQueue } from '../hooks/useIndexOfflineQueue';
import { useManualLog } from '../hooks/useManualLog';
import { useTrackerReconnectRecovery } from '../hooks/useTrackerReconnectRecovery';
import { useTrackerSession } from '../hooks/useTrackerSession';
import { useSessionLogging } from '../hooks/useSessionLogging';
import { useLoggerFeedback } from '../hooks/useLoggerFeedback';
import { useToast } from '../hooks/useToast';
import { useMessages } from '../hooks/useMessages';
import { useUserContext } from '../hooks/useUserContext';
import { useExerciseSortState } from '../hooks/useExerciseSortState';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import HistoryPanel from '../components/HistoryPanel';
import BottomNav from '../components/BottomNav';
import ExercisePicker from '../components/ExercisePicker';
import NextSetConfirmModal from '../components/NextSetConfirmModal';
import SessionLoggerModal from '../components/SessionLoggerModal';
import SessionNotesModal from '../components/SessionNotesModal';
import TimerPanel from '../components/TimerPanel';
import MessagesModal from '../components/MessagesModal';
import Toast from '../components/Toast';
import { getAdherenceBadgeState } from '../lib/index-history';
import { buildSessionProgress } from '../lib/index-tracker-session';
import { markTrackerPickerReady } from '../lib/tracker-performance';
import styles from './index.module.css';

export default function IndexPage() {
    const { session, loading: authLoading, signIn } = useAuth();
    const userId = session?.user?.id ?? null;
    const token = session?.access_token ?? null;
    const userCtx = useUserContext(session);
    const trackerPatientId = userCtx.patientId ?? null;
    const [isOnline, setIsOnline] = useState(() => (
        typeof navigator === 'undefined' ? true : navigator.onLine !== false
    ));
    const {
        exercises,
        programs,
        logs,
        loading,
        historyLoading,
        error,
        historyError,
        fromCache,
        reload,
    } = useIndexData(token, trackerPatientId);
    const { pendingCount, enqueue, sync, clearQueue } = useIndexOfflineQueue(userId, token, {
        autoSyncOnReconnect: false,
    });

    const [activeTab, setActiveTab] = useState('exercises');
    const [isMessagesOpen, setIsMessagesOpen] = useState(false);

    // Local emailEnabled state — initialized from server value once userCtx loads.
    // Kept local so the toggle can optimistically update without re-fetching users.
    const [emailEnabled, setEmailEnabled] = useState(true);
    useEffect(() => {
        if (!userCtx.loading) setEmailEnabled(userCtx.emailEnabled);
    }, [userCtx.emailEnabled, userCtx.loading]);

    const pickerExercises = useMemo(() => {
        if (programs.length === 0) return exercises;
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
    }, [exercises, programs]);
    const {
        sortMode,
        setSortMode,
        manualOrderIds,
        setManualOrderIds,
    } = useExerciseSortState(userId, pickerExercises);

    const { showToast, toastMessage, toastType, toastVisible } = useToast();

    const manualOpenRef = useRef(() => {});
    const feedbackRef = useRef({
        showSaveSuccess: () => {},
        speakText: () => {},
        maybeAnnounceAllSetsComplete: () => {},
    });
    const trackerSession = useTrackerSession({
        pickerExercises,
        logs,
        openManualLog: (options) => manualOpenRef.current(options),
        showSaveSuccess: (...args) => feedbackRef.current.showSaveSuccess(...args),
        showToast,
        speakText: (...args) => feedbackRef.current.speakText(...args),
        maybeAnnounceAllSetsComplete: (...args) => feedbackRef.current.maybeAnnounceAllSetsComplete(...args),
        enqueue,
        sync,
        reload,
    });
    const {
        selectedExerciseId,
        selectedExercise,
        draftSession,
        isTimerOpen,
        panelResetToken,
        pendingSetPatch,
        notesModalOpen,
        backdateEnabled,
        backdateValue,
        allLogs,
        activeExercise,
        sessionStartedAt,
        currentSide,
        setDraftSession,
        setPendingSetPatch,
        setBackdateValue,
        setActiveExercise,
        setIsTimerOpen,
        setPanelResetToken,
        setCurrentSide,
        handleExerciseSelect,
        handleTimerBack,
        handleFinishSession,
        handleNotesModalClose,
        handleCancelSession,
        handleToggleBackdate,
        handleTimerApplySet,
        handleTimerOpenManual,
        handleConfirmNextSet,
        handleEditNextSet,
        handleSaveFinishedSession,
        handlePreviousSet,
        handleBlockedNextSet,
        buildExerciseFormContext,
    } = trackerSession;

    const { maybeAnnounceAllSetsComplete, showSaveSuccess, speakText } = useLoggerFeedback(selectedExercise, sessionStartedAt, showToast);
    feedbackRef.current = { showSaveSuccess, speakText, maybeAnnounceAllSetsComplete };
    const manualLog = useManualLog({
        draftSession,
        selectedExercise,
        buildExerciseFormContext,
        setDraftSession,
        setIsTimerOpen,
        setPanelResetToken,
        maybeAnnounceAllSetsComplete,
    });
    manualOpenRef.current = manualLog.openManualLog;

    const logger = useSessionLogging(token, trackerPatientId, reload, enqueue);
    // profileId (users table PK) is the correct viewer id for message sender comparisons — not userId (auth_id)
    const msgs = useMessages(token, userCtx.profileId);
    const pickerPrograms = useMemo(() => {
        const buildHistoryState = (exerciseId, canonicalName = null) => {
            if (historyLoading && logs.length === 0) {
                return { history_pending: true };
            }
            return getAdherenceBadgeState(allLogs, exerciseId, canonicalName);
        };

        if (programs.length > 0) {
            return programs.map((program) => ({
                ...program,
                ...buildHistoryState(program.exercise_id, program?.exercises?.canonical_name ?? null),
            }));
        }
        return exercises.map((exercise) => ({
            exercise_id: exercise.id,
            ...buildHistoryState(exercise.id, exercise.canonical_name ?? null),
        }));
    }, [allLogs, exercises, historyLoading, logs.length, programs]);
    const sessionProgress = useMemo(() => buildSessionProgress(selectedExercise, draftSession?.sets ?? []), [draftSession?.sets, selectedExercise]);

    useEffect(() => {
        if (loading) return;
        if (pickerExercises.length === 0) return;

        const frameId = window.requestAnimationFrame(() => {
            markTrackerPickerReady();
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [loading, pickerExercises.length]);

    const handleHistoryModalSubmit = useCallback(async () => {
        const didSave = await logger.submit();
        if (didSave) showSaveSuccess(logger.notes);
    }, [logger, showSaveSuccess]);

    const handleSaveAndShowHistory = useCallback(() => {
        const didSave = handleSaveFinishedSession();
        if (didSave) setActiveTab('exercises');
    }, [handleSaveFinishedSession]);

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
    }, [logger, pickerExercises, setActiveExercise]);

    useEffect(() => {
        if (!logger.isOpen) setActiveExercise(null);
    }, [logger.isOpen, setActiveExercise]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const syncOnlineState = () => setIsOnline(window.navigator.onLine !== false);
        syncOnlineState();
        window.addEventListener('online', syncOnlineState);
        window.addEventListener('offline', syncOnlineState);

        return () => {
            window.removeEventListener('online', syncOnlineState);
            window.removeEventListener('offline', syncOnlineState);
        };
    }, []);

    const canRefreshOnReconnect = activeTab === 'exercises'
        && !isTimerOpen
        && !manualLog.manualLogState.isOpen
        && !logger.isOpen
        && !notesModalOpen
        && !pendingSetPatch
        && !draftSession;

    useTrackerReconnectRecovery({
        enabled: Boolean(session && token && trackerPatientId),
        canRefreshNow: canRefreshOnReconnect,
        sync,
        reload,
    });

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
            setEmailEnabled(!enabled);
        }
    }

    if (authLoading) return null;
    if (!session) return <AuthForm onSignIn={signIn} />;

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
                <link rel="manifest" href="/manifest-tracker.json" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="PT Tracker" />
            </Head>

            <div className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.title}>PT Tracker</h1>
                    <div className={styles.headerActions}>
                        <span
                            className={`${styles.connectivityIndicator} ${isOnline ? '' : styles.connectivityIndicatorOffline}`}
                            role="status"
                            aria-label={isOnline ? 'Online' : 'Offline'}
                            title={isOnline ? 'Online' : 'Offline'}
                        >
                            {isOnline ? '🛜' : '🚫'}
                        </span>
                        <div style={{ position: 'relative' }}>
                            <button className={styles.refreshButton} onPointerUp={() => { setIsMessagesOpen(true); msgs.markModalOpened(); }} aria-label="Open messages">
                                ✉️
                                {msgs.unreadCount > 0 && <span className={styles.messagesBadge}>{msgs.unreadCount}</span>}
                            </button>
                        </div>
                        <NavMenu
                            user={session.user}
                            isAdmin={true}
                            onSignOut={handleSignOut}
                            currentPage="index"
                            actions={[{ action: 'manual-sync', label: 'Sync now' }]}
                            onAction={async (action) => {
                                if (action !== 'manual-sync') return false;
                                const result = await sync();
                                if ((result?.succeeded ?? 0) === 0 && (result?.failed ?? 0) === 0) {
                                    showToast('Nothing to sync!', 'success');
                                }
                                return true;
                            }}
                        />
                    </div>
                </header>

                {fromCache && !error && (
                    <div className={styles.infoBanner} role="status">
                        Using cached data
                    </div>
                )}
                {error && <div className={styles.errorBanner} role="alert">{error}</div>}
                {!error && historyError && <div className={styles.infoBanner} role="status">{historyError}</div>}
                <Toast message={toastMessage} type={toastType} visible={toastVisible} />

                <main className={styles.main}>
                    {activeTab === 'exercises' && (
                        <ExercisePicker
                            exercises={pickerExercises}
                            programs={pickerPrograms}
                            selectedId={selectedExerciseId}
                            onSelect={handleExerciseSelect}
                            sortMode={sortMode}
                            onSortChange={setSortMode}
                            manualOrderIds={manualOrderIds}
                            onManualOrderChange={setManualOrderIds}
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

                <BottomNav activeTab={activeTab} onTabChange={setActiveTab} pendingSync={pendingCount} />

                <SessionLoggerModal
                    isOpen={manualLog.manualLogState.isOpen || logger.isOpen}
                    isEdit={manualLog.manualLogState.isOpen ? false : logger.isEdit}
                    exercise={manualLog.manualLogState.isOpen ? manualLog.manualLogState.exercise : logger.exercise}
                    title={manualLog.manualLogState.isOpen ? 'Log Set' : null}
                    submitLabel={manualLog.manualLogState.isOpen ? 'Save Set' : null}
                    showPerformedAt={!manualLog.manualLogState.isOpen}
                    showNotes={!manualLog.manualLogState.isOpen}
                    performedAt={manualLog.manualLogState.isOpen ? draftSession?.date ?? new Date().toISOString() : logger.performedAt}
                    notes={manualLog.manualLogState.isOpen ? '' : logger.notes}
                    sets={manualLog.manualLogState.isOpen ? manualLog.manualLogState.sets : logger.sets}
                    submitting={manualLog.manualLogState.isOpen ? false : logger.submitting}
                    error={manualLog.manualLogState.isOpen ? manualLog.manualLogState.error : logger.error}
                    onClose={manualLog.manualLogState.isOpen ? manualLog.handleManualModalClose : logger.close}
                    onPerformedAtChange={manualLog.manualLogState.isOpen ? (() => {}) : logger.setPerformedAt}
                    onNotesChange={manualLog.manualLogState.isOpen ? (() => {}) : logger.setNotes}
                    onAddSet={manualLog.manualLogState.isOpen ? manualLog.handleManualAddSet : logger.addSet}
                    onRemoveSet={manualLog.manualLogState.isOpen ? manualLog.handleManualRemoveSet : logger.removeSet}
                    onSetChange={manualLog.manualLogState.isOpen ? manualLog.updateManualSet : logger.updateSet}
                    onFormParamChange={manualLog.manualLogState.isOpen ? manualLog.updateManualFormParam : logger.updateFormParam}
                    onSubmit={manualLog.manualLogState.isOpen ? manualLog.handleManualModalSubmit : handleHistoryModalSubmit}
                    historicalFormParams={(manualLog.manualLogState.isOpen ? manualLog.manualLogState.exercise : logger.exercise)?.historical_form_params ?? {}}
                />

                <TimerPanel
                    isOpen={isTimerOpen}
                    exercise={selectedExercise}
                    resetToken={panelResetToken}
                    sessionProgress={sessionProgress}
                    selectedSide={currentSide}
                    onSideChange={setCurrentSide}
                    onPrevious={handlePreviousSet}
                    onBlockedNextSet={handleBlockedNextSet}
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
                        setDraftSession((previous) => (previous ? { ...previous, notes: value } : previous));
                    }}
                    onToggleBackdate={handleToggleBackdate}
                    onBackdateChange={setBackdateValue}
                    onSave={handleSaveAndShowHistory}
                />

                <MessagesModal
                    isOpen={isMessagesOpen}
                    onClose={() => setIsMessagesOpen(false)}
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
            </div>
        </>
    );
}
