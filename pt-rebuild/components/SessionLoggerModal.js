// components/SessionLoggerModal.js — modal UI for create/update session logs with per-set fields
import { useEffect, useState } from 'react';
import styles from './SessionLoggerModal.module.css';
import NativeSelect from './NativeSelect';
import { toLower, toTitleCase } from '../lib/text-format';

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

function formatFieldLabel(value) {
    return toTitleCase(String(value).replace(/_/g, ' '));
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
                                        <NativeSelect
                                            className={styles.select}
                                            value={set.side ?? 'right'}
                                            onChange={(value) => onSetChange(index, { side: value })}
                                            options={[
                                                { value: 'left', label: 'Left' },
                                                { value: 'right', label: 'Right' },
                                            ]}
                                        />
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
                                                {formatFieldLabel(paramName)}
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
                                                        <NativeSelect
                                                            className={styles.select}
                                                            value={currentUnit}
                                                            onChange={(value) => onFormParamChange(index, paramName, existing?.parameter_value ?? '', value)}
                                                            options={options.map((unit) => ({
                                                                value: unit,
                                                                label: unit,
                                                            }))}
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {historicalValues.length > 0 && (
                                                            <NativeSelect
                                                                className={styles.select}
                                                                value={isCustom ? existingValue : selectedValue}
                                                                onChange={(value) => {
                                                                    const nextIsCustom = Boolean(value) && !historicalValues.includes(value);
                                                                    setCustomMode(index, paramName, nextIsCustom);
                                                                    onFormParamChange(index, paramName, value, null);
                                                                }}
                                                                options={historicalValues}
                                                                allowOther
                                                                placeholder={`Select ${formatFieldLabel(paramName)}`}
                                                                formatValue={toLower}
                                                            />
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
