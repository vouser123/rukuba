// components/NextSetConfirmModal.js — confirmation step for app-recorded next-set logging

import styles from './NextSetConfirmModal.module.css';

function formatSummary(exercise, setPatch) {
    if (!exercise || !setPatch) return '';
    const modifiers = exercise.pattern_modifiers ?? [];
    const dosageType = exercise.dosage_type ?? null;
    const isDuration = modifiers.includes('duration_seconds') || dosageType === 'duration';
    const isHold = modifiers.includes('hold_seconds') || dosageType === 'hold';
    const isDistance = modifiers.includes('distance_feet') || dosageType === 'distance';

    if (isDistance) return `${setPatch.distance_feet ?? 0} ft`;
    if (isDuration) return `${setPatch.seconds ?? 0}s (target ${(exercise.seconds_per_set ?? exercise.seconds_per_rep ?? 0)}s)`;
    if (isHold) return `${setPatch.reps ?? 0} reps (target ${exercise.current_reps ?? 0} reps)`;
    return `${setPatch.reps ?? 0} reps (target ${exercise.current_reps ?? 0} reps)`;
}

export default function NextSetConfirmModal({
    isOpen,
    exercise,
    setPatch,
    submitting,
    error,
    onClose,
    onEdit,
    onConfirm,
}) {
    if (!isOpen || !exercise || !setPatch) return null;

    const formData = setPatch.form_data ?? [];

    return (
        <div className={styles.overlay} onPointerUp={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section className={styles.modal} aria-label="Next set confirmation">
                <header className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Next Set</h2>
                        <p className={styles.subtitle}>{exercise.canonical_name}</p>
                    </div>
                    <button className={styles.closeBtn} type="button" onPointerUp={onClose} aria-label="Close">
                        Close
                    </button>
                </header>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.section}>
                    <div className={styles.label}>Logging:</div>
                    <div className={styles.summary}>{formatSummary(exercise, setPatch)}</div>
                </div>

                {formData.length > 0 && (
                    <div className={styles.section}>
                        <div className={styles.label}>Parameters:</div>
                        <div className={styles.params}>
                            {formData.map((param) => (
                                <div key={param.parameter_name} className={styles.paramRow}>
                                    <span>{param.parameter_name.replace(/_/g, ' ')}</span>
                                    <span>{param.parameter_value}{param.parameter_unit ? ` ${param.parameter_unit}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {exercise.pattern === 'side' && setPatch.side && (
                    <div className={styles.side}>Side: {setPatch.side.charAt(0).toUpperCase() + setPatch.side.slice(1)}</div>
                )}

                <footer className={styles.footer}>
                    <button className={styles.secondaryBtn} type="button" onPointerUp={onClose}>Cancel</button>
                    <button className={styles.editBtn} type="button" onPointerUp={onEdit}>Edit</button>
                    <button className={styles.confirmBtn} type="button" onPointerUp={onConfirm} disabled={submitting}>
                        {submitting ? 'Logging...' : 'Log & Next'}
                    </button>
                </footer>
            </section>
        </div>
    );
}
