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
import { useExerciseTimer } from './useExerciseTimer';
import { useTimerAudio } from './useTimerAudio';

export function useTimerSpeech(exercise, isOpen = false, resetToken = 0) {
    const mode = useMemo(() => getExerciseMode(exercise), [exercise]);
    const isSided = exercise?.pattern === 'side';
    const targetReps = useMemo(() => getTargetReps(exercise), [exercise]);
    const targetSeconds = useMemo(() => getTargetSeconds(exercise, mode), [exercise, mode]);
    const [counterValue, setCounterValue] = useState(0);
    const [selectedSide, setSelectedSide] = useState(isSided ? 'right' : null);

    const audio = useTimerAudio();
    const timer = useExerciseTimer({
        mode,
        targetReps,
        targetSeconds,
        isOpen,
        audio,
    });

    useEffect(() => {
        setCounterValue(0);
        setSelectedSide(isSided ? 'right' : null);
    }, [exercise, isOpen, isSided, resetToken]);

    const incrementCounter = useCallback(() => {
        setCounterValue((prev) => {
            const next = prev + 1;
            audio.playBeep(440, 80, 0.25);
            if (targetReps > 0) {
                const repsLeft = targetReps - next;
                if (repsLeft === 5) audio.speakText('5 reps left');
                else if (repsLeft === 3) audio.speakText('3 reps left');
                else if (repsLeft === 1) audio.speakText('Last rep');
                else if (repsLeft === 0) {
                    audio.playCompletionSound();
                    audio.speakText('Set complete');
                }
            }
            return next;
        });
    }, [audio, targetReps]);

    const decrementCounter = useCallback(() => {
        setCounterValue((prev) => Math.max(0, prev - 1));
    }, []);

    const resetCounter = useCallback(() => {
        setCounterValue(0);
    }, []);

    const repInfoText = useMemo(() => getRepInfoText({
        mode,
        counterValue,
        targetReps,
        completedReps: timer.completedReps,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
    }), [counterValue, mode, targetReps, timer.completedReps, timer.currentRep, timer.totalReps]);

    const targetDoseText = useMemo(
        () => getTargetDoseText(exercise, mode, targetReps, targetSeconds),
        [exercise, mode, targetReps, targetSeconds]
    );

    const buildSetPatch = useCallback(() => buildCurrentSetPatch({
        mode,
        counterValue,
        elapsedSeconds: timer.elapsedSeconds,
        targetSeconds,
        targetReps,
        completedReps: timer.completedReps,
        totalReps: timer.totalReps,
        selectedSide,
        distanceFeet: exercise?.distance_feet,
        partialRep: timer.partialRep,
    }), [
        counterValue,
        exercise?.distance_feet,
        mode,
        selectedSide,
        targetReps,
        targetSeconds,
        timer.completedReps,
        timer.elapsedSeconds,
        timer.partialRep,
        timer.totalReps,
    ]);

    const canApplyReps = counterValue > 0;
    const canApplyDuration = mode === 'duration' && timer.elapsedSeconds > 0;
    const canApplyHold = mode === 'hold' && timer.completedReps > 0;
    const canApplyDistance = mode === 'distance' && Number(exercise?.distance_feet ?? 0) > 0;

    return {
        mode,
        isSided,
        selectedSide,
        setSelectedSide,
        counterValue,
        targetReps,
        targetSeconds,
        targetDoseText,
        repInfoText,
        canApply: canApplyReps || canApplyDuration || canApplyHold || canApplyDistance,
        incrementCounter,
        decrementCounter,
        resetCounter,
        buildCurrentSetPatch: buildSetPatch,
        ...timer,
    };
}
