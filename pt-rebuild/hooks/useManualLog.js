// hooks/useManualLog.js — manual tracker logging state and modal handlers for in-progress sessions
import { useCallback, useState } from 'react';
import { createDefaultSet, normalizeSet } from '../lib/session-logging';

function emptyManualLogState() {
    return { isOpen: false, exercise: null, sets: [], error: null };
}

/**
 * Manual session-log state for the tracker page.
 * @param {object} options
 * @returns {object}
 */
export function useManualLog({
    draftSession,
    selectedExercise,
    buildExerciseFormContext,
    setDraftSession,
    setIsTimerOpen,
    setPanelResetToken,
    showSaveSuccess,
    maybeAnnounceAllSetsComplete,
}) {
    const [manualLogState, setManualLogState] = useState(emptyManualLogState);

    const openManualLog = useCallback((options = {}) => {
        if (!selectedExercise || !draftSession) return;
        const side = selectedExercise.pattern === 'side' ? (options.side ?? options.seedSet?.side ?? 'right') : null;
        const exerciseWithContext = buildExerciseFormContext
            ? (buildExerciseFormContext(selectedExercise, side) ?? selectedExercise)
            : selectedExercise;
        setManualLogState({
            isOpen: true,
            exercise: exerciseWithContext,
            sets: [{
                ...createDefaultSet(exerciseWithContext, 1),
                ...(options.seedSet ?? {}),
                side: exerciseWithContext.pattern === 'side' ? side : null,
                manual_log: true,
                form_data: options.seedSet?.form_data ?? exerciseWithContext.default_form_data ?? null,
                performed_at: draftSession.date,
            }],
            error: null,
        });
        setIsTimerOpen(false);
    }, [buildExerciseFormContext, draftSession, selectedExercise, setIsTimerOpen]);

    const handleManualAddSet = useCallback(() => {
        setManualLogState((previous) => ({
            ...previous,
            sets: [...previous.sets, createDefaultSet(previous.exercise, previous.sets.length + 1)],
        }));
    }, []);

    const handleManualRemoveSet = useCallback((index) => {
        setManualLogState((previous) => ({
            ...previous,
            sets: previous.sets
                .filter((_, setIndex) => setIndex !== index)
                .map((set, setIndex) => ({ ...set, set_number: setIndex + 1 })),
        }));
    }, []);

    const updateManualSet = useCallback((index, patch) => {
        setManualLogState((previous) => {
            const nextExercise = patch.side && previous.exercise?.pattern === 'side' && buildExerciseFormContext
                ? (buildExerciseFormContext(previous.exercise, patch.side) ?? previous.exercise)
                : previous.exercise;
            return {
                ...previous,
                exercise: nextExercise,
                sets: previous.sets.map((set, setIndex) => {
                    if (setIndex !== index) return set;
                    const nextSet = { ...set, ...patch };
                    if (patch.side && previous.exercise?.pattern === 'side' && !patch.form_data) {
                        return { ...nextSet, form_data: nextExercise?.default_form_data ?? nextSet.form_data ?? null };
                    }
                    return nextSet;
                }),
            };
        });
    }, [buildExerciseFormContext]);

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
                const nextParam = { parameter_name: paramName, parameter_value: paramValue, parameter_unit: paramUnit };
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

        setDraftSession((previous) => (previous ? { ...previous, sets: nextLoggedSets } : previous));
        setManualLogState(emptyManualLogState());
        setIsTimerOpen(true);
        showSaveSuccess('');
        maybeAnnounceAllSetsComplete(selectedExercise, nextLoggedSets);
        setPanelResetToken((value) => value + 1);
    }, [draftSession, manualLogState.exercise, manualLogState.sets, maybeAnnounceAllSetsComplete, selectedExercise, setDraftSession, setIsTimerOpen, setPanelResetToken, showSaveSuccess]);

    const handleManualModalClose = useCallback(() => {
        setManualLogState(emptyManualLogState());
        if (selectedExercise) setIsTimerOpen(true);
    }, [selectedExercise, setIsTimerOpen]);

    return {
        manualLogState,
        openManualLog,
        handleManualAddSet,
        handleManualRemoveSet,
        updateManualSet,
        updateManualFormParam,
        handleManualModalSubmit,
        handleManualModalClose,
    };
}
