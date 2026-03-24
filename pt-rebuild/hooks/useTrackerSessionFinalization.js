// hooks/useTrackerSessionFinalization.js — finish-session notes, backdate, cancel, save lifecycle for tracker sessions
import { useCallback, useState } from 'react';
import {
    buildOptimisticLogEntry,
    toLocalDateTimeInputValue,
} from '../lib/index-tracker-session';
import { buildCreatePayload, normalizeSet } from '../lib/session-logging';

/**
 * Tracker session finalization state for the index page.
 * @param {object} options
 * @returns {object}
 */
export function useTrackerSessionFinalization({
    draftSession,
    selectedExercise,
    enqueue,
    sync,
    reload,
    showSaveSuccess,
    showToast,
    abandonDraftSession,
    setActiveExercise,
}) {
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [backdateEnabled, setBackdateEnabled] = useState(false);
    const [backdateValue, setBackdateValue] = useState('');
    const [optimisticLogs, setOptimisticLogs] = useState([]);

    const handleFinishSession = useCallback(() => {
        if (!draftSession || draftSession.sets.length === 0) {
            showToast('Please log at least one set before finishing', 'error');
            return false;
        }
        setNotesModalOpen(true);
        return true;
    }, [draftSession, showToast]);

    const handleNotesModalClose = useCallback(() => {
        setNotesModalOpen(false);
        setBackdateEnabled(false);
        setBackdateValue('');
    }, []);

    const handleCancelSession = useCallback(() => {
        if (typeof window !== 'undefined' && !window.confirm('Cancel this session? Your in-progress session will be discarded.')) return;
        handleNotesModalClose();
        abandonDraftSession();
        setActiveExercise(null);
    }, [abandonDraftSession, handleNotesModalClose, setActiveExercise]);

    const handleToggleBackdate = useCallback(() => {
        if (!draftSession) return;
        setBackdateEnabled((previous) => {
            setBackdateValue(previous ? '' : toLocalDateTimeInputValue(draftSession.date));
            return !previous;
        });
    }, [draftSession]);

    const handleSaveFinishedSession = useCallback(() => {
        if (!draftSession || !selectedExercise) return false;

        const trimmedNotes = draftSession.notes ? draftSession.notes.trim() : '';
        const finalPerformedAt = backdateEnabled && backdateValue
            ? new Date(backdateValue).toISOString()
            : draftSession.date;
        const finalSession = {
            ...draftSession,
            date: finalPerformedAt,
            notes: trimmedNotes || null,
            sets: draftSession.sets.map((set, index) => normalizeSet({
                ...set,
                set_number: index + 1,
                performed_at: finalPerformedAt,
            }, index, draftSession.activityType)),
        };
        const payload = buildCreatePayload(
            selectedExercise,
            finalSession.date,
            finalSession.notes,
            finalSession.sets
        );
        payload.client_mutation_id = finalSession.sessionId;

        enqueue(payload);
        setOptimisticLogs((previous) => [buildOptimisticLogEntry(finalSession), ...previous]);
        handleNotesModalClose();
        abandonDraftSession();
        setActiveExercise(null);

        sync([payload]).then(async (syncResult) => {
            if (syncResult?.failed === 0) {
                await reload();
                setOptimisticLogs((previous) => previous.filter((log) => log.client_mutation_id !== finalSession.sessionId));
                showSaveSuccess(trimmedNotes);
            } else {
                showToast('Offline - changes will sync later', 'error');
            }
        }).catch(() => {
            showToast('Offline - changes will sync later', 'error');
        });

        return true;
    }, [
        abandonDraftSession,
        backdateEnabled,
        backdateValue,
        draftSession,
        enqueue,
        handleNotesModalClose,
        reload,
        selectedExercise,
        setActiveExercise,
        showSaveSuccess,
        showToast,
        sync,
    ]);

    return {
        notesModalOpen,
        backdateEnabled,
        backdateValue,
        optimisticLogs,
        setBackdateValue,
        handleFinishSession,
        handleNotesModalClose,
        handleCancelSession,
        handleToggleBackdate,
        handleSaveFinishedSession,
    };
}
