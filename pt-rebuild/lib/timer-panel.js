// lib/timer-panel.js — pure helpers for tracker timer/counter execution state

export function getExerciseMode(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    const dosageType = exercise?.dosage_type ?? null;

    if (modifiers.includes('distance_feet') || dosageType === 'distance') return 'distance';
    if (modifiers.includes('duration_seconds') || dosageType === 'duration') return 'duration';
    if (modifiers.includes('hold_seconds') || dosageType === 'hold') return 'hold';
    return 'reps';
}

export function getTargetReps(exercise) {
    return Number(exercise?.current_reps ?? 0) || 0;
}

export function getTargetSeconds(exercise, mode) {
    if (mode === 'duration') {
        return Number(exercise?.seconds_per_set ?? exercise?.seconds_per_rep ?? 60) || 60;
    }
    return Number(exercise?.seconds_per_rep ?? 10) || 10;
}

export function createInitialTimerState(targetReps) {
    return {
        isRunning: false,
        elapsedMs: 0,
        currentRep: 1,
        totalReps: Math.max(1, targetReps || 1),
        completedReps: 0,
        lastAnnouncedSecond: null,
    };
}

export function formatTimerDisplay(remainingSeconds) {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getRepInfoText({
    mode,
    counterValue,
    targetReps,
    completedReps,
    currentRep,
    totalReps,
}) {
    if (mode === 'duration') return 'Duration Exercise';
    if (mode === 'hold') {
        if (completedReps >= totalReps) return 'Set complete';
        return `Rep ${currentRep} of ${totalReps}`;
    }
    return targetReps > 0 ? `${counterValue} / ${targetReps} reps` : `${counterValue} reps`;
}

export function getTargetDoseText(exercise, mode, targetReps, targetSeconds) {
    if (mode === 'distance') {
        return `${Number(exercise?.distance_feet ?? 0) || 0} ft`;
    }
    if (mode === 'duration') {
        return `${targetSeconds}s`;
    }
    if (mode === 'hold') {
        return `${targetReps} reps × ${targetSeconds}s hold`;
    }
    return `${targetReps} reps`;
}

export function buildCurrentSetPatch({
    mode,
    counterValue,
    elapsedSeconds,
    targetSeconds,
    targetReps,
    completedReps,
    totalReps,
    selectedSide,
    distanceFeet,
    partialRep = false,
}) {
    if (mode === 'distance') {
        return {
            reps: null,
            seconds: null,
            distance_feet: Number(distanceFeet ?? 0) || null,
            side: selectedSide,
            manual_log: false,
            partial_rep: false,
        };
    }

    if (mode === 'duration') {
        return {
            reps: 1,
            seconds: elapsedSeconds > 0 ? elapsedSeconds : targetSeconds,
            distance_feet: null,
            side: selectedSide,
            manual_log: false,
            partial_rep: false,
        };
    }

    if (mode === 'hold') {
        const repsDone = Math.min(completedReps, totalReps);
        return {
            reps: repsDone > 0 ? repsDone : null,
            seconds: targetSeconds,
            distance_feet: null,
            side: selectedSide,
            manual_log: false,
            partial_rep: partialRep,
        };
    }

    return {
        reps: counterValue > 0 ? counterValue : (targetReps || null),
        seconds: null,
        distance_feet: null,
        side: selectedSide,
        manual_log: false,
        partial_rep: false,
    };
}
