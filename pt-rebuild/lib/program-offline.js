import { offlineCache } from './offline-cache';
import {
  addRole,
  createExercise,
  createProgram,
  createVocabularyTerm,
  deleteRole,
  deleteVocabularyTerm,
  updateExercise,
  updateProgram,
  updateVocabularyTerm,
} from './pt-editor';

export const LOCAL_ROLE_ID_PREFIX = 'offline-role:';
export const LOCAL_PROGRAM_ID_PREFIX = 'offline-program:';

export function programQueueKey(userId) {
  return `pt_program_offline_mutations_${userId}`;
}

export async function loadProgramQueue(userId) {
  try {
    return await offlineCache.getQueueState(programQueueKey(userId));
  } catch {
    return [];
  }
}

export async function saveProgramQueue(userId, queue) {
  await offlineCache.setQueueState(programQueueKey(userId), queue);
}

export async function clearProgramQueue(userId) {
  await offlineCache.removeQueueState(programQueueKey(userId));
}

export function createProgramMutation(type, payload, extra = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `program-mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    payload,
    status: 'pending',
    last_error: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

export function isLocalRoleId(roleId) {
  return typeof roleId === 'string' && roleId.startsWith(LOCAL_ROLE_ID_PREFIX);
}

export function isLocalProgramId(programId) {
  return typeof programId === 'string' && programId.startsWith(LOCAL_PROGRAM_ID_PREFIX);
}

export function isNetworkError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.name === 'TypeError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('fetch failed')
  );
}

function isProgramMissingError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('program not found');
}

export function markProgramMutationFailed(queue, mutationId, message) {
  return (queue ?? []).map((item) => (
    item.id === mutationId
      ? { ...item, status: 'failed', last_error: message }
      : item
  ));
}

function replaceAt(queue, index, value) {
  return queue.map((item, itemIndex) => (itemIndex === index ? value : item));
}

export function mergeProgramMutationQueue(queue, mutation) {
  const nextQueue = [...(queue ?? [])];

  if (mutation.type === 'exercise.create') {
    const existingIndex = nextQueue.findIndex((item) => item.type === 'exercise.create' && item.payload.exerciseId === mutation.payload.exerciseId);
    if (existingIndex >= 0) {
      return replaceAt(nextQueue, existingIndex, mutation);
    }
    nextQueue.push(mutation);
    return nextQueue;
  }

  if (mutation.type === 'exercise.update') {
    const createIndex = nextQueue.findIndex((item) => item.type === 'exercise.create' && item.payload.exerciseId === mutation.payload.exerciseId);
    if (createIndex >= 0) {
      const existingCreate = nextQueue[createIndex];
      return replaceAt(nextQueue, createIndex, {
        ...existingCreate,
        payload: {
          ...existingCreate.payload,
          payload: mutation.payload.payload,
        },
        status: 'pending',
        last_error: null,
      });
    }

    const updateIndex = nextQueue.findIndex((item) => item.type === 'exercise.update' && item.payload.exerciseId === mutation.payload.exerciseId);
    if (updateIndex >= 0) {
      return replaceAt(nextQueue, updateIndex, mutation);
    }

    nextQueue.push(mutation);
    return nextQueue;
  }

  if (mutation.type === 'program.upsert') {
    const programIndex = nextQueue.findIndex((item) => item.type === 'program.upsert' && item.payload.exercise_id === mutation.payload.exercise_id);
    if (programIndex >= 0) {
      return replaceAt(nextQueue, programIndex, mutation);
    }

    nextQueue.push(mutation);
    return nextQueue;
  }

  if (mutation.type === 'vocab.create' || mutation.type === 'vocab.update' || mutation.type === 'vocab.delete') {
    const vocabIndex = nextQueue.findIndex((item) => (
      item.payload.table === mutation.payload.table
      && item.payload.code === mutation.payload.code
      && item.type.startsWith('vocab.')
    ));

    if (vocabIndex >= 0) {
      const existing = nextQueue[vocabIndex];

      if (existing.type === 'vocab.create' && mutation.type === 'vocab.delete') {
        return nextQueue.filter((_, index) => index !== vocabIndex);
      }

      if (existing.type === 'vocab.create' && mutation.type === 'vocab.update') {
        return replaceAt(nextQueue, vocabIndex, {
          ...existing,
          payload: {
            ...existing.payload,
            definition: mutation.payload.definition,
            sort_order: mutation.payload.sort_order ?? existing.payload.sort_order,
          },
          status: 'pending',
          last_error: null,
        });
      }

      return replaceAt(nextQueue, vocabIndex, mutation);
    }

    nextQueue.push(mutation);
    return nextQueue;
  }

  if (mutation.type === 'role.delete' && isLocalRoleId(mutation.payload.roleId)) {
    return nextQueue.filter((item) => !(item.type === 'role.add' && item.payload.localRoleId === mutation.payload.roleId));
  }

  nextQueue.push(mutation);
  return nextQueue;
}

export function getProgramMutationLabel(mutation) {
  switch (mutation?.type) {
    case 'exercise.create':
    case 'exercise.update':
      return 'exercise';
    case 'role.add':
    case 'role.delete':
      return 'role';
    case 'program.upsert':
      return 'dosage';
    case 'vocab.create':
    case 'vocab.update':
    case 'vocab.delete':
      return 'vocabulary term';
    default:
      return 'program change';
  }
}

export function summarizeProgramQueue(queue) {
  const items = queue ?? [];
  const failed = items.filter((item) => item.status === 'failed');
  const pending = items.filter((item) => item.status !== 'failed');

  return {
    totalCount: items.length,
    failedCount: failed.length,
    pendingCount: pending.length,
    firstFailed: failed[0] ?? null,
  };
}

export async function performProgramMutation(accessToken, mutation) {
  switch (mutation.type) {
    case 'exercise.create':
      return createExercise(accessToken, mutation.payload.payload);
    case 'exercise.update':
      return updateExercise(accessToken, mutation.payload.exerciseId, mutation.payload.payload);
    case 'role.add':
      return addRole(accessToken, mutation.payload.payload);
    case 'role.delete':
      return deleteRole(accessToken, mutation.payload.roleId);
    case 'program.upsert':
      if (mutation.payload.programId && !isLocalProgramId(mutation.payload.programId)) {
        try {
          return await updateProgram(accessToken, mutation.payload.programId, mutation.payload.payload);
        } catch (error) {
          if (!isProgramMissingError(error)) {
            throw error;
          }
        }
      }
      return createProgram(accessToken, mutation.payload.payload);
    case 'vocab.create':
      return createVocabularyTerm(accessToken, mutation.payload);
    case 'vocab.update':
      return updateVocabularyTerm(accessToken, mutation.payload);
    case 'vocab.delete':
      return deleteVocabularyTerm(accessToken, mutation.payload);
    default:
      throw new Error(`Unsupported offline mutation type: ${mutation.type}`);
  }
}

export async function replayProgramQueue(accessToken, queue, persistQueue) {
  let workingQueue = [...(queue ?? [])];
  let syncedCount = 0;

  for (const mutation of queue ?? []) {
    try {
      await performProgramMutation(accessToken, mutation);
      syncedCount += 1;
      workingQueue = workingQueue.filter((item) => item.id !== mutation.id);
      await persistQueue(workingQueue);
    } catch (error) {
      const failedMessage = isNetworkError(error)
        ? 'Offline - changes will sync later'
        : error.message;
      const failedQueue = markProgramMutationFailed(workingQueue, mutation.id, failedMessage);
      await persistQueue(failedQueue);
      return { failedMessage, syncedCount };
    }
  }

  return { failedMessage: null, syncedCount };
}
