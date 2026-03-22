// hooks/useTimerSpeech.js — execution-state hook for the tracker logger panel

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    buildCurrentSetPatch,
    getExerciseMode,
    getRepInfoText,
    getTargetDoseText,
    getTargetReps,
    getTargetSeconds,
} from '../lib/timer-panel';
import {
    applyLoggerTimerEvent,
    createLoggerTimerState,
    getCanApply,
} from '../lib/logger-timer-machine';
import { useExerciseTimer } from './useExerciseTimer';
import { useTimerAudio } from './useTimerAudio';

export function useTimerSpeech(exercise, isOpen = false, resetToken = 0, sessionProgress = null) {
    const mode = useMemo(() => getExerciseMode(exercise), [exercise]);
    const isSided = exercise?.pattern === 'side';
    const exerciseId = exercise?.id ?? null;
    const targetReps = useMemo(() => getTargetReps(exercise), [exercise]);
    const targetSeconds = useMemo(() => getTargetSeconds(exercise, mode), [exercise, mode]);
    const audio = useTimerAudio();
    const [executionState, setExecutionState] = useState(() => createLoggerTimerState({
        mode,
        targetReps,
        targetSeconds,
        isSided,
        selectedSide: isSided ? 'right' : null,
    }));
    const getDurationCompletionSpeech = useCallback(() => {
        const targetSets = Number(sessionProgress?.targetSets ?? 0) || 0;
        if (targetSets <= 0) return 'Set complete';

        if (isSided && executionState.selectedSide) {
            const currentSideCount = executionState.selectedSide === 'left'
                ? Number(sessionProgress?.leftCount ?? 0) || 0
                : Number(sessionProgress?.rightCount ?? 0) || 0;
            const completedSetNumber = Math.min(currentSideCount + 1, targetSets);
            return `Set ${completedSetNumber} of ${targetSets} complete for ${executionState.selectedSide} side`;
        }

        const currentTotal = Number(sessionProgress?.totalLogged ?? 0) || 0;
        const completedSetNumber = Math.min(currentTotal + 1, targetSets);
        return `Set ${completedSetNumber} of ${targetSets} complete`;
    }, [
        executionState.selectedSide,
        isSided,
        sessionProgress?.leftCount,
        sessionProgress?.rightCount,
        sessionProgress?.targetSets,
        sessionProgress?.totalLogged,
    ]);
    const timer = useExerciseTimer({
        mode,
        targetReps,
        targetSeconds,
        isOpen,
        resetToken,
        audio,
        getDurationCompletionSpeech,
    });

    useEffect(() => {
        setExecutionState((previous) => {
            const preservedSide = isSided && previous?.selectedSide && previous?.exerciseId === exerciseId
                ? previous.selectedSide
                : (isSided ? 'right' : null);
            return {
                ...createLoggerTimerState({
                    mode,
                    targetReps,
                    targetSeconds,
                    isSided,
                    selectedSide: preservedSide,
                }),
                exerciseId,
            };
        });
    }, [exerciseId, isOpen, isSided, mode, resetToken, targetReps, targetSeconds]);

    const dispatchExecutionEvent = useCallback((event) => {
        setExecutionState((prev) => {
            const { state, effects } = applyLoggerTimerEvent(prev, event);
            audio.executeEffects(effects);
            return state;
        });
    }, [audio]);

    const incrementCounter = useCallback(() => {
        dispatchExecutionEvent({ type: 'INCREMENT_COUNTER' });
    }, [dispatchExecutionEvent]);

    const decrementCounter = useCallback(() => {
        dispatchExecutionEvent({ type: 'DECREMENT_COUNTER' });
    }, [dispatchExecutionEvent]);

    const resetCounter = useCallback(() => {
        setExecutionState((prev) => ({
            ...prev,
            counterValue: 0,
            partialRep: false,
        }));
    }, []);

    const handleSetSelectedSide = useCallback((side) => {
        dispatchExecutionEvent({ type: 'SELECT_SIDE', side });
    }, [dispatchExecutionEvent]);

    const repInfoText = useMemo(() => getRepInfoText({
        mode,
        counterValue: executionState.counterValue,
        targetReps,
        completedReps: timer.completedReps,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
    }), [executionState.counterValue, mode, targetReps, timer.completedReps, timer.currentRep, timer.totalReps]);

    const targetDoseText = useMemo(
        () => getTargetDoseText(exercise, mode, targetReps, targetSeconds),
        [exercise, mode, targetReps, targetSeconds]
    );

    const buildSetPatch = useCallback(() => buildCurrentSetPatch({
        mode,
        counterValue: executionState.counterValue,
        elapsedSeconds: timer.elapsedSeconds,
        targetSeconds,
        targetReps,
        completedReps: timer.completedReps,
        totalReps: timer.totalReps,
        selectedSide: executionState.selectedSide,
        distanceFeet: exercise?.distance_feet,
        partialRep: false,
    }), [
        executionState.counterValue,
        executionState.selectedSide,
        exercise?.distance_feet,
        mode,
        targetReps,
        targetSeconds,
        timer.completedReps,
        timer.elapsedSeconds,
        timer.totalReps,
    ]);
    const canApply = useMemo(() => getCanApply({
        ...executionState,
        elapsedMs: timer.elapsedSeconds * 1000,
        completedReps: timer.completedReps,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
    }, exercise?.distance_feet), [
        executionState,
        exercise?.distance_feet,
        timer.completedReps,
        timer.currentRep,
        timer.elapsedSeconds,
        timer.totalReps,
    ]);

    return {
        mode,
        isSided,
        selectedSide: executionState.selectedSide,
        setSelectedSide: handleSetSelectedSide,
        counterValue: executionState.counterValue,
        targetReps,
        targetSeconds,
        targetDoseText,
        repInfoText,
        canApply,
        incrementCounter,
        decrementCounter,
        resetCounter,
        buildCurrentSetPatch: buildSetPatch,
        ...timer,
    };
}
