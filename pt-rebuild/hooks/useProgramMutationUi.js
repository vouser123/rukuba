// hooks/useProgramMutationUi.js — /program mutation loading state and UI-facing wrapper handlers
import { useCallback, useState } from 'react';

/**
 * UI-facing mutation wrappers for /program editor actions.
 * @param {object} params
 * @returns {object}
 */
export function useProgramMutationUi({
  handleSaved,
  handleAddRoleMutation,
  handleDeleteRoleMutation,
  handleAddVocabTermMutation,
  handleUpdateVocabTermMutation,
  handleDeleteVocabTermMutation,
  setRoleExerciseId,
  setDosageExerciseId,
}) {
  const [rolesLoading, setRolesLoading] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);

  const handleExerciseSaved = useCallback(async (wasNew, savedExerciseId, payload) => {
    const result = await handleSaved(wasNew, savedExerciseId, payload);
    if (result?.exerciseId) {
      setRoleExerciseId(result.exerciseId);
      setDosageExerciseId(result.exerciseId);
    }
    return result;
  }, [handleSaved, setDosageExerciseId, setRoleExerciseId]);

  const handleAddRole = useCallback(async (roleData) => {
    setRolesLoading(true);
    try {
      await handleAddRoleMutation(roleData);
    } finally {
      setRolesLoading(false);
    }
  }, [handleAddRoleMutation]);

  const handleDeleteRole = useCallback(async (roleId) => {
    setRolesLoading(true);
    try {
      await handleDeleteRoleMutation(roleId);
    } finally {
      setRolesLoading(false);
    }
  }, [handleDeleteRoleMutation]);

  const wrapVocabAction = useCallback((handler) => async (payload) => {
    setVocabSaving(true);
    try {
      await handler(payload);
    } finally {
      setVocabSaving(false);
    }
  }, []);

  return {
    rolesLoading,
    vocabSaving,
    handleExerciseSaved,
    handleAddRole,
    handleDeleteRole,
    handleAddVocabTerm: wrapVocabAction(handleAddVocabTermMutation),
    handleUpdateVocabTerm: wrapVocabAction(handleUpdateVocabTermMutation),
    handleDeleteVocabTerm: wrapVocabAction(handleDeleteVocabTermMutation),
  };
}
