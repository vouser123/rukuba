import { useEffect, useMemo, useState } from 'react';
import {
    getExerciseOrderStorageKey,
    getSortModeStorageKey,
    normalizeManualOrderIds,
    normalizeSortMode,
} from '../lib/exercise-sort';

export function useExerciseSortState(userId, exercises = []) {
    const [sortMode, setSortModeState] = useState('pt_order');
    const [manualOrderIds, setManualOrderIdsState] = useState([]);
    const [hydratedUserId, setHydratedUserId] = useState(null);
    const [restoredState, setRestoredState] = useState(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!userId) {
            setSortModeState('pt_order');
            setManualOrderIdsState([]);
            setHydratedUserId(null);
            setRestoredState(null);
            return;
        }

        const storedSortMode = window.localStorage.getItem(getSortModeStorageKey(userId));
        const storedManualOrder = window.localStorage.getItem(getExerciseOrderStorageKey(userId));
        const normalizedSortMode = normalizeSortMode(storedSortMode);
        let parsedOrder = [];

        if (storedManualOrder) {
            try {
                const parsed = JSON.parse(storedManualOrder);
                parsedOrder = Array.isArray(parsed) ? parsed : [];
            } catch {
                parsedOrder = [];
            }
        }

        setSortModeState(normalizedSortMode);
        setManualOrderIdsState(parsedOrder);
        setHydratedUserId(null);
        setRestoredState({
            userId,
            sortMode: normalizedSortMode,
            manualOrderIds: parsedOrder,
        });
    }, [userId]);

    const normalizedManualOrderIds = useMemo(
        () => normalizeManualOrderIds(exercises, manualOrderIds),
        [exercises, manualOrderIds]
    );

    const restoredNormalizedOrderIds = useMemo(
        () => normalizeManualOrderIds(exercises, restoredState?.manualOrderIds ?? []),
        [exercises, restoredState?.manualOrderIds]
    );

    useEffect(() => {
        if (manualOrderIds.length === normalizedManualOrderIds.length
            && manualOrderIds.every((id, index) => id === normalizedManualOrderIds[index])) {
            return;
        }
        setManualOrderIdsState(normalizedManualOrderIds);
    }, [manualOrderIds, normalizedManualOrderIds]);

    useEffect(() => {
        if (!restoredState || restoredState.userId !== userId) return;

        const sameSortMode = sortMode === restoredState.sortMode;
        const sameManualOrder = normalizedManualOrderIds.length === restoredNormalizedOrderIds.length
            && normalizedManualOrderIds.every((id, index) => id === restoredNormalizedOrderIds[index]);

        if (sameSortMode && sameManualOrder) {
            setHydratedUserId(userId);
        }
    }, [normalizedManualOrderIds, restoredNormalizedOrderIds, restoredState, sortMode, userId]);

    useEffect(() => {
        if (typeof window === 'undefined' || !userId || hydratedUserId !== userId) return;
        window.localStorage.setItem(getSortModeStorageKey(userId), sortMode);
    }, [hydratedUserId, sortMode, userId]);

    useEffect(() => {
        if (typeof window === 'undefined' || !userId || hydratedUserId !== userId) return;
        window.localStorage.setItem(
            getExerciseOrderStorageKey(userId),
            JSON.stringify(normalizedManualOrderIds)
        );
    }, [hydratedUserId, normalizedManualOrderIds, userId]);

    return {
        sortMode,
        setSortMode: (value) => setSortModeState(normalizeSortMode(value)),
        manualOrderIds: normalizedManualOrderIds,
        setManualOrderIds: (value) => {
            if (typeof value === 'function') {
                setManualOrderIdsState((previous) => value(normalizeManualOrderIds(exercises, previous)));
                return;
            }
            setManualOrderIdsState(Array.isArray(value) ? value : []);
        },
    };
}
