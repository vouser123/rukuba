// hooks/useSessionLogging.js — session logging state machine for create/update activity logs
import { useCallback, useMemo, useState } from 'react';
import { buildCreatePayload, createDefaultSet, inferActivityType, normalizeSet } from '../lib/session-logging';

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

    const openCreateWithSeedSet = useCallback((selectedExercise, seedPatch) => {
        setExercise(selectedExercise);
        setLogId(null);
        setPerformedAt(new Date().toISOString());
        setNotes('');
        setSets([{ ...createDefaultSet(selectedExercise, 1), ...(seedPatch ?? {}), set_number: 1 }]);
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

    const updateFormParam = useCallback((index, paramName, paramValue, paramUnit = null) => {
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
                parameter_unit: paramUnit,
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
            const activityType = inferActivityType(exercise);
            const normalizedSets = sets.map((set, index) => normalizeSet(set, index, activityType));

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
                const createPayload = buildCreatePayload(exercise, performedAt, notes, normalizedSets);

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
                if (createRes.status === 409) {
                    // Idempotency duplicate — treat as success.
                } else if (!createRes.ok) {
                    throw new Error(`Failed to create log (${createRes.status})`);
                }
            }

            if (onSaved) await onSaved();
            close();
            return true;
        } catch (err) {
            if (!logId && onEnqueue) {
                const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
                const isNetworkFailure = err instanceof Error && /failed to fetch/i.test(err.message);
                if (isOffline || isNetworkFailure) {
                    const queuedPayload = {
                        // DN-059: omit patient_id — API uses req.user.id (profile UUID) via fallback.
                        exercise_id: exercise.id,
                        exercise_name: exercise.canonical_name,
                        activity_type: inferActivityType(exercise),
                        notes: notes || null,
                        performed_at: performedAt,
                        sets: sets.map((set, index) => normalizeSet(set, index, inferActivityType(exercise))),
                    };
                    Object.assign(queuedPayload, buildCreatePayload(exercise, performedAt, notes, queuedPayload.sets));
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

    const submitSeedSet = useCallback(async (selectedExercise, seedSet, options = {}) => {
        if (!token || !patientId || !selectedExercise) return false;
        const performedAtValue = options.performedAt ?? new Date().toISOString();
        const payload = buildCreatePayload(
            selectedExercise,
            performedAtValue,
            options.notes ?? '',
            [{ ...createDefaultSet(selectedExercise, 1), ...(seedSet ?? {}), set_number: 1, performed_at: performedAtValue }]
        );

        setSubmitting(true);
        setError(null);
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false && onEnqueue) {
                onEnqueue(payload);
                if (onSaved) await onSaved();
                return true;
            }

            const createRes = await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (createRes.status !== 409 && !createRes.ok) {
                throw new Error(`Failed to create log (${createRes.status})`);
            }

            if (onSaved) await onSaved();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save session log');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [onEnqueue, onSaved, patientId, token]);

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
        openCreateWithSeedSet,
        openEdit,
        close,
        setPerformedAt,
        setNotes,
        addSet,
        removeSet,
        updateSet,
        updateFormParam,
        submit,
        submitSeedSet,
    };
}
