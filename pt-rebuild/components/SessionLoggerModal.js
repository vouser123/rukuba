// components/SessionLoggerModal.js — modal UI for create/update session logs with per-set fields
import { useEffect, useState } from 'react';
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

function shouldShowReps(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    const isDuration = modifiers.includes('duration_seconds') || exercise?.dosage_type === 'duration';
    const isDistance = modifiers.includes('distance_feet') || exercise?.dosage_type === 'distance';
    return !isDuration && !isDistance;
}

function parameterOptions(paramName) {
    if (paramName === 'weight') return ['lb', 'kg'];
    if (paramName === 'distance') return ['ft', 'in', 'cm', 'deg'];
    return [];
}

function toLocalDateTimeInputValue(isoValue) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
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
    historicalFormParams = {},
}) {
    const [customModes, setCustomModes] = useState({});

    useEffect(() => {
        if (!isOpen) setCustomModes({});
    }, [isOpen]);

    if (!isOpen || !exercise) return null;

    const formParams = exercise.form_parameters_required ?? [];
    const showReps = shouldShowReps(exercise);
    const showSeconds = shouldShowSeconds(exercise);
    const showDistance = shouldShowDistance(exercise);
    const isSided = exercise.pattern === 'side';

    function setCustomMode(setIndex, paramName, isCustom) {
        const key = `${setIndex}:${paramName}`;
        setCustomModes((prev) => ({ ...prev, [key]: isCustom }));
    }

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
                            value={toLocalDateTimeInputValue(performedAt)}
                            onChange={(event) => {
                                if (!event.target.value) return;
                                onPerformedAtChange(new Date(event.target.value).toISOString());
                            }}
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
                                {showReps && (
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
                                )}
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
                                        </select>
                                    </label>
                                )}
                            </div>

                            {formParams.length > 0 && (
                                <div className={styles.formDataGrid}>
                                    {formParams.map((paramName) => {
                                        const existing = (set.form_data ?? []).find((item) => item.parameter_name === paramName);
                                        const options = parameterOptions(paramName);
                                        const hasUnit = options.length > 0;
                                        const currentUnit = existing?.parameter_unit || options[0] || null;
                                        const historicalValues = [...(historicalFormParams[paramName] ?? [])];
                                        const existingValue = existing?.parameter_value ?? '';
                                        if (!hasUnit && existingValue && !historicalValues.includes(existingValue)) {
                                            historicalValues.push(existingValue);
                                            historicalValues.sort((a, b) => String(a).localeCompare(String(b)));
                                        }
                                        const key = `${index}:${paramName}`;
                                        const isCustom = Boolean(customModes[key]);
                                        const selectedValue = isCustom ? '__custom__' : (existingValue || '');
                                        const hasSelectedValue = Boolean(selectedValue && selectedValue !== '__custom__');
                                        return (
                                            <label key={paramName} className={styles.fieldLabel}>
                                                {paramName.replace(/_/g, ' ')}
                                                {hasUnit ? (
                                                    <div className={styles.withUnit}>
                                                        <input
                                                            className={styles.input}
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={existing?.parameter_value ?? ''}
                                                            onChange={(event) => onFormParamChange(index, paramName, event.target.value.trim(), currentUnit)}
                                                        />
                                                        <select
                                                            className={styles.select}
                                                            value={currentUnit}
                                                            onChange={(event) => onFormParamChange(index, paramName, existing?.parameter_value ?? '', event.target.value)}
                                                        >
                                                            {options.map((unit) => (
                                                                <option key={unit} value={unit}>{unit}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {historicalValues.length > 0 && (
                                                            <select
                                                                className={styles.select}
                                                                value={selectedValue}
                                                                onChange={(event) => {
                                                                    const value = event.target.value;
                                                                    if (value === '__custom__') {
                                                                        setCustomMode(index, paramName, true);
                                                                        if (!existingValue) onFormParamChange(index, paramName, '', null);
                                                                        return;
                                                                    }
                                                                    setCustomMode(index, paramName, false);
                                                                    onFormParamChange(index, paramName, value, null);
                                                                }}
                                                            >
                                                                {!hasSelectedValue && (
                                                                    <option value="">Select {paramName.replace(/_/g, ' ')}</option>
                                                                )}
                                                                {historicalValues.map((value) => (
                                                                    <option key={value} value={value}>{value}</option>
                                                                ))}
                                                                <option value="__custom__">Other...</option>
                                                            </select>
                                                        )}
                                                        {(historicalValues.length === 0 || isCustom) && (
                                                            <input
                                                                className={styles.input}
                                                                type="text"
                                                                value={existingValue}
                                                                onChange={(event) => onFormParamChange(index, paramName, event.target.value.trim(), null)}
                                                            />
                                                        )}
                                                    </>
                                                )}
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
