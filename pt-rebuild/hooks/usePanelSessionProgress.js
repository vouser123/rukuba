// hooks/usePanelSessionProgress.js — per-exercise logger session progress for panel and pocket mode

import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePanelSessionProgress(selectedExercise) {
    const [loggedSets, setLoggedSets] = useState([]);
    const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());

    useEffect(() => {
        setLoggedSets([]);
        setSessionStartedAt(new Date().toISOString());
    }, [selectedExercise?.id]);

    const appendLoggedSet = useCallback((setPatch) => {
        setLoggedSets((prev) => [...prev, setPatch]);
    }, []);

    const resetLoggedSets = useCallback(() => {
        setLoggedSets([]);
        setSessionStartedAt(new Date().toISOString());
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
        loggedSets,
        sessionStartedAt,
        sessionProgress,
        appendLoggedSet,
        resetLoggedSets,
    };
}
