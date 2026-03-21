// hooks/useIndexData.js — loads tracker bootstrap data (exercises, programs, logs) with loading/error state
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIndexExercises, fetchIndexLogs, fetchIndexPrograms } from '../lib/index-data';
import { offlineCache } from '../lib/offline-cache';

function getLoadErrorMessage(error) {
    const message = error instanceof Error ? error.message : 'Failed to load index data';
    if (message.startsWith('Failed to load exercises')) {
        return 'Failed to load exercises. Check your connection.';
    }
    if (message.startsWith('Failed to load logs')) {
        return 'Failed to load history.';
    }
    return message;
}

export function useIndexData(token, patientId) {
    const [exercises, setExercises] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fromCache, setFromCache] = useState(false);
    const hadAuthRef = useRef(false);

    const reload = useCallback(async () => {
        if (!token || !patientId) return;
        setLoading(true);
        setError(null);
        setFromCache(false);
        try {
            const [nextExercises, nextPrograms, nextLogs] = await Promise.all([
                fetchIndexExercises(token),
                fetchIndexPrograms(token, patientId),
                fetchIndexLogs(token), // DN-059: no patientId — API resolves profile UUID from req.user.id
            ]);
            if (typeof window !== 'undefined') {
                await offlineCache.init();
                await Promise.all([
                    offlineCache.cacheExercises(nextExercises),
                    offlineCache.cachePrograms(nextPrograms),
                    offlineCache.cacheLogs(nextLogs),
                    offlineCache.cacheTrackerBootstrap(patientId, {
                        exercises: nextExercises,
                        programs: nextPrograms,
                        logs: nextLogs,
                    }),
                ]);
            }
            setExercises(nextExercises);
            setPrograms(nextPrograms);
            setLogs(nextLogs);
        } catch (err) {
            const message = getLoadErrorMessage(err);
            if (typeof window === 'undefined') {
                setError(message);
                return;
            }

            try {
                await offlineCache.init();
                const cachedBootstrap = await offlineCache.getCachedTrackerBootstrap(patientId);
                const cachedExercises = cachedBootstrap?.exercises ?? [];
                const cachedPrograms = cachedBootstrap?.programs ?? [];
                const cachedLogs = cachedBootstrap?.logs ?? [];
                const hasCachedData = cachedExercises.length > 0 || cachedPrograms.length > 0 || cachedLogs.length > 0;

                if (hasCachedData) {
                    setExercises(cachedExercises);
                    setPrograms(cachedPrograms);
                    setLogs(cachedLogs);
                    setFromCache(true);
                    return;
                }
            } catch (cacheError) {
                console.error('useIndexData cache fallback failed:', cacheError);
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    }, [token, patientId]);

    useEffect(() => {
        if (typeof window !== 'undefined' && token && patientId) {
            void offlineCache.init().catch((cacheError) => {
                console.error('useIndexData cache init failed:', cacheError);
            });
        }

        if (!token || !patientId) {
            if (hadAuthRef.current && typeof window !== 'undefined') {
                void Promise.all([
                    offlineCache.clearExercises(),
                    offlineCache.clearPrograms(),
                    offlineCache.clearLogs(),
                    offlineCache.clearTrackerBootstrap(),
                ]).catch((cacheError) => {
                    console.error('useIndexData cache clear failed:', cacheError);
                });
            }

            setExercises([]);
            setPrograms([]);
            setLogs([]);
            setLoading(false);
            setError(null);
            setFromCache(false);
            hadAuthRef.current = false;
            return;
        }

        hadAuthRef.current = true;
        reload();
    }, [token, patientId, reload]);

    return {
        exercises,
        programs,
        logs,
        loading,
        error,
        fromCache,
        reload,
    };
}
