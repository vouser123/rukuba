// hooks/useProgramVocabActions.js — optimistic vocabulary mutation handlers for the /program editor

import { useCallback } from 'react';
import { createProgramMutation } from '../lib/program-offline';

export function useProgramVocabActions({
  session,
  enqueueMutation,
  getSnapshot,
}) {
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
    handleAddVocabTerm: makeVocabHandler('vocab.create', 'Vocabulary term added.', (terms, payload) => [...terms, { code: payload.code, definition: payload.definition, sort_order: payload.sort_order ?? terms.length + 1, active: true }]),
    handleUpdateVocabTerm: makeVocabHandler('vocab.update', 'Vocabulary term updated.', (terms, payload) => terms.map((term) => (term.code === payload.code ? { ...term, definition: payload.definition ?? term.definition, sort_order: payload.sort_order ?? term.sort_order } : term))),
    handleDeleteVocabTerm: makeVocabHandler('vocab.delete', 'Vocabulary term deleted.', (terms, payload) => terms.filter((term) => term.code !== payload.code)),
  };
}
