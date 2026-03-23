// hooks/useLoggerFeedback.js — tracker save/speech feedback for session completion, comparisons, and success copy
import { useCallback, useEffect, useState } from 'react';
import { buildSessionProgress } from '../lib/index-tracker-session';
// Note: useState kept for allSetsAnnounced only; successMessage removed in favour of useToast

/**
 * @param {Function} showToast - from useToast; used for save-success feedback
 */
export function useLoggerFeedback(selectedExercise, sessionStartedAt, showToast) {
    const [allSetsAnnounced, setAllSetsAnnounced] = useState(false);

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
        const nextProgress = buildSessionProgress(exercise, nextSets);
        if (!nextProgress.allComplete) return;
        setAllSetsAnnounced(true);
        speakText('All sets complete', 500);
    }, [allSetsAnnounced, speakText]);

    const showSaveSuccess = useCallback((notesText = '') => {
        const notesStatus = String(notesText).trim() ? 'with notes' : 'no notes';
        showToast(`Saved (${notesStatus})`, 'success');
    }, [showToast]);

    useEffect(() => {
        setAllSetsAnnounced(false);
    }, [selectedExercise?.id, sessionStartedAt]);

    return {
        maybeAnnounceAllSetsComplete,
        showSaveSuccess,
        speakText,
    };
}
