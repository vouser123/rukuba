// hooks/usePanelSessionProgress.js — per-exercise logger session progress for panel and pocket mode

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSessionProgress } from '../lib/index-tracker-session';

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
        return buildSessionProgress(selectedExercise, loggedSets);
    }, [loggedSets, selectedExercise]);

    return {
        loggedSets,
        sessionStartedAt,
        sessionProgress,
        appendLoggedSet,
        resetLoggedSets,
    };
}
