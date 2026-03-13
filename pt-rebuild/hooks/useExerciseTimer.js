// hooks/useExerciseTimer.js — timer state machine for hold and duration execution flows

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialTimerState, formatTimerDisplay } from '../lib/timer-panel';

export function useExerciseTimer({
    mode,
    targetReps,
    targetSeconds,
    isOpen,
    audio,
}) {
    const [timer, setTimer] = useState(() => createInitialTimerState(targetReps));
    const [partialRep, setPartialRep] = useState(false);

    const timerRef = useRef(timer);
    const intervalRef = useRef(null);

    useEffect(() => {
        timerRef.current = timer;
    }, [timer]);

    const clearTimerInterval = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => () => clearTimerInterval(), [clearTimerInterval]);

    useEffect(() => {
        clearTimerInterval();
        setPartialRep(false);
        setTimer(createInitialTimerState(targetReps));
    }, [clearTimerInterval, isOpen, targetReps]);

    const pauseTimer = useCallback((announce = true) => {
        clearTimerInterval();
        setTimer((prev) => ({ ...prev, isRunning: false }));
        if (announce && targetSeconds > 10) {
            audio.speakText('Pause');
        }
    }, [audio, clearTimerInterval, targetSeconds]);

    const resetTimer = useCallback(() => {
        pauseTimer(false);
        setPartialRep(false);
        setTimer(createInitialTimerState(targetReps));
    }, [pauseTimer, targetReps]);

    const startTimer = useCallback(() => {
        if (intervalRef.current) return;
        audio.ensureAudioReady();
        if (targetSeconds > 10) {
            audio.speakText('Start');
        }

        const startFrom = Date.now() - timerRef.current.elapsedMs;
        setPartialRep(false);
        setTimer((prev) => ({ ...prev, isRunning: true }));

        intervalRef.current = setInterval(() => {
            const snapshot = timerRef.current;
            const elapsedMs = Date.now() - startFrom;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const remaining = Math.max(0, targetSeconds - elapsedSeconds);
            const previousRemaining = snapshot.lastAnnouncedSecond;

            if (remaining !== previousRemaining) {
                if (remaining <= 3 && remaining > 0) {
                    audio.playBeep(600, 100, 0.35);
                }

                if (remaining === 0) {
                    audio.playCompletionSound();
                    clearTimerInterval();

                    if (mode === 'hold') {
                        const nextCompletedReps = Math.min(snapshot.completedReps + 1, snapshot.totalReps);
                        const repsLeft = snapshot.totalReps - nextCompletedReps;

                        if (repsLeft <= 0) audio.speakText('Set complete');
                        else if (repsLeft === 1) audio.speakText('Last rep');
                        else if (repsLeft === 3) audio.speakText('3 reps left');
                        else if (repsLeft === 5) audio.speakText('5 reps left');

                        setPartialRep(false);
                        setTimer((prev) => ({
                            ...prev,
                            isRunning: false,
                            elapsedMs: 0,
                            lastAnnouncedSecond: null,
                            completedReps: nextCompletedReps,
                            currentRep: Math.min(nextCompletedReps + 1, prev.totalReps),
                        }));
                        return;
                    }

                    audio.speakText('Set complete');
                    setTimer((prev) => ({
                        ...prev,
                        isRunning: false,
                        elapsedMs: targetSeconds * 1000,
                        lastAnnouncedSecond: 0,
                    }));
                    return;
                }
            }

            setTimer((prev) => ({
                ...prev,
                elapsedMs,
                lastAnnouncedSecond: remaining,
            }));
        }, 100);
    }, [audio, clearTimerInterval, mode, targetSeconds]);

    const toggleTimer = useCallback(() => {
        if (timerRef.current.isRunning) pauseTimer();
        else startTimer();
    }, [pauseTimer, startTimer]);

    const recordPartialRep = useCallback(() => {
        if (mode !== 'hold') return;
        pauseTimer(false);
        setPartialRep(true);
        setTimer((prev) => {
            const nextCompletedReps = Math.min(prev.completedReps + 1, prev.totalReps);
            return {
                ...prev,
                elapsedMs: 0,
                lastAnnouncedSecond: null,
                completedReps: nextCompletedReps,
                currentRep: Math.min(nextCompletedReps + 1, prev.totalReps),
            };
        });
    }, [mode, pauseTimer]);

    const remainingSeconds = useMemo(
        () => Math.max(0, targetSeconds - Math.floor(timer.elapsedMs / 1000)),
        [targetSeconds, timer.elapsedMs]
    );

    const elapsedSeconds = useMemo(
        () => Math.floor(timer.elapsedMs / 1000),
        [timer.elapsedMs]
    );

    return {
        isRunning: timer.isRunning,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
        completedReps: timer.completedReps,
        elapsedSeconds,
        remainingSeconds,
        timerDisplay: formatTimerDisplay(remainingSeconds),
        partialRep,
        startTimer,
        pauseTimer,
        resetTimer,
        toggleTimer,
        recordPartialRep,
    };
}
