// hooks/useLoggerFeedback.js — tracker save/speech feedback for session completion, comparisons, and success copy
import { useCallback, useEffect, useState } from 'react';

function buildSessionProgressFromSets(exercise, sets) {
    const targetSets = Number(exercise?.current_sets ?? 0) || 0;
    const leftCount = sets.filter((set) => set?.side === 'left').length;
    const rightCount = sets.filter((set) => set?.side === 'right').length;
    const totalLogged = sets.length;
    const allComplete = exercise?.pattern === 'side'
        ? targetSets > 0 && leftCount >= targetSets && rightCount >= targetSets
        : targetSets > 0 && totalLogged >= targetSets;

    return {
        allComplete,
        leftCount,
        rightCount,
        targetSets,
        totalLogged,
    };
}

export function useLoggerFeedback(selectedExercise, sessionStartedAt) {
    const [allSetsAnnounced, setAllSetsAnnounced] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const speakText = useCallback((text, delayMs = 0) => {
        if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

        const speakNow = () => {
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            } catch {
                // Speech availability is best-effort only.
            }
        };

        if (delayMs > 0) {
            window.setTimeout(speakNow, delayMs);
            return;
        }

        speakNow();
    }, []);

    const maybeAnnounceAllSetsComplete = useCallback((exercise, nextSets) => {
        if (!exercise || allSetsAnnounced) return;
        const nextProgress = buildSessionProgressFromSets(exercise, nextSets);
        if (!nextProgress.allComplete) return;
        setAllSetsAnnounced(true);
        speakText('All sets complete', 500);
    }, [allSetsAnnounced, speakText]);

    const showSaveSuccess = useCallback((notesText = '') => {
        const notesStatus = String(notesText).trim() ? 'with notes' : 'no notes';
        setSuccessMessage(`Saved (${notesStatus})`);
    }, []);

    useEffect(() => {
        setAllSetsAnnounced(false);
    }, [selectedExercise?.id, sessionStartedAt]);

    useEffect(() => {
        if (!successMessage) return undefined;
        const timeoutId = window.setTimeout(() => setSuccessMessage(''), 3000);
        return () => window.clearTimeout(timeoutId);
    }, [successMessage]);

    return {
        successMessage,
        maybeAnnounceAllSetsComplete,
        showSaveSuccess,
        speakText,
    };
}
