// hooks/usePanelSessionProgress.js — per-exercise logger session progress for panel and pocket mode

import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePanelSessionProgress(selectedExercise) {
    const [loggedSets, setLoggedSets] = useState([]);

    useEffect(() => {
        setLoggedSets([]);
    }, [selectedExercise?.id]);

    const appendLoggedSet = useCallback((setPatch) => {
        setLoggedSets((prev) => [...prev, setPatch]);
    }, []);

    const resetLoggedSets = useCallback(() => {
        setLoggedSets([]);
    }, []);

    const sessionProgress = useMemo(() => {
        const targetSets = Number(selectedExercise?.current_sets ?? 0) || 0;
        const leftCount = loggedSets.filter((set) => set?.side === 'left').length;
        const rightCount = loggedSets.filter((set) => set?.side === 'right').length;
        return {
            targetSets,
            totalLogged: loggedSets.length,
            leftCount,
            rightCount,
        };
    }, [loggedSets, selectedExercise?.current_sets]);

    return {
        sessionProgress,
        appendLoggedSet,
        resetLoggedSets,
    };
}
