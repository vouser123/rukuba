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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!userId) {
            setSortModeState('pt_order');
            setManualOrderIdsState([]);
            setHydratedUserId(null);
            return;
        }

        const storedSortMode = window.localStorage.getItem(getSortModeStorageKey(userId));
        const storedManualOrder = window.localStorage.getItem(getExerciseOrderStorageKey(userId));

        setSortModeState(normalizeSortMode(storedSortMode));

        if (!storedManualOrder) {
            setManualOrderIdsState([]);
            return;
        }

        try {
            const parsed = JSON.parse(storedManualOrder);
            setManualOrderIdsState(Array.isArray(parsed) ? parsed : []);
        } catch {
            setManualOrderIdsState([]);
        }
        setHydratedUserId(userId);
    }, [userId]);

    const normalizedManualOrderIds = useMemo(
        () => normalizeManualOrderIds(exercises, manualOrderIds),
        [exercises, manualOrderIds]
    );

    useEffect(() => {
        if (manualOrderIds.length === normalizedManualOrderIds.length
            && manualOrderIds.every((id, index) => id === normalizedManualOrderIds[index])) {
            return;
        }
        setManualOrderIdsState(normalizedManualOrderIds);
    }, [manualOrderIds, normalizedManualOrderIds]);

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
