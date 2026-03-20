// hooks/useProgramOfflineQueue.js — offline mutation queue lifecycle for the /program editor

import { useCallback, useEffect, useRef, useState } from 'react';
import { isNetworkError, loadProgramQueue, markProgramMutationFailed, mergeProgramMutationQueue, performProgramMutation, replayProgramQueue, saveProgramQueue } from '../lib/program-offline';

export function useProgramOfflineQueue({
  session,
  programPatientId,
  loadData,
  showToast,
  commitSnapshot,
}) {
  const [mutationQueue, setMutationQueue] = useState([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const queueRef = useRef([]);
  const syncInFlightRef = useRef(false);
  const persistQueue = useCallback(async (nextQueue) => {
    queueRef.current = nextQueue;
    setMutationQueue(nextQueue);
    if (session?.user?.id) {
      await saveProgramQueue(session.user.id, nextQueue);
    }
  }, [session?.user?.id]);
  const syncProgramMutations = useCallback(async () => {
    if (!session?.access_token || !session?.user?.id || !programPatientId || syncInFlightRef.current) return;
    const currentQueue = queueRef.current;
    if (!currentQueue.length) {
      setQueueError(null);
      return;
    }
    syncInFlightRef.current = true;
    setQueueSyncing(true);
    setQueueError(null);
    try {
      const { failedMessage, syncedCount } = await replayProgramQueue(
        session.access_token,
        currentQueue,
        persistQueue
      );

      if (failedMessage) {
        setQueueError(failedMessage);
        return;
      }

      if (syncedCount > 0) {
        await loadData(session.access_token, session.user.id);
        showToast(
          syncedCount === 1 ? '1 pending program change synced.' : `${syncedCount} pending program changes synced.`
        );
      }
    } finally {
      syncInFlightRef.current = false;
      setQueueSyncing(false);
    }
  }, [loadData, persistQueue, programPatientId, session?.access_token, session?.user?.id, showToast]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      queueRef.current = [];
      setMutationQueue([]);
      setQueueLoaded(false);
      setQueueError(null);
      return () => {
        cancelled = true;
      };
    }
    loadProgramQueue(session.user.id)
      .then((queue) => {
        if (cancelled) return;
        queueRef.current = queue;
        setMutationQueue(queue);
        setQueueLoaded(true);
        setQueueError(queue.find((item) => item.status === 'failed')?.last_error ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        queueRef.current = [];
        setMutationQueue([]);
        setQueueLoaded(true);
        setQueueError(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);
  useEffect(() => {
    if (!queueLoaded || !session?.user?.id || !programPatientId || mutationQueue.length === 0 || !navigator.onLine) return;
    syncProgramMutations();
  }, [mutationQueue.length, programPatientId, queueLoaded, session?.user?.id, syncProgramMutations]);
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    function handleOnline() {
      syncProgramMutations();
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session?.user?.id, syncProgramMutations]);
  const enqueueMutation = useCallback(async (mutation, nextSnapshot, successMessage, previousSnapshot) => {
    const nextQueue = mergeProgramMutationQueue(queueRef.current, mutation);
    commitSnapshot(nextSnapshot);
    await persistQueue(nextQueue);
    if (!session?.access_token || !session?.user?.id || !navigator.onLine) {
      setQueueError('Offline - changes will sync later');
      showToast('Offline - changes will sync later', 'error');
      return;
    }
    if (nextQueue.length > 1) {
      showToast(successMessage);
      syncProgramMutations();
      return;
    }

    try {
      await performProgramMutation(session.access_token, mutation);
      await persistQueue([]);
      setQueueError(null);
      await loadData(session.access_token, session.user.id);
      showToast(successMessage);
    } catch (error) {
      if (isNetworkError(error)) {
        const failedQueue = markProgramMutationFailed(nextQueue, mutation.id, 'Offline - changes will sync later');
        await persistQueue(failedQueue);
        setQueueError('Offline - changes will sync later');
        showToast('Offline - changes will sync later', 'error');
        return;
      }
      await persistQueue(nextQueue.filter((item) => item.id !== mutation.id));
      commitSnapshot(previousSnapshot);
      throw error;
    }
  }, [commitSnapshot, loadData, persistQueue, programPatientId, session?.access_token, session?.user?.id, showToast, syncProgramMutations]);
  return {
    mutationQueue,
    queueError,
    queueLoaded,
    queueSyncing,
    enqueueMutation,
    persistQueue,
    syncProgramMutations,
  };
}
