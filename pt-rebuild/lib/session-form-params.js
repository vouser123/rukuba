// lib/session-form-params.js — pure helpers for session form-parameter history/default logic

const WEIGHT_UNITS = ['lb', 'kg'];
const DISTANCE_UNITS = ['ft', 'in', 'cm', 'deg'];

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function getValidUnits(paramName) {
    if (paramName === 'weight') return WEIGHT_UNITS;
    if (paramName === 'distance') return DISTANCE_UNITS;
    return [];
}

function toDisplayValue(param) {
    const value = normalizeString(param?.parameter_value);
    if (!value) return '';
    const unit = normalizeString(param?.parameter_unit);
    return unit ? `${value} ${unit}` : value;
}

function getSortedExerciseLogs(logs, exerciseId) {
    return [...(logs ?? [])]
        .filter((log) => log?.exercise_id === exerciseId)
        .sort((a, b) => new Date(b?.performed_at ?? 0) - new Date(a?.performed_at ?? 0));
}

export function collectGlobalParameterValues(logs) {
    const byParam = {};
    for (const log of (logs ?? [])) {
        for (const set of (log?.sets ?? [])) {
            for (const param of (set?.form_data ?? [])) {
                const name = normalizeString(param?.parameter_name);
                const displayValue = toDisplayValue(param);
                if (!name || !displayValue) continue;
                if (!byParam[name]) byParam[name] = new Set();
                byParam[name].add(displayValue);
            }
        }
    }
    return Object.fromEntries(
        Object.entries(byParam).map(([name, values]) => [name, [...values].sort((a, b) => a.localeCompare(b))])
    );
}

export function getLastUsedParameterDisplay(logs, exerciseId, paramName) {
    const sortedLogs = getSortedExerciseLogs(logs, exerciseId);
    for (const log of sortedLogs) {
        for (const set of (log?.sets ?? [])) {
            const param = (set?.form_data ?? []).find((item) => item?.parameter_name === paramName);
            const displayValue = toDisplayValue(param);
            if (displayValue) return displayValue;
        }
    }
    return '';
}

function parseDisplayValue(paramName, displayValue) {
    const trimmed = normalizeString(displayValue);
    if (!trimmed) return { value: '', unit: null };
    const validUnits = getValidUnits(paramName);
    if (validUnits.length === 0) return { value: trimmed, unit: null };

    const parts = trimmed.split(/\s+/);
    const maybeUnit = parts.at(-1);
    if (validUnits.includes(maybeUnit) && parts.length > 1) {
        return { value: parts.slice(0, -1).join(' '), unit: maybeUnit };
    }
    return { value: trimmed, unit: validUnits[0] ?? null };
}

export function buildDefaultFormDataForExercise(exercise, logs) {
    const params = exercise?.form_parameters_required ?? [];
    const defaults = [];
    for (const paramName of params) {
        const lastUsed = getLastUsedParameterDisplay(logs, exercise?.id, paramName);
        if (!lastUsed) continue;
        const parsed = parseDisplayValue(paramName, lastUsed);
        if (!parsed.value) continue;
        defaults.push({
            parameter_name: paramName,
            parameter_value: parsed.value,
            parameter_unit: parsed.unit,
        });
    }
    return defaults.length > 0 ? defaults : null;
}

