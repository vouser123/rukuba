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
import TimerPanel from '../components/TimerPanel';
import { useSessionLogging } from '../hooks/useSessionLogging';
import { usePanelSessionProgress } from '../hooks/usePanelSessionProgress';
import { useLoggerFeedback } from '../hooks/useLoggerFeedback';
import { getAdherenceBadgeState } from '../lib/index-history';
import { buildDefaultFormDataForExercise, collectGlobalParameterValues } from '../lib/session-form-params';
import { getProgressComparison } from '../lib/logger-progress-comparison';
import styles from './index.module.css';

export default function IndexPage() {
    const { session, loading: authLoading, signIn } = useAuth();

    const userId = session?.user?.id ?? null;
    const token  = session?.access_token ?? null;

    const { exercises, programs, logs, loading, error, reload } = useIndexData(token, userId);
    const { pendingCount, enqueue, sync, clearQueue } = useIndexOfflineQueue(userId, token);

    // 'exercises' | 'history'
    const [activeTab, setActiveTab] = useState('exercises');
    const [sortMode, setSortMode] = useState('pt_order');
    const [selectedExerciseId, setSelectedExerciseId] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState(null);
    const [isTimerOpen, setIsTimerOpen] = useState(false);
    const [panelResetToken, setPanelResetToken] = useState(0);
    const [pendingSetPatch, setPendingSetPatch] = useState(null);
    const { loggedSets, sessionStartedAt, sessionProgress, appendLoggedSet, resetLoggedSets } = usePanelSessionProgress(selectedExercise);
    const {
        successMessage,
        maybeAnnounceAllSetsComplete,
        showSaveSuccess,
        speakText,
    } = useLoggerFeedback(selectedExercise, sessionStartedAt);

    /**
     * Currently open exercise (set by SessionLoggerModal in Phase 4c).
     * Drives the HistoryPanel exercise-filter (DN-014 behavior):
     *   null  → show all history
     *   { id, name } → show only that exercise's history
     */
    const [activeExercise, setActiveExercise] = useState(null);

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

    const historicalFormParams = useMemo(() => collectGlobalParameterValues(logs), [logs]);
    const pickerPrograms = useMemo(() => {
        if (programs.length > 0) {
            return programs.map((program) => {
                const exerciseName = program?.exercises?.canonical_name ?? null;
                const adherence = getAdherenceBadgeState(logs, program.exercise_id, exerciseName);
                return {
                    ...program,
                    ...adherence,
                };
            });
        }

        return exercises.map((exercise) => ({
            exercise_id: exercise.id,
            ...getAdherenceBadgeState(logs, exercise.id, exercise.canonical_name ?? null),
        }));
    }, [exercises, logs, programs]);

    // logger must be declared before handleExerciseSelect so it is initialized
    // when useCallback evaluates the dependency array (avoids TDZ crash on SSR).
    const logger = useSessionLogging(token, userId, reload, enqueue);

    const handleExerciseSelect = useCallback((exerciseId) => {
        setSelectedExerciseId(exerciseId);
        const selected = pickerExercises.find((exercise) => exercise.id === exerciseId) || null;
        const enrichedSelected = selected ? {
            ...selected,
            default_form_data: selected.default_form_data ?? buildDefaultFormDataForExercise(selected, logs),
        } : null;
        setSelectedExercise(enrichedSelected);
        if (enrichedSelected) {
            setPendingSetPatch(null);
            setActiveExercise({ id: enrichedSelected.id, name: enrichedSelected.canonical_name || '' });
            setIsTimerOpen(true);
        }
    }, [logs, pickerExercises]);

    const handleTimerClose = useCallback(() => {
        setIsTimerOpen(false);
        setPendingSetPatch(null);
        resetLoggedSets();
    }, [resetLoggedSets]);

    const handleTimerApplySet = useCallback((setPatch) => {
        if (!selectedExercise) return;
        setPendingSetPatch({
            ...setPatch,
            form_data: setPatch.form_data ?? selectedExercise.default_form_data ?? null,
        });
    }, [selectedExercise]);

    const handleTimerOpenManual = useCallback((options = {}) => {
        if (!selectedExercise) return;
        logger.openCreateWithSeedSet(selectedExercise, {
            side: selectedExercise.pattern === 'side' ? (options.side ?? 'right') : null,
            manual_log: true,
            form_data: selectedExercise.default_form_data ?? null,
        });
        setIsTimerOpen(false);
    }, [logger, selectedExercise]);

    const handleConfirmNextSet = useCallback(async () => {
        if (!selectedExercise || !pendingSetPatch) return;
        const didSave = await logger.submitSeedSet(selectedExercise, pendingSetPatch);
        if (!didSave) return;
        showSaveSuccess('');
        const nextLoggedSets = [...loggedSets, pendingSetPatch];
        const comparison = getProgressComparison(
            logs,
            selectedExercise,
            nextLoggedSets,
            selectedExercise.pattern === 'side' ? pendingSetPatch.side : null,
            sessionStartedAt
        );
        appendLoggedSet(pendingSetPatch);
        maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        setPendingSetPatch(null);
        setPanelResetToken((value) => value + 1);
        if (comparison?.text) {
            speakText(comparison.text, 1500);
        }
    }, [appendLoggedSet, loggedSets, logger, logs, maybeAnnounceAllSetsComplete, pendingSetPatch, selectedExercise, sessionStartedAt, showSaveSuccess, speakText]);

    const handleEditNextSet = useCallback(() => {
        if (!selectedExercise || !pendingSetPatch) return;
        logger.openCreateWithSeedSet(selectedExercise, pendingSetPatch);
        setPendingSetPatch(null);
        setIsTimerOpen(false);
    }, [logger, pendingSetPatch, selectedExercise]);

    const handleModalSubmit = useCallback(async () => {
        const notesValue = logger.notes;
        const savedSets = logger.sets;
        const loggerExercise = logger.exercise;
        const wasEdit = logger.isEdit;
        const didSave = await logger.submit();
        if (!didSave || wasEdit) return;
        showSaveSuccess(notesValue);
        if (
            selectedExercise
            && loggerExercise?.id === selectedExercise.id
            && Array.isArray(savedSets)
            && savedSets.length > 0
        ) {
            const nextLoggedSets = [...loggedSets, ...savedSets];
            savedSets.forEach((set) => appendLoggedSet(set));
            maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        }
    }, [appendLoggedSet, loggedSets, logger, maybeAnnounceAllSetsComplete, selectedExercise, showSaveSuccess]);

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

                {successMessage && (
                    <div className={styles.successBanner} role="status" aria-live="polite">{successMessage}</div>
                )}

                <main className={styles.main}>
                    {/* ── Exercises tab ── */}
                    {activeTab === 'exercises' && (
                        <>
                            <ExercisePicker
                                exercises={pickerExercises}
                                programs={pickerPrograms}
                                selectedId={selectedExerciseId}
                                onSelect={handleExerciseSelect}
                                sortMode={sortMode}
                                onSortChange={setSortMode}
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
                            onEditLog={handleEditLog}
                        />
                    )}
                </main>

                {/* ── Bottom navigation ── */}
                <BottomNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    pendingSync={pendingCount}
                />

                <SessionLoggerModal
                    isOpen={logger.isOpen}
                    isEdit={logger.isEdit}
                    exercise={logger.exercise}
                    performedAt={logger.performedAt}
                    notes={logger.notes}
                    sets={logger.sets}
                    submitting={logger.submitting}
                    error={logger.error}
                    onClose={logger.close}
                    onPerformedAtChange={logger.setPerformedAt}
                    onNotesChange={logger.setNotes}
                    onAddSet={logger.addSet}
                    onRemoveSet={logger.removeSet}
                    onSetChange={logger.updateSet}
                    onFormParamChange={logger.updateFormParam}
                    onSubmit={handleModalSubmit}
                    historicalFormParams={historicalFormParams}
                />

                <TimerPanel
                    isOpen={isTimerOpen}
                    exercise={selectedExercise}
                    resetToken={panelResetToken}
                    sessionProgress={sessionProgress}
                    onClose={handleTimerClose}
                    onApplySet={handleTimerApplySet}
                    onOpenManual={handleTimerOpenManual}
                />

                <NextSetConfirmModal
                    isOpen={Boolean(pendingSetPatch)}
                    exercise={selectedExercise}
                    setPatch={pendingSetPatch}
                    submitting={logger.submitting}
                    error={logger.error}
                    onClose={() => setPendingSetPatch(null)}
                    onEdit={handleEditNextSet}
                    onConfirm={handleConfirmNextSet}
                />
            </div>
        </>
    );
}
