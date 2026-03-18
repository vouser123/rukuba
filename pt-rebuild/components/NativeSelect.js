// components/NativeSelect.js — iOS-safe native select with optional Other... custom text entry
import { useState, useEffect } from 'react';
import styles from './NativeSelect.module.css';

/**
 * iOS-safe dropdown built on native <select>.
 * When allowOther is true, includes an Other... option that reveals a text input.
 * Text input normalizes the value on blur using the optional formatValue function.
 *
 * @param {string}   value        - Current value (controlled)
 * @param {function} onChange     - Called with the new string value
 * @param {Array}    options      - Array of strings or { value, label } objects
 * @param {boolean}  allowOther   - Whether to show Other... option (default false)
 * @param {string}   placeholder  - Placeholder text shown when no value is selected
 * @param {function} formatValue  - Optional: called on blur to normalize typed text (e.g. toLower)
 * @param {string}   className    - Optional additional CSS class for the select/input element
 */
export default function NativeSelect({
    value = '',
    onChange,
    options = [],
    allowOther = false,
    placeholder = '',
    formatValue = null,
    className = '',
    disabled = false,
    ...rest
}) {
    // Normalize options to { value, label } shape
    const normalized = options.map((o) =>
        typeof o === 'string' ? { value: o, label: o } : o
    );
    const knownValues = normalized.map((o) => o.value);

    // Custom mode: true when the current value is not in the known options (and not empty)
    const [isCustom, setIsCustom] = useState(
        () => allowOther && Boolean(value) && !knownValues.includes(value)
    );

    // If an external value change arrives that doesn't match any option, enter custom mode
    useEffect(() => {
        if (allowOther && value && !knownValues.includes(value)) {
            setIsCustom(true);
        }
    // knownValues is derived from options prop — safe to omit from deps as a derived value
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, allowOther]);

    function handleSelectChange(event) {
        const selected = event.target.value;
        if (selected === '__other__') {
            setIsCustom(true);
            onChange('');
            return;
        }
        setIsCustom(false);
        onChange(selected);
    }

    function handleTextChange(event) {
        onChange(event.target.value);
    }

    function handleTextBlur(event) {
        if (!formatValue) return;
        const formatted = formatValue(event.target.value);
        if (formatted !== event.target.value) onChange(formatted);
    }

    if (isCustom) {
        return (
            <input
                type="text"
                className={`${styles.input} ${className}`.trim()}
                value={value}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                autoFocus
                disabled={disabled}
                {...rest}
            />
        );
    }

    return (
        <select
            className={`${styles.select} ${className}`.trim()}
            value={value || ''}
            onChange={handleSelectChange}
            disabled={disabled}
            {...rest}
        >
            {placeholder && !value && (
                <option value="">{placeholder}</option>
            )}
            {normalized.map(({ value: v, label }) => (
                <option key={v} value={v}>{label}</option>
            ))}
            {allowOther && (
                <option value="__other__">Other...</option>
            )}
        </select>
    );
}
