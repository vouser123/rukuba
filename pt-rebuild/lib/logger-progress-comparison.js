// lib/logger-progress-comparison.js — pure helpers for delayed post-set progress comparison speech

function getExerciseMatch(log, exercise) {
    if (!log || !exercise) return false;
    return log.exercise_id === exercise.id || log.exercise_name === exercise.canonical_name;
}

function normalizeReps(value) {
    return Math.max(0, Number(value ?? 0) || 0);
}

function getComparableSets(sets, selectedSide = null) {
    return (Array.isArray(sets) ? sets : []).filter((set) => {
        if (!selectedSide) return true;
        return set?.side === selectedSide;
    });
}

function getSessionMetrics(sets) {
    const reps = sets.map((set) => normalizeReps(set?.reps));
    return {
        bestSetReps: reps.length > 0 ? Math.max(...reps) : 0,
        totalReps: reps.reduce((sum, value) => sum + value, 0),
    };
}

export function getProgressComparison(logs, exercise, currentSessionSets, selectedSide = null, sessionStartedAt = null) {
    if (!exercise) return null;

    const currentSets = getComparableSets(currentSessionSets, selectedSide);
    if (currentSets.length === 0) return null;

    const priorLog = (Array.isArray(logs) ? logs : [])
        .filter((log) => getExerciseMatch(log, exercise))
        .filter((log) => {
            if (!sessionStartedAt) return true;
            return new Date(log?.performed_at ?? 0) < new Date(sessionStartedAt);
        })
        .sort((a, b) => new Date(b?.performed_at ?? 0) - new Date(a?.performed_at ?? 0))
        .find((log) => getComparableSets(log?.sets, selectedSide).length > 0);

    if (!priorLog) return null;

    const currentMetrics = getSessionMetrics(currentSets);
    const priorMetrics = getSessionMetrics(getComparableSets(priorLog.sets, selectedSide));

    if (currentMetrics.bestSetReps > priorMetrics.bestSetReps) {
        const diff = currentMetrics.bestSetReps - priorMetrics.bestSetReps;
        return {
            type: 'best-set-improvement',
            text: `${diff} more rep${diff === 1 ? '' : 's'} than your best set last time`,
        };
    }

    if (currentMetrics.totalReps < priorMetrics.totalReps) {
        const diff = priorMetrics.totalReps - currentMetrics.totalReps;
        return {
            type: 'total-volume-drop',
            text: `${diff} fewer total reps than last time`,
        };
    }

    if (currentMetrics.totalReps > priorMetrics.totalReps) {
        const diff = currentMetrics.totalReps - priorMetrics.totalReps;
        return {
            type: 'total-volume-improvement',
            text: `${diff} more total reps than last time`,
        };
    }

    return null;
}
