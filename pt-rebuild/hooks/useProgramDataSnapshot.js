// hooks/useProgramDataSnapshot.js — persists and reapplies /program data snapshots
import { useCallback } from 'react';
import { offlineCache } from '../lib/offline-cache';

/**
 * Cached snapshot writes for /program data.
 * @param {{ setProgramDataSnapshot: function }} params
 * @returns {{ persistProgramSnapshot: function, commitProgramData: function }}
 */
export function useProgramDataSnapshot({ setProgramDataSnapshot }) {
  const persistProgramSnapshot = useCallback(async (snapshot) => {
    await offlineCache.init();
    await Promise.all([
      offlineCache.cacheExercises(snapshot.exercises),
      offlineCache.cacheProgramVocabularies(snapshot.vocabularies),
      offlineCache.cacheProgramReferenceData(snapshot.referenceData),
      offlineCache.cachePrograms(Object.values(snapshot.programs ?? {})),
    ]);
  }, []);

  const commitProgramData = useCallback((snapshot) => {
    setProgramDataSnapshot(snapshot);
    persistProgramSnapshot(snapshot).catch(() => {});
  }, [persistProgramSnapshot, setProgramDataSnapshot]);

  return { persistProgramSnapshot, commitProgramData };
}
