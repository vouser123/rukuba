// components/ExercisePicker.js — exercise list/search/select UI with dosage, sort, and manual ordering
import { useMemo, useRef, useState } from 'react';
import styles from './ExercisePicker.module.css';
import NativeSelect from './NativeSelect';
import {
    normalizeManualOrderIds,
    reorderVisibleSubset,
    sortExercises,
} from '../lib/exercise-sort';

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
    const [dragState, setDragState] = useState(null);
    const [previewOrderIds, setPreviewOrderIds] = useState(null);
    const cardRefs = useRef(new Map());

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

    function finishDrag(pointerTarget) {
        if (!dragState) return;
        if (pointerTarget && dragState.pointerId != null) {
            try {
                pointerTarget.releasePointerCapture?.(dragState.pointerId);
            } catch {}
        }

        if (dragState.dragging && previewOrderIds) {
            onManualOrderChange?.(previewOrderIds);
        }

        setDragState(null);
        setPreviewOrderIds(null);
    }

    function handleDragStart(event, exercise) {
        if (!isManualMode) return;
        event.preventDefault();
        event.stopPropagation();

        const card = cardRefs.current.get(exercise.id);
        const rect = card?.getBoundingClientRect();

        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragState({
            dragging: false,
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

    function handleDragMove(event) {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        event.preventDefault();
        event.stopPropagation();

        const nextX = event.clientX;
        const nextY = event.clientY;
        const distance = Math.hypot(nextX - dragState.startX, nextY - dragState.startY);
        const nowDragging = dragState.dragging || distance > 6;
        const currentOrderIds = previewOrderIds ?? normalizedManualOrderIds;

        let nextPreviewOrderIds = previewOrderIds;
        if (nowDragging) {
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

            nextPreviewOrderIds = reorderVisibleSubset(
                currentOrderIds,
                visibleExerciseIds,
                sourceIndex,
                targetIndex
            );
            setPreviewOrderIds(nextPreviewOrderIds);
        }

        setDragState((previous) => previous ? {
            ...previous,
            dragging: nowDragging,
            x: nextX,
            y: nextY,
        } : previous);
    }

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

            <div className={styles.list}>
                {visibleExercises.map((exercise) => {
                    const program = programsByExercise.get(exercise.id) ?? null;
                    const adherence = getAdherence(program);
                    const isSelected = exercise.id === selectedId;
                    const category = exercise.pt_category ?? '';
                    const isDragging = dragState?.dragging && dragState.exerciseId === exercise.id;

                    return (
                        <div
                            key={exercise.id}
                            ref={(node) => setCardRef(exercise.id, node)}
                            className={`${styles.card} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragPlaceholder : ''}`}
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
                                <span className={`${styles.adherence} ${styles[adherence.tone]}`}>
                                    {adherence.label}
                                </span>
                                {category && <span className={styles.tag}>{category}</span>}
                            </button>
                            {isManualMode && (
                                <button
                                    type="button"
                                    className={styles.dragHandle}
                                    aria-label={`Reorder ${exercise.canonical_name}`}
                                    onPointerDown={(event) => handleDragStart(event, exercise)}
                                    onPointerMove={handleDragMove}
                                    onPointerUp={(event) => finishDrag(event.currentTarget)}
                                    onPointerCancel={(event) => finishDrag(event.currentTarget)}
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
            )}
        </section>
    );
}
