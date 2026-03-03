// hooks/useSessionLogging.js — session logging state machine for create/update activity logs
import { useCallback, useMemo, useState } from 'react';

function getPatternFlags(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    const dosageType = exercise?.dosage_type ?? null;
    return {
        hasHold: modifiers.includes('hold_seconds') || dosageType === 'hold',
        hasDuration: modifiers.includes('duration_seconds') || dosageType === 'duration',
        hasDistance: modifiers.includes('distance_feet') || dosageType === 'distance',
        isSided: exercise?.pattern === 'side',
    };
}

function inferActivityType(exercise) {
    const { hasHold, hasDuration, hasDistance } = getPatternFlags(exercise);
    if (hasDistance) return 'distance';
    if (hasDuration) return 'duration';
    if (hasHold) return 'hold';
    return 'reps';
}

function nextMutationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `mut-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultSet(exercise, setNumber) {
    const { hasHold, hasDuration, hasDistance, isSided } = getPatternFlags(exercise);
    return {
        set_number: setNumber,
        reps: hasDuration ? 1 : (exercise?.current_reps ?? 1),
        seconds: hasDuration
            ? (exercise?.seconds_per_set ?? 30)
            : (hasHold ? (exercise?.seconds_per_rep ?? 10) : null),
        distance_feet: hasDistance ? (exercise?.distance_feet ?? 20) : null,
        side: isSided ? 'right' : null,
        form_data: null,
        manual_log: true,
        partial_rep: false,
        performed_at: new Date().toISOString(),
    };
}

function normalizeSet(set, index) {
    return {
        set_number: set?.set_number ?? index + 1,
        reps: set?.reps ?? null,
        seconds: set?.seconds ?? null,
        distance_feet: set?.distance_feet ?? null,
        side: set?.side ?? null,
        form_data: Array.isArray(set?.form_data) && set.form_data.length > 0 ? set.form_data : null,
        manual_log: set?.manual_log ?? true,
        partial_rep: set?.partial_rep ?? false,
        performed_at: set?.performed_at ?? new Date().toISOString(),
    };
}

export function useSessionLogging(token, patientId, onSaved, onEnqueue) {
    const [isOpen, setIsOpen] = useState(false);
    const [exercise, setExercise] = useState(null);
    const [logId, setLogId] = useState(null);
    const [performedAt, setPerformedAt] = useState(new Date().toISOString());
    const [notes, setNotes] = useState('');
    const [sets, setSets] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isEdit = useMemo(() => Boolean(logId), [logId]);

    const openCreate = useCallback((selectedExercise) => {
        setExercise(selectedExercise);
        setLogId(null);
        setPerformedAt(new Date().toISOString());
        setNotes('');
        setSets([createDefaultSet(selectedExercise, 1)]);
        setError(null);
        setIsOpen(true);
    }, []);

    const openEdit = useCallback((selectedExercise, log) => {
        setExercise(selectedExercise);
        setLogId(log?.id ?? null);
        setPerformedAt(log?.performed_at ?? new Date().toISOString());
        setNotes(log?.notes ?? '');
        const nextSets = (log?.sets ?? []).map((set, index) => normalizeSet(set, index));
        setSets(nextSets.length > 0 ? nextSets : [createDefaultSet(selectedExercise, 1)]);
        setError(null);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setExercise(null);
        setLogId(null);
        setNotes('');
        setSets([]);
        setError(null);
    }, []);

    const addSet = useCallback(() => {
        setSets((prev) => [...prev, createDefaultSet(exercise, prev.length + 1)]);
    }, [exercise]);

    const removeSet = useCallback((index) => {
        setSets((prev) => {
            const next = prev.filter((_, i) => i !== index);
            return next.map((set, i) => ({ ...set, set_number: i + 1 }));
        });
    }, []);

    const updateSet = useCallback((index, patch) => {
        setSets((prev) => prev.map((set, i) => (i === index ? { ...set, ...patch } : set)));
    }, []);

    const updateFormParam = useCallback((index, paramName, paramValue) => {
        setSets((prev) => prev.map((set, i) => {
            if (i !== index) return set;
            const existing = Array.isArray(set.form_data) ? [...set.form_data] : [];
            const matchIndex = existing.findIndex((item) => item.parameter_name === paramName);
            if (!paramValue) {
                const filtered = existing.filter((item) => item.parameter_name !== paramName);
                return { ...set, form_data: filtered.length > 0 ? filtered : null };
            }
            const nextParam = {
                parameter_name: paramName,
                parameter_value: paramValue,
                parameter_unit: null,
            };
            if (matchIndex >= 0) existing[matchIndex] = nextParam;
            else existing.push(nextParam);
            return { ...set, form_data: existing };
        }));
    }, []);

    const submit = useCallback(async () => {
        if (!token || !patientId || !exercise) return false;
        if (sets.length === 0) {
            setError('Add at least one set before saving.');
            return false;
        }

        setSubmitting(true);
        setError(null);
        try {
            const normalizedSets = sets.map((set, index) => normalizeSet(set, index));

            if (logId) {
                const patchRes = await fetch(`/api/logs?id=${logId}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        performed_at: performedAt,
                        notes: notes || null,
                        sets: normalizedSets,
                    }),
                });
                if (!patchRes.ok) throw new Error(`Failed to update log (${patchRes.status})`);
            } else {
                const clientMutationId = nextMutationId();
                const createPayload = {
                    patient_id: patientId,
                    exercise_id: exercise.id,
                    exercise_name: exercise.canonical_name,
                    activity_type: inferActivityType(exercise),
                    notes: notes || null,
                    performed_at: performedAt,
                    // One mutation id per log submission (API-level idempotency contract).
                    client_mutation_id: clientMutationId,
                    sets: normalizedSets,
                };

                if (typeof navigator !== 'undefined' && navigator.onLine === false && onEnqueue) {
                    onEnqueue(createPayload);
                    if (onSaved) await onSaved();
                    close();
                    return true;
                }

                const createRes = await fetch('/api/logs', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(createPayload),
                });
                if (!createRes.ok) throw new Error(`Failed to create log (${createRes.status})`);
            }

            if (onSaved) await onSaved();
            close();
            return true;
        } catch (err) {
            if (!logId && onEnqueue) {
                const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
                if (isOffline) {
                    const queuedPayload = {
                        patient_id: patientId,
                        exercise_id: exercise.id,
                        exercise_name: exercise.canonical_name,
                        activity_type: inferActivityType(exercise),
                        notes: notes || null,
                        performed_at: performedAt,
                        client_mutation_id: nextMutationId(),
                        sets: sets.map((set, index) => normalizeSet(set, index)),
                    };
                    onEnqueue(queuedPayload);
                    if (onSaved) await onSaved();
                    close();
                    return true;
                }
            }
            setError(err instanceof Error ? err.message : 'Failed to save session log');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [close, exercise, logId, notes, onEnqueue, onSaved, patientId, performedAt, sets, token]);

    return {
        isOpen,
        isEdit,
        exercise,
        performedAt,
        notes,
        sets,
        submitting,
        error,
        openCreate,
        openEdit,
        close,
        setPerformedAt,
        setNotes,
        addSet,
        removeSet,
        updateSet,
        updateFormParam,
        submit,
    };
}
