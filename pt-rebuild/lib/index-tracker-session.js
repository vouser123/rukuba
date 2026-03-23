// lib/index-tracker-session.js — pure helpers for index tracker draft-session state and finalization

function createSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `mut-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDraftSession(exercise, activityType) {
    const startedAt = new Date().toISOString();
    return {
        sessionId: createSessionId(),
        exerciseId: exercise.id,
        exerciseName: exercise.canonical_name,
        activityType,
        date: startedAt,
        notes: null,
        sets: [],
    };
}

export function buildSessionProgress(exercise, acceptedSets) {
    const targetSets = Number(exercise?.current_sets ?? 0) || 0;
    const isSided = exercise?.pattern === 'side';
    const leftCount = acceptedSets.filter((set) => set?.side === 'left').length;
    const rightCount = acceptedSets.filter((set) => set?.side === 'right').length;
    const leftRemaining = isSided ? Math.max(0, targetSets - leftCount) : 0;
    const rightRemaining = isSided ? Math.max(0, targetSets - rightCount) : 0;
    const totalLogged = acceptedSets.length;
    const totalTargetSets = isSided ? targetSets * 2 : targetSets;
    const totalRemaining = isSided
        ? leftRemaining + rightRemaining
        : Math.max(0, targetSets - totalLogged);
    const allComplete = isSided
        ? targetSets > 0 && leftRemaining === 0 && rightRemaining === 0
        : targetSets > 0 && totalRemaining === 0;

    return {
        isSided,
        allComplete,
        targetSets,
        totalLogged,
        totalTargetSets,
        totalRemaining,
        leftCount,
        rightCount,
        leftRemaining,
        rightRemaining,
    };
}

export function buildOptimisticLogEntry(session) {
    return {
        id: session.sessionId,
        exercise_id: session.exerciseId,
        exercise_name: session.exerciseName,
        performed_at: session.date,
        notes: session.notes,
        sets: session.sets,
        client_mutation_id: session.sessionId,
    };
}

export function toLocalDateTimeInputValue(isoValue) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
}
