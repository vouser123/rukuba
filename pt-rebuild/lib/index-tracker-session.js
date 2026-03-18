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
    const leftCount = acceptedSets.filter((set) => set?.side === 'left').length;
    const rightCount = acceptedSets.filter((set) => set?.side === 'right').length;
    return {
        targetSets,
        totalLogged: acceptedSets.length,
        leftCount,
        rightCount,
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
