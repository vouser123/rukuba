// hooks/useIndexData.js — loads tracker bootstrap data (exercises, programs, logs) with loading/error state
import { useCallback, useEffect, useState } from 'react';
import { fetchIndexExercises, fetchIndexLogs, fetchIndexPrograms } from '../lib/index-data';

export function useIndexData(token, patientId) {
    const [exercises, setExercises] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        if (!token || !patientId) return;
        setLoading(true);
        setError(null);
        try {
            const [nextExercises, nextPrograms, nextLogs] = await Promise.all([
                fetchIndexExercises(token),
                fetchIndexPrograms(token, patientId),
                fetchIndexLogs(token, patientId),
            ]);
            setExercises(nextExercises);
            setPrograms(nextPrograms);
            setLogs(nextLogs);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load index data';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [token, patientId]);

    useEffect(() => {
        if (!token || !patientId) {
            setExercises([]);
            setPrograms([]);
            setLogs([]);
            setLoading(false);
            setError(null);
            return;
        }
        reload();
    }, [token, patientId, reload]);

    return {
        exercises,
        programs,
        logs,
        loading,
        error,
        reload,
    };
}
