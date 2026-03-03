// components/ExercisePicker.js — exercise list/search/select UI with dosage and adherence summary
import { useMemo, useState } from 'react';
import styles from './ExercisePicker.module.css';

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
}) {
    const [query, setQuery] = useState('');

    const programsByExercise = useMemo(() => {
        const map = new Map();
        for (const program of programs) {
            if (program?.exercise_id) map.set(program.exercise_id, program);
        }
        return map;
    }, [programs]);

    const visibleExercises = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = exercises.filter((exercise) => {
            if (exercise?.archived) return false;
            if (!q) return true;
            const name = exercise?.canonical_name ?? '';
            return name.toLowerCase().includes(q);
        });

        const sorted = [...filtered];
        const byName = (a, b) => (a?.canonical_name ?? '').localeCompare(b?.canonical_name ?? '');

        if (sortMode === 'alpha') {
            sorted.sort(byName);
            return sorted;
        }

        if (sortMode === 'body_area') {
            sorted.sort((a, b) => {
                const aCategory = a?.pt_category ?? '';
                const bCategory = b?.pt_category ?? '';
                const byCategory = aCategory.localeCompare(bCategory);
                if (byCategory !== 0) return byCategory;
                return byName(a, b);
            });
            return sorted;
        }

        if (sortMode === 'recent') {
            sorted.sort((a, b) => {
                const aProgram = programsByExercise.get(a.id) ?? null;
                const bProgram = programsByExercise.get(b.id) ?? null;
                const aDays = aProgram?.adherence_days_since;
                const bDays = bProgram?.adherence_days_since;
                const aValue = Number.isFinite(aDays) ? aDays : Number.POSITIVE_INFINITY;
                const bValue = Number.isFinite(bDays) ? bDays : Number.POSITIVE_INFINITY;
                if (aValue !== bValue) return aValue - bValue;
                return byName(a, b);
            });
            return sorted;
        }

        // pt_order/manual keep incoming order for now (drag-and-drop handled in DN-050).
        return sorted;
    }, [exercises, programsByExercise, query, sortMode]);

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
                <select
                    value={sortMode}
                    onChange={(event) => onSortChange?.(event.target.value)}
                    className={styles.sortSelect}
                    aria-label="Sort mode"
                >
                    <option value="pt_order">PT order</option>
                    <option value="manual">Manual</option>
                    <option value="body_area">Body area</option>
                    <option value="recent">Recent activity</option>
                    <option value="alpha">A to Z</option>
                </select>
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

                    return (
                        <button
                            key={exercise.id}
                            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                            onPointerUp={() => onSelect?.(exercise.id)}
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
                    );
                })}
            </div>
        </section>
    );
}
