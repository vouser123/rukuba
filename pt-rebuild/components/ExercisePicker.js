// components/ExercisePicker.js — exercise list/search/select UI with dosage, sort, and manual ordering
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ExercisePicker.module.css';
import NativeSelect from './NativeSelect';
import {
    normalizeManualOrderIds,
    reorderVisibleSubset,
    sortExercises,
} from '../lib/exercise-sort';

const DRAG_HOLD_DELAY_MS = 220;
const DRAG_CANCEL_MOVE_PX = 10;

function formatDosageSummary(exercise, program) {
    const source = program || exercise || {};
    const sets = source.current_sets ?? source.sets ?? 0;
    const reps = source.current_reps ?? source.reps_per_set ?? 0;
    const holdSeconds = source.seconds_per_rep ?? 0;
    const durationSeconds = source.seconds_per_set ?? 0;
    const distanceFeet = source.distance_feet ?? 0;
    const dosageType = source.dosage_type;
    const modifiers = source.pattern_modifiers ?? [];

    const hasDuration = modifiers.includes('duration_seconds') || dosageType === 'duration';
    const hasHold = modifiers.includes('hold_seconds') || dosageType === 'hold';
    const hasDistance = modifiers.includes('distance_feet') || dosageType === 'distance';

    if (hasDistance && distanceFeet > 0) return `${sets > 0 ? `${sets} x ` : ''}${distanceFeet} feet`;
    if (hasDuration && durationSeconds > 0) return `${sets} x ${durationSeconds} sec`;
    if (hasHold && holdSeconds > 0 && reps > 0) return `${sets} x ${reps} reps (${holdSeconds}s hold)`;
    if (reps > 0 && sets > 0) return `${sets} x ${reps} reps`;
    if (sets > 0) return `${sets} set${sets === 1 ? '' : 's'}`;
    return 'No dosage set';
}

function getAdherence(program) {
    if (program?.history_pending) return null;
    if (program?.adherence_text) {
        const suffix = program?.total_sessions > 0
            ? ` · ${program.total_sessions} session${program.total_sessions > 1 ? 's' : ''} total`
            : '';
        return {
            label: `${program.adherence_icon ?? ''}${program.adherence_text}${suffix}`,
            tone: program?.adherence_tone ?? 'gray',
        };
    }
    if (program?.adherence_status === 'done_today') return { label: 'Done today', tone: 'green' };
    if (program?.adherence_status === 'due_soon') return { label: 'Due soon', tone: 'orange' };
    if (program?.adherence_status === 'overdue') return { label: 'Overdue', tone: 'red' };
    if (program?.last_performed_at) return { label: 'Recent activity', tone: 'green' };
    return { label: 'No history', tone: 'gray' };
}

export default function ExercisePicker({
    exercises = [],
    programs = [],
    selectedId = null,
    onSelect,
    sortMode = 'pt_order',
    onSortChange,
    manualOrderIds = [],
    onManualOrderChange,
}) {
    const [query, setQuery] = useState('');
    const [pendingDrag, setPendingDrag] = useState(null);
    const [dragState, setDragState] = useState(null);
    const [previewOrderIds, setPreviewOrderIds] = useState(null);
    const cardRefs = useRef(new Map());
    const dragTargetRef = useRef(null);
    const dragOverlayRef = useRef(null);
    const listRef = useRef(null);
    const pendingTargetRef = useRef(null);

    const programsByExercise = useMemo(() => {
        const map = new Map();
        for (const program of programs) {
            if (program?.exercise_id) map.set(program.exercise_id, program);
        }
        return map;
    }, [programs]);

    const activeManualOrderIds = previewOrderIds ?? manualOrderIds;
    const normalizedManualOrderIds = useMemo(
        () => normalizeManualOrderIds(exercises, activeManualOrderIds),
        [activeManualOrderIds, exercises]
    );

    const visibleExercises = useMemo(() => {
        return sortExercises({
            exercises,
            programsByExercise,
            sortMode,
            query,
            manualOrderIds: activeManualOrderIds,
        });
    }, [activeManualOrderIds, exercises, programsByExercise, query, sortMode]);

    const visibleExerciseIds = useMemo(() => visibleExercises.map((exercise) => exercise.id), [visibleExercises]);
    const isManualMode = sortMode === 'manual';

    function setCardRef(exerciseId, node) {
        if (!node) {
            cardRefs.current.delete(exerciseId);
            return;
        }
        cardRefs.current.set(exerciseId, node);
    }

    function finishDrag(pointerId = dragState?.pointerId) {
        if (!dragState) return;
        if (dragTargetRef.current && dragState.pointerId != null) {
            try {
                dragTargetRef.current.releasePointerCapture?.(pointerId);
            } catch {}
        }
        if (dragOverlayRef.current && dragState.pointerId != null) {
            try {
                dragOverlayRef.current.releasePointerCapture?.(pointerId);
            } catch {}
        }
        dragTargetRef.current = null;

        if (dragState.dragging && previewOrderIds) {
            onManualOrderChange?.(previewOrderIds);
        }

        setDragState(null);
        setPreviewOrderIds(null);
    }

    function handleDragStart(event, exercise) {
        if (!isManualMode) return;
        event.stopPropagation();

        const card = cardRefs.current.get(exercise.id);
        const rect = card?.getBoundingClientRect();
        pendingTargetRef.current = event.currentTarget;
        setPendingDrag({
            pointerId: event.pointerId,
            exerciseId: exercise.id,
            exerciseName: exercise.canonical_name,
            dosageText: formatDosageSummary(exercise, programsByExercise.get(exercise.id) ?? null),
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            offsetX: rect ? event.clientX - rect.left : 24,
            offsetY: rect ? event.clientY - rect.top : 24,
            width: rect?.width ?? 0,
        });
        setPreviewOrderIds(null);
    }

    function cancelPendingDrag() {
        pendingTargetRef.current = null;
        setPendingDrag(null);
    }

    function handleDragMove(event) {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        if (event.cancelable) event.preventDefault();

        const nextX = event.clientX;
        const nextY = event.clientY;
        const listRect = listRef.current?.getBoundingClientRect();

        if (!listRect
            || nextX < listRect.left - 24
            || nextX > listRect.right + 24
            || nextY < listRect.top
            || nextY > listRect.bottom) {
            setPreviewOrderIds(null);
            setDragState((previous) => previous ? {
                ...previous,
                dragging: true,
                x: nextX,
                y: nextY,
            } : previous);
            return;
        }

        const currentOrderIds = previewOrderIds ?? normalizedManualOrderIds;

        const sourceIndex = visibleExerciseIds.indexOf(dragState.exerciseId);
        let targetIndex = visibleExerciseIds.length - 1;

        for (let index = 0; index < visibleExerciseIds.length; index += 1) {
            const id = visibleExerciseIds[index];
            const rect = cardRefs.current.get(id)?.getBoundingClientRect();
            if (!rect) continue;
            if (nextY < rect.top + rect.height / 2) {
                targetIndex = index;
                break;
            }
        }

        const nextPreviewOrderIds = reorderVisibleSubset(
            currentOrderIds,
            visibleExerciseIds,
            sourceIndex,
            targetIndex
        );
        setPreviewOrderIds(nextPreviewOrderIds);

        setDragState((previous) => previous ? {
            ...previous,
            dragging: true,
            x: nextX,
            y: nextY,
        } : previous);
    }

    function handleDragEnd(event) {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        finishDrag(event.pointerId);
    }

    useEffect(() => {
        if (!pendingDrag) return;

        const activationTimer = window.setTimeout(() => {
            dragTargetRef.current = pendingTargetRef.current;
            try {
                dragTargetRef.current?.setPointerCapture?.(pendingDrag.pointerId);
            } catch {}
            setDragState({
                dragging: true,
                ...pendingDrag,
            });
            setPendingDrag(null);
        }, DRAG_HOLD_DELAY_MS);

        function handlePendingMove(event) {
            if (event.pointerId !== pendingDrag.pointerId) return;
            const dx = event.clientX - pendingDrag.startX;
            const dy = event.clientY - pendingDrag.startY;
            const distance = Math.hypot(dx, dy);

            if (distance > DRAG_CANCEL_MOVE_PX) {
                window.clearTimeout(activationTimer);
                cancelPendingDrag();
            }
        }

        function handlePendingEnd(event) {
            if (event.pointerId !== pendingDrag.pointerId) return;
            window.clearTimeout(activationTimer);
            cancelPendingDrag();
        }

        window.addEventListener('pointermove', handlePendingMove, { passive: true });
        window.addEventListener('pointerup', handlePendingEnd);
        window.addEventListener('pointercancel', handlePendingEnd);

        return () => {
            window.clearTimeout(activationTimer);
            window.removeEventListener('pointermove', handlePendingMove);
            window.removeEventListener('pointerup', handlePendingEnd);
            window.removeEventListener('pointercancel', handlePendingEnd);
        };
    }, [pendingDrag]);

    useEffect(() => {
        if (!dragState) return;
        const { body, documentElement } = document;
        const previousBodyTouchAction = body.style.touchAction;
        const previousBodyUserSelect = body.style.userSelect;
        const previousHtmlTouchAction = documentElement.style.touchAction;
        body.style.touchAction = 'none';
        body.style.userSelect = 'none';
        documentElement.style.touchAction = 'none';
        if (dragOverlayRef.current) {
            try {
                dragOverlayRef.current.setPointerCapture?.(dragState.pointerId);
            } catch {}
        }

        window.addEventListener('pointermove', handleDragMove, { passive: false });
        window.addEventListener('pointerup', handleDragEnd);
        window.addEventListener('pointercancel', handleDragEnd);

        return () => {
            body.style.touchAction = previousBodyTouchAction;
            body.style.userSelect = previousBodyUserSelect;
            documentElement.style.touchAction = previousHtmlTouchAction;
            window.removeEventListener('pointermove', handleDragMove);
            window.removeEventListener('pointerup', handleDragEnd);
            window.removeEventListener('pointercancel', handleDragEnd);
        };
    }, [dragState, handleDragEnd, handleDragMove]);

    return (
        <section className={styles.panel} aria-label="Exercise picker">
            <div className={styles.controls}>
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className={styles.search}
                    placeholder="Search exercises"
                    aria-label="Search exercises"
                />
                <NativeSelect
                    value={sortMode}
                    onChange={(val) => onSortChange?.(val)}
                    options={[
                        { value: 'pt_order',  label: 'PT order' },
                        { value: 'manual',    label: 'Manual' },
                        { value: 'body_area', label: 'Body area' },
                        { value: 'recent',    label: 'Recent activity' },
                        { value: 'alpha',     label: 'A to Z' },
                    ]}
                    className={styles.sortSelect}
                />
            </div>

            {visibleExercises.length === 0 && (
                <div className={styles.empty}>No exercises found.</div>
            )}

            <div ref={listRef} className={styles.list}>
                {visibleExercises.map((exercise) => {
                    const program = programsByExercise.get(exercise.id) ?? null;
                    const adherence = getAdherence(program);
                    const isSelected = exercise.id === selectedId;
                    const category = exercise.pt_category ?? '';
                    const isDragging = dragState?.dragging && dragState.exerciseId === exercise.id;
                    const isPendingDrag = pendingDrag?.exerciseId === exercise.id;

                    return (
                        <div
                            key={exercise.id}
                            ref={(node) => setCardRef(exercise.id, node)}
                            className={`${styles.card} ${isSelected ? styles.selected : ''} ${(isDragging || isPendingDrag) ? styles.dragPlaceholder : ''}`}
                        >
                            <button
                                className={styles.cardButton}
                                onPointerUp={() => {
                                    if (dragState?.dragging) return;
                                    onSelect?.(exercise.id);
                                }}
                                aria-pressed={isSelected}
                                type="button"
                            >
                                <span className={styles.name}>{exercise.canonical_name}</span>
                                <span className={styles.dosage}>{formatDosageSummary(exercise, program)}</span>
                                {adherence && (
                                    <span className={`${styles.adherence} ${styles[adherence.tone]}`}>
                                        {adherence.label}
                                    </span>
                                )}
                                {category && <span className={styles.tag}>{category}</span>}
                            </button>
                            {isManualMode && (
                                <button
                                    type="button"
                                    className={styles.dragHandle}
                                    aria-label={`Reorder ${exercise.canonical_name}`}
                                    onPointerDown={(event) => handleDragStart(event, exercise)}
                                >
                                    <span className={styles.dragGrip} aria-hidden="true">
                                        <span className={styles.dragDot} />
                                        <span className={styles.dragDot} />
                                        <span className={styles.dragDot} />
                                        <span className={styles.dragDot} />
                                        <span className={styles.dragDot} />
                                        <span className={styles.dragDot} />
                                    </span>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {dragState?.dragging && (
                <>
                    <div
                        ref={dragOverlayRef}
                        className={styles.dragOverlay}
                        aria-hidden="true"
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd}
                        onPointerCancel={handleDragEnd}
                    />
                    <div
                        className={styles.dragGhost}
                        style={{
                            left: `${dragState.x - dragState.offsetX}px`,
                            top: `${dragState.y - dragState.offsetY}px`,
                            width: dragState.width ? `${dragState.width}px` : undefined,
                        }}
                        aria-hidden="true"
                    >
                        <span className={styles.name}>{dragState.exerciseName}</span>
                        <span className={styles.dosage}>{dragState.dosageText}</span>
                    </div>
                </>
            )}
        </section>
    );
}
