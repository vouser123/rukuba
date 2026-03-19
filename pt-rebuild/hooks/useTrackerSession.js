// hooks/useTrackerSession.js — active tracker session state and lifecycle handlers for pages/index.js
import { useCallback, useMemo, useState } from 'react';
import { buildOptimisticLogEntry, createDraftSession, toLocalDateTimeInputValue } from '../lib/index-tracker-session';
import { buildDefaultFormDataForExercise } from '../lib/session-form-params';
import { getProgressComparison } from '../lib/logger-progress-comparison';
import { buildCreatePayload, inferActivityType, normalizeSet } from '../lib/session-logging';

/**
 * Active in-progress tracker session state for the index page.
 * @param {object} options
 * @returns {object}
 */
export function useTrackerSession({
    pickerExercises,
    logs,
    openManualLog,
    showSaveSuccess,
    speakText,
    maybeAnnounceAllSetsComplete,
    enqueue,
    sync,
    reload,
}) {
    const [selectedExerciseId, setSelectedExerciseId] = useState(null), [selectedExercise, setSelectedExercise] = useState(null);
    const [draftSession, setDraftSession] = useState(null), [isTimerOpen, setIsTimerOpen] = useState(false);
    const [panelResetToken, setPanelResetToken] = useState(0), [pendingSetPatch, setPendingSetPatch] = useState(null);
    const [notesModalOpen, setNotesModalOpen] = useState(false), [backdateEnabled, setBackdateEnabled] = useState(false);
    const [backdateValue, setBackdateValue] = useState(''), [pageMessage, setPageMessage] = useState('');
    const [optimisticLogs, setOptimisticLogs] = useState([]), [activeExercise, setActiveExercise] = useState(null);
    const sessionStartedAt = useMemo(() => draftSession?.date ?? new Date().toISOString(), [draftSession?.date]);
    const allLogs = useMemo(() => [...optimisticLogs, ...logs], [logs, optimisticLogs]);

    const abandonDraftSession = useCallback(() => {
        setDraftSession(null);
        setSelectedExerciseId(null);
        setSelectedExercise(null);
        setIsTimerOpen(false);
        setPendingSetPatch(null);
        setNotesModalOpen(false);
        setBackdateEnabled(false);
        setBackdateValue('');
        setPageMessage('');
    }, []);

    const handleExerciseSelect = useCallback((exerciseId) => {
        setSelectedExerciseId(exerciseId);
        const selected = pickerExercises.find((exercise) => exercise.id === exerciseId) || null;
        const enrichedSelected = selected ? { ...selected, default_form_data: selected.default_form_data ?? buildDefaultFormDataForExercise(selected, allLogs) } : null;
        setSelectedExercise(enrichedSelected);
        if (!enrichedSelected) return;
        setDraftSession(createDraftSession(enrichedSelected, inferActivityType(enrichedSelected)));
        setPendingSetPatch(null);
        setPageMessage('');
        setActiveExercise({ id: enrichedSelected.id, name: enrichedSelected.canonical_name || '' });
        setIsTimerOpen(true);
    }, [allLogs, pickerExercises]);

    const handleTimerBack = useCallback(() => {
        abandonDraftSession();
        setActiveExercise(null);
    }, [abandonDraftSession]);

    const handleFinishSession = useCallback(() => {
        if (!draftSession || draftSession.sets.length === 0) {
            setPageMessage('Please log at least one set before finishing');
            return false;
        }
        setPageMessage('');
        setNotesModalOpen(true);
        return true;
    }, [draftSession]);

    const handleNotesModalClose = useCallback(() => {
        setNotesModalOpen(false);
        setBackdateEnabled(false);
        setBackdateValue('');
    }, []);

    const handleCancelSession = useCallback(() => {
        if (typeof window !== 'undefined' && !window.confirm('Cancel this session? Your in-progress session will be discarded.')) return;
        handleNotesModalClose();
        handleTimerBack();
    }, [handleNotesModalClose, handleTimerBack]);

    const handleToggleBackdate = useCallback(() => {
        if (!draftSession) return;
        setBackdateEnabled((previous) => {
            setBackdateValue(previous ? '' : toLocalDateTimeInputValue(draftSession.date));
            return !previous;
        });
    }, [draftSession]);

    const handleTimerApplySet = useCallback((setPatch) => {
        if (!selectedExercise) return;
        setPendingSetPatch({ ...setPatch, form_data: setPatch.form_data ?? selectedExercise.default_form_data ?? null });
    }, [selectedExercise]);

    const handleTimerOpenManual = useCallback((options = {}) => openManualLog(options), [openManualLog]);

    const handleConfirmNextSet = useCallback(() => {
        if (!selectedExercise || !pendingSetPatch || !draftSession) return;
        showSaveSuccess('');
        const normalizedSet = normalizeSet({ ...pendingSetPatch, set_number: draftSession.sets.length + 1, performed_at: draftSession.date }, draftSession.sets.length, draftSession.activityType);
        const nextLoggedSets = [...draftSession.sets, normalizedSet];
        const comparison = getProgressComparison(allLogs, selectedExercise, nextLoggedSets, selectedExercise.pattern === 'side' ? normalizedSet.side : null, sessionStartedAt);
        setDraftSession((previous) => (previous ? { ...previous, sets: nextLoggedSets } : previous));
        maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        setPendingSetPatch(null);
        setPanelResetToken((value) => value + 1);
        if (comparison?.text) speakText(comparison.text, 1500);
    }, [allLogs, draftSession, maybeAnnounceAllSetsComplete, pendingSetPatch, selectedExercise, sessionStartedAt, showSaveSuccess, speakText]);

    const handleEditNextSet = useCallback(() => {
        if (!selectedExercise || !pendingSetPatch) return;
        handleTimerOpenManual({ side: pendingSetPatch.side, seedSet: pendingSetPatch });
        setPendingSetPatch(null);
    }, [handleTimerOpenManual, pendingSetPatch, selectedExercise]);

    const handleSaveFinishedSession = useCallback(() => {
        if (!draftSession || !selectedExercise) return false;
        const trimmedNotes = draftSession.notes ? draftSession.notes.trim() : '';
        const finalPerformedAt = backdateEnabled && backdateValue ? new Date(backdateValue).toISOString() : draftSession.date;
        const finalSession = { ...draftSession, date: finalPerformedAt, notes: trimmedNotes || null, sets: draftSession.sets.map((set, index) => normalizeSet({ ...set, set_number: index + 1, performed_at: finalPerformedAt }, index, draftSession.activityType)) };
        const payload = buildCreatePayload(selectedExercise, finalSession.date, finalSession.notes, finalSession.sets);
        payload.client_mutation_id = finalSession.sessionId;

        // Queue-first: push immediately so save is durable before any network attempt
        enqueue(payload);

        // UX updates happen immediately — user sees feedback before sync outcome
        setOptimisticLogs((previous) => [buildOptimisticLogEntry(finalSession), ...previous]);
        handleNotesModalClose();
        abandonDraftSession();
        setActiveExercise(null);
        showSaveSuccess(trimmedNotes);

        // Fire-and-forget sync: clears optimistic entry and reloads on success
        sync([payload]).then(async (syncResult) => {
            if (syncResult?.failed === 0) {
                await reload();
                setOptimisticLogs((previous) => previous.filter((log) => log.client_mutation_id !== finalSession.sessionId));
            }
        }).catch(() => { /* network failure — session stays in queue for later sync */ });

        return true;
    }, [abandonDraftSession, backdateEnabled, backdateValue, draftSession, enqueue, handleNotesModalClose, reload, selectedExercise, showSaveSuccess, sync]);

    return {
        selectedExerciseId, selectedExercise, draftSession, isTimerOpen, panelResetToken, pendingSetPatch, notesModalOpen,
        backdateEnabled, backdateValue, pageMessage, optimisticLogs, allLogs, activeExercise, sessionStartedAt,
        setDraftSession, setPendingSetPatch, setBackdateValue, setActiveExercise, setIsTimerOpen, setPanelResetToken,
        handleExerciseSelect, handleTimerBack, handleFinishSession, handleNotesModalClose, handleCancelSession,
        handleToggleBackdate, handleTimerApplySet, handleTimerOpenManual, handleConfirmNextSet, handleEditNextSet,
        handleSaveFinishedSession,
    };
}
