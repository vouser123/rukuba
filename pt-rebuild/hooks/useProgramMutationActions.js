// hooks/useProgramMutationActions.js — optimistic mutation handlers for the /program editor

import { useCallback } from 'react';
import { buildOptimisticExercise, inferDosageType, mergeReferenceData } from '../lib/program-optimistic';
import {
  createProgramMutation,
  isLocalRoleId,
  LOCAL_PROGRAM_ID_PREFIX,
  LOCAL_ROLE_ID_PREFIX,
  mergeProgramMutationQueue,
} from '../lib/program-offline';

export function useProgramMutationActions({
  session,
  selectedExercise,
  dosageTarget,
  mutationQueue,
  enqueueMutation,
  persistQueue,
  commitSnapshot,
  showToast,
  getSnapshot,
  setDosageTarget,
}) {
  const handleSaved = useCallback(async (wasNew, savedExerciseId, payload) => {
    if (!session?.user?.id) return null;

    const previousSnapshot = getSnapshot();
    const existingExercise = previousSnapshot.exercises.find((exercise) => exercise.id === savedExerciseId) ?? null;
    const optimisticExercise = buildOptimisticExercise(existingExercise, payload);
    const nextExercises = wasNew
      ? [...previousSnapshot.exercises, optimisticExercise].sort((left, right) => left.canonical_name.localeCompare(right.canonical_name))
      : previousSnapshot.exercises.map((exercise) => (exercise.id === savedExerciseId ? optimisticExercise : exercise));

    await enqueueMutation(
      createProgramMutation(wasNew ? 'exercise.create' : 'exercise.update', { exerciseId: savedExerciseId, payload }),
      {
        ...previousSnapshot,
        exercises: nextExercises,
        referenceData: mergeReferenceData(previousSnapshot.referenceData, payload),
        activeExercise: optimisticExercise,
      },
      wasNew ? 'Exercise created.' : 'Exercise saved.',
      previousSnapshot
    );

    return { exerciseId: savedExerciseId };
  }, [enqueueMutation, getSnapshot, session?.user?.id]);

  const handleDosageSave = useCallback(async (formData) => {
    const { exercise, program } = dosageTarget;
    const previousSnapshot = getSnapshot();

    await enqueueMutation(
      createProgramMutation('program.upsert', {
        exercise_id: exercise.id,
        programId: program?.id ?? null,
        payload: { ...formData, exercise_id: exercise.id, patient_id: session.user.id },
      }),
      {
        ...previousSnapshot,
        programs: {
          ...previousSnapshot.programs,
          [exercise.id]: {
            ...(program ?? {}),
            id: program?.id ?? `${LOCAL_PROGRAM_ID_PREFIX}${exercise.id}`,
            exercise_id: exercise.id,
            patient_id: session.user.id,
            dosage_type: inferDosageType(formData, exercise),
            ...formData,
          },
        },
      },
      'Dosage saved.',
      previousSnapshot
    );

    setDosageTarget(null);
  }, [dosageTarget, enqueueMutation, getSnapshot, session?.user?.id, setDosageTarget]);

  const handleAddRole = useCallback(async (roleData) => {
    if (!session || !selectedExercise?.id) return;
    const previousSnapshot = getSnapshot();
    const localRoleId = `${LOCAL_ROLE_ID_PREFIX}${selectedExercise.id}:${Date.now()}`;
    const addRole = (exercise) => ({ ...exercise, roles: [...(exercise.roles ?? []), { id: localRoleId, ...roleData }] });

    await enqueueMutation(
      createProgramMutation('role.add', { localRoleId, payload: { ...roleData, exercise_id: selectedExercise.id } }),
      {
        ...previousSnapshot,
        exercises: previousSnapshot.exercises.map((exercise) => (exercise.id === selectedExercise.id ? addRole(exercise) : exercise)),
        activeExercise: previousSnapshot.activeExercise && previousSnapshot.activeExercise !== 'new' && previousSnapshot.activeExercise.id === selectedExercise.id
          ? addRole(previousSnapshot.activeExercise)
          : previousSnapshot.activeExercise,
      },
      'Role added.',
      previousSnapshot
    );
  }, [enqueueMutation, getSnapshot, selectedExercise?.id, session]);

  const handleDeleteRole = useCallback(async (roleId) => {
    if (!session || !selectedExercise?.id || !roleId) return;
    const previousSnapshot = getSnapshot();
    const removeRole = (exercise) => ({ ...exercise, roles: (exercise.roles ?? []).filter((role) => role.id !== roleId) });
    const nextSnapshot = {
      ...previousSnapshot,
      exercises: previousSnapshot.exercises.map((exercise) => (exercise.id === selectedExercise.id ? removeRole(exercise) : exercise)),
      activeExercise: previousSnapshot.activeExercise && previousSnapshot.activeExercise !== 'new' && previousSnapshot.activeExercise.id === selectedExercise.id
        ? removeRole(previousSnapshot.activeExercise)
        : previousSnapshot.activeExercise,
    };

    if (isLocalRoleId(roleId)) {
      commitSnapshot(nextSnapshot);
      await persistQueue(mergeProgramMutationQueue(mutationQueue, createProgramMutation('role.delete', { roleId })));
      showToast('Role removed.');
      return;
    }

    await enqueueMutation(createProgramMutation('role.delete', { roleId }), nextSnapshot, 'Role removed.', previousSnapshot);
  }, [commitSnapshot, enqueueMutation, getSnapshot, mutationQueue, persistQueue, selectedExercise?.id, session, showToast]);

  const makeVocabHandler = useCallback((type, successMessage, applyTerms) => async (payload) => {
    if (!session) return;
    const previousSnapshot = getSnapshot();
    await enqueueMutation(
      createProgramMutation(type, payload),
      {
        ...previousSnapshot,
        vocabularies: {
          ...previousSnapshot.vocabularies,
          [payload.table]: applyTerms(previousSnapshot.vocabularies[payload.table] ?? [], payload),
        },
      },
      successMessage,
      previousSnapshot
    );
  }, [enqueueMutation, getSnapshot, session]);

  return {
    handleSaved,
    handleDosageSave,
    handleAddRole,
    handleDeleteRole,
    handleAddVocabTerm: makeVocabHandler('vocab.create', 'Vocabulary term added.', (terms, payload) => [...terms, { code: payload.code, definition: payload.definition, sort_order: payload.sort_order ?? terms.length + 1, active: true }]),
    handleUpdateVocabTerm: makeVocabHandler('vocab.update', 'Vocabulary term updated.', (terms, payload) => terms.map((term) => (term.code === payload.code ? { ...term, definition: payload.definition ?? term.definition, sort_order: payload.sort_order ?? term.sort_order } : term))),
    handleDeleteVocabTerm: makeVocabHandler('vocab.delete', 'Vocabulary term deleted.', (terms, payload) => terms.filter((term) => term.code !== payload.code)),
  };
}
