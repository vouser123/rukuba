// components/SessionLoggerModal.js — modal UI for create/update session logs with per-set fields
import styles from './SessionLoggerModal.module.css';

function shouldShowSeconds(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    return modifiers.includes('hold_seconds')
        || modifiers.includes('duration_seconds')
        || exercise?.dosage_type === 'hold'
        || exercise?.dosage_type === 'duration';
}

function shouldShowDistance(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    return modifiers.includes('distance_feet') || exercise?.dosage_type === 'distance';
}

export default function SessionLoggerModal({
    isOpen,
    isEdit,
    exercise,
    performedAt,
    notes,
    sets,
    submitting,
    error,
    onClose,
    onPerformedAtChange,
    onNotesChange,
    onAddSet,
    onRemoveSet,
    onSetChange,
    onFormParamChange,
    onSubmit,
}) {
    if (!isOpen || !exercise) return null;

    const formParams = exercise.form_parameters_required ?? [];
    const showSeconds = shouldShowSeconds(exercise);
    const showDistance = shouldShowDistance(exercise);
    const isSided = exercise.pattern === 'side';

    return (
        <div className={styles.overlay} onPointerUp={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section className={styles.modal} aria-label="Session logger">
                <header className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{isEdit ? 'Edit Session' : 'Log Session'}</h2>
                        <p className={styles.subtitle}>{exercise.canonical_name}</p>
                    </div>
                    <button className={styles.closeBtn} onPointerUp={onClose} type="button" aria-label="Close">
                        Close
                    </button>
                </header>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.metaRow}>
                    <label className={styles.fieldLabel}>
                        Performed At
                        <input
                            className={styles.input}
                            type="datetime-local"
                            value={performedAt ? new Date(performedAt).toISOString().slice(0, 16) : ''}
                            onChange={(event) => onPerformedAtChange(new Date(event.target.value).toISOString())}
                        />
                    </label>
                </div>

                <div className={styles.setList}>
                    {sets.map((set, index) => (
                        <div key={`${set.set_number}-${index}`} className={styles.setCard}>
                            <div className={styles.setHeader}>
                                <h3 className={styles.setTitle}>Set {index + 1}</h3>
                                <button
                                    className={styles.removeBtn}
                                    onPointerUp={() => onRemoveSet(index)}
                                    type="button"
                                    disabled={sets.length === 1}
                                >
                                    Remove
                                </button>
                            </div>

                            <div className={styles.fieldGrid}>
                                <label className={styles.fieldLabel}>
                                    Reps
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="0"
                                        value={set.reps ?? ''}
                                        onChange={(event) => onSetChange(index, { reps: Number(event.target.value || 0) || null })}
                                    />
                                </label>
                                {showSeconds && (
                                    <label className={styles.fieldLabel}>
                                        Seconds
                                        <input
                                            className={styles.input}
                                            type="number"
                                            min="0"
                                            value={set.seconds ?? ''}
                                            onChange={(event) => onSetChange(index, { seconds: Number(event.target.value || 0) || null })}
                                        />
                                    </label>
                                )}
                                {showDistance && (
                                    <label className={styles.fieldLabel}>
                                        Distance (ft)
                                        <input
                                            className={styles.input}
                                            type="number"
                                            min="0"
                                            value={set.distance_feet ?? ''}
                                            onChange={(event) => onSetChange(index, { distance_feet: Number(event.target.value || 0) || null })}
                                        />
                                    </label>
                                )}
                                {isSided && (
                                    <label className={styles.fieldLabel}>
                                        Side
                                        <select
                                            className={styles.select}
                                            value={set.side ?? 'right'}
                                            onChange={(event) => onSetChange(index, { side: event.target.value })}
                                        >
                                            <option value="left">Left</option>
                                            <option value="right">Right</option>
                                            <option value="both">Both</option>
                                        </select>
                                    </label>
                                )}
                            </div>

                            {formParams.length > 0 && (
                                <div className={styles.formDataGrid}>
                                    {formParams.map((paramName) => {
                                        const existing = (set.form_data ?? []).find((item) => item.parameter_name === paramName);
                                        return (
                                            <label key={paramName} className={styles.fieldLabel}>
                                                {paramName.replace(/_/g, ' ')}
                                                <input
                                                    className={styles.input}
                                                    type="text"
                                                    value={existing?.parameter_value ?? ''}
                                                    onChange={(event) => onFormParamChange(index, paramName, event.target.value.trim())}
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <label className={styles.fieldLabel}>
                    Notes
                    <textarea
                        className={styles.textarea}
                        rows={3}
                        value={notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        placeholder="Optional notes"
                    />
                </label>

                <footer className={styles.footer}>
                    <button className={styles.secondaryBtn} onPointerUp={onAddSet} type="button">
                        Add Set
                    </button>
                    <button className={styles.primaryBtn} onPointerUp={onSubmit} type="button" disabled={submitting}>
                        {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Finish Session')}
                    </button>
                </footer>
            </section>
        </div>
    );
}
