// hooks/useProgramPageData.js — loads, caches, and restores /program page data
import { useCallback, useEffect, useState } from 'react';
import { offlineCache } from '../lib/offline-cache';
import { emptyReferenceData } from '../lib/program-optimistic';
import { fetchExercises, fetchVocabularies, fetchReferenceData, fetchPrograms } from '../lib/pt-editor';
import { fetchUsers, resolvePatientScopedUserContext } from '../lib/users';

function emptyProgramDataState() {
  return {
    exercises: [],
    referenceData: emptyReferenceData(),
    vocabularies: {},
    programs: {},
    loadError: null,
    offlineNotice: null,
    currentUserRole: null,
    accessError: null,
    programPatientId: null,
    programPatientName: '',
  };
}

/**
 * /program bootstrap, cache, and offline fallback lifecycle.
 * @param {{ session: object|null }} params
 * @returns {object}
 */
export function useProgramPageData({ session }) {
  const [state, setState] = useState(emptyProgramDataState);
  const persistProgramSnapshot = useCallback(async (snapshot) => {
    await offlineCache.init();
    await Promise.all([offlineCache.cacheExercises(snapshot.exercises), offlineCache.cacheProgramVocabularies(snapshot.vocabularies), offlineCache.cacheProgramReferenceData(snapshot.referenceData), offlineCache.cachePrograms(Object.values(snapshot.programs ?? {}))]);
  }, []);

  const setProgramDataSnapshot = useCallback((snapshot) => {
    setState((previous) => ({
      ...previous,
      exercises: snapshot.exercises,
      referenceData: snapshot.referenceData,
      vocabularies: snapshot.vocabularies,
      programs: snapshot.programs,
    }));
  }, []);

  const loadData = useCallback(async (accessToken, authUserId) => {
    try {
      await offlineCache.init();
      const usersData = await fetchUsers(accessToken);
      await offlineCache.cacheUsers(usersData);
      const currentUser = usersData.find((user) => user.auth_id === authUserId);
      if (!currentUser) throw new Error('Current user profile not found');

      if (currentUser.role !== 'therapist' && currentUser.role !== 'admin') {
        setState({ ...emptyProgramDataState(), currentUserRole: currentUser.role, accessError: 'Therapist or admin access required.' });
        return null;
      }

      const { patientUser, patientDisplayName } = resolvePatientScopedUserContext(usersData, authUserId);
      const [exercises, vocabularies, referenceData, programs] = await Promise.all([
        fetchExercises(accessToken),
        fetchVocabularies(accessToken),
        fetchReferenceData(accessToken),
        fetchPrograms(accessToken, patientUser.id),
      ]);
      const nextData = {
        exercises,
        vocabularies,
        referenceData,
        programs,
        currentUserRole: currentUser.role,
        programPatientId: patientUser.id,
        programPatientName: patientDisplayName,
      };
      await persistProgramSnapshot(nextData);
      setState({ ...emptyProgramDataState(), ...nextData });
      return nextData;
    } catch (err) {
      try {
        await offlineCache.init();
        const [cachedUsers, cachedExercises, cachedVocabularies, cachedReferenceData, cachedPrograms] = await Promise.all([
          offlineCache.getCachedUsers(),
          offlineCache.getCachedExercises(),
          offlineCache.getCachedProgramVocabularies(),
          offlineCache.getCachedProgramReferenceData(),
          offlineCache.getCachedPrograms(),
        ]);
        const currentUser = (cachedUsers ?? []).find((user) => user.auth_id === authUserId);
        if (!currentUser) throw err;

        if (currentUser.role !== 'therapist' && currentUser.role !== 'admin') {
          setState({ ...emptyProgramDataState(), currentUserRole: currentUser.role, accessError: 'Therapist or admin access required.' });
          return null;
        }

        const { patientUser, patientDisplayName } = resolvePatientScopedUserContext(cachedUsers, authUserId);
        const programMap = Object.fromEntries((cachedPrograms ?? []).map((program) => [program.exercise_id, program]));
        const hasCachedBootstrap =
          (cachedExercises?.length ?? 0) > 0 ||
          Object.keys(cachedVocabularies ?? {}).length > 0 ||
          (cachedReferenceData?.equipment?.length ?? 0) > 0 ||
          (cachedReferenceData?.muscles?.length ?? 0) > 0 ||
          (cachedReferenceData?.formParameters?.length ?? 0) > 0 ||
          Object.keys(programMap).length > 0;
        if (!hasCachedBootstrap) throw err;

        const nextData = {
          exercises: cachedExercises ?? [],
          vocabularies: cachedVocabularies ?? {},
          referenceData: cachedReferenceData ?? emptyReferenceData(),
          programs: programMap,
          currentUserRole: currentUser.role,
          programPatientId: patientUser.id,
          programPatientName: patientDisplayName,
        };
        setState({ ...emptyProgramDataState(), ...nextData, offlineNotice: 'Offline - showing cached editor data.' });
        return nextData;
      } catch {
        setState({ ...emptyProgramDataState(), loadError: err.message });
        return null;
      }
    }
  }, [persistProgramSnapshot]);

  useEffect(() => {
    if (session) void loadData(session.access_token, session.user.id);
  }, [loadData, session]);

  useEffect(() => {
    if (!session) {
      setState((previous) => ({
        ...previous,
        currentUserRole: null,
        accessError: null,
      }));
    }
  }, [session]);

  return {
    ...state,
    loadData,
    setProgramDataSnapshot,
  };
}
