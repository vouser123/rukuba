const SORT_MODES = new Set(['pt_order', 'manual', 'body_area', 'recent', 'alpha']);

function byName(a, b) {
    return (a?.canonical_name ?? '').localeCompare(b?.canonical_name ?? '');
}

export function normalizeSortMode(value) {
    return SORT_MODES.has(value) ? value : 'pt_order';
}

export function getSortModeStorageKey(userId) {
    return userId ? `pt_sort_mode_${userId}` : null;
}

export function getExerciseOrderStorageKey(userId) {
    return userId ? `pt_exercise_order_${userId}` : null;
}

export function normalizeManualOrderIds(exercises = [], manualOrderIds = []) {
    const exerciseIds = exercises
        .map((exercise) => exercise?.id)
        .filter(Boolean);
    const validIds = new Set(exerciseIds);
    const normalized = [];
    const seen = new Set();

    for (const id of manualOrderIds) {
        if (!validIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }

    for (const id of exerciseIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }

    return normalized;
}

export function applyManualOrder(exercises = [], manualOrderIds = []) {
    const normalizedIds = normalizeManualOrderIds(exercises, manualOrderIds);
    const exerciseMap = new Map(exercises.map((exercise) => [exercise?.id, exercise]));

    return normalizedIds
        .map((id) => exerciseMap.get(id))
        .filter(Boolean);
}

export function sortExercises({
    exercises = [],
    programsByExercise = new Map(),
    sortMode = 'pt_order',
    query = '',
    manualOrderIds = [],
}) {
    const normalizedMode = normalizeSortMode(sortMode);
    const ordered = normalizedMode === 'manual'
        ? applyManualOrder(exercises, manualOrderIds)
        : [...exercises];

    if (normalizedMode === 'alpha') {
        ordered.sort(byName);
    } else if (normalizedMode === 'body_area') {
        ordered.sort((a, b) => {
            const aCategory = a?.pt_category ?? '';
            const bCategory = b?.pt_category ?? '';
            const byCategory = aCategory.localeCompare(bCategory);
            if (byCategory !== 0) return byCategory;
            return byName(a, b);
        });
    } else if (normalizedMode === 'recent') {
        ordered.sort((a, b) => {
            const aProgram = programsByExercise.get(a.id) ?? null;
            const bProgram = programsByExercise.get(b.id) ?? null;
            const aDays = aProgram?.adherence_days_since;
            const bDays = bProgram?.adherence_days_since;
            const aValue = Number.isFinite(aDays) ? aDays : Number.POSITIVE_INFINITY;
            const bValue = Number.isFinite(bDays) ? bDays : Number.POSITIVE_INFINITY;
            if (aValue !== bValue) return aValue - bValue;
            return byName(a, b);
        });
    }

    const q = query.trim().toLowerCase();
    return ordered.filter((exercise) => {
        if (exercise?.archived) return false;
        if (!q) return true;
        return (exercise?.canonical_name ?? '').toLowerCase().includes(q);
    });
}

export function reorderVisibleSubset(fullOrderIds = [], visibleIds = [], fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return fullOrderIds;
    }

    const nextVisibleIds = [...visibleIds];
    const [movedId] = nextVisibleIds.splice(fromIndex, 1);
    if (!movedId) return fullOrderIds;
    nextVisibleIds.splice(toIndex, 0, movedId);

    const visibleSet = new Set(visibleIds);
    let visibleCursor = 0;

    return fullOrderIds.map((id) => {
        if (!visibleSet.has(id)) return id;
        const replacement = nextVisibleIds[visibleCursor];
        visibleCursor += 1;
        return replacement;
    });
}
