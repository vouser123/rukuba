// hooks/useExerciseTimer.js — timer state machine for hold and duration execution flows
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimerDisplay } from '../lib/timer-panel';
import {
    applyLoggerTimerEvent,
    createLoggerTimerState,
    getRemainingSeconds,
} from '../lib/logger-timer-machine';

export function useExerciseTimer({
    mode,
    targetReps,
    targetSeconds,
    isOpen,
    audio,
    getDurationCompletionSpeech,
}) {
    const [timer, setTimer] = useState(() => createLoggerTimerState({
        mode,
        targetReps,
        targetSeconds,
        isSided: false,
        selectedSide: null,
    }));
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
        setTimer(createLoggerTimerState({
            mode,
            targetReps,
            targetSeconds,
            isSided: false,
            selectedSide: null,
        }));
    }, [clearTimerInterval, isOpen, mode, targetReps, targetSeconds]);

    const dispatchTimerEvent = useCallback((event) => {
        setTimer((prev) => {
            const { state, effects } = applyLoggerTimerEvent(prev, event);
            audio.executeEffects(effects);
            return state;
        });
    }, [audio]);

    const pauseTimer = useCallback((announce = true) => {
        clearTimerInterval();
        dispatchTimerEvent({ type: 'PAUSE_TIMER', announce });
    }, [clearTimerInterval, dispatchTimerEvent]);

    const resetTimer = useCallback(() => {
        clearTimerInterval();
        dispatchTimerEvent({ type: 'RESET_TIMER' });
    }, [clearTimerInterval, dispatchTimerEvent]);

    const startTimer = useCallback(() => {
        if (intervalRef.current) return;
        dispatchTimerEvent({ type: 'START_TIMER' });
        const startFrom = Date.now() - timerRef.current.elapsedMs;

        intervalRef.current = setInterval(() => {
            const elapsedMs = Date.now() - startFrom;
            setTimer((prev) => {
                const { state, effects } = applyLoggerTimerEvent(prev, {
                    type: 'TIMER_TICK',
                    elapsedMs,
                });
                const resolvedEffects = effects.map((effect) => {
                    if (
                        mode === 'duration'
                        && effect.type === 'speak_text'
                        && effect.text === 'Set complete'
                        && typeof getDurationCompletionSpeech === 'function'
                    ) {
                        return {
                            ...effect,
                            text: getDurationCompletionSpeech(),
                        };
                    }
                    return effect;
                });
                audio.executeEffects(resolvedEffects);
                if (!state.isRunning && intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                return state;
            });
        }, 100);
    }, [audio, clearTimerInterval, dispatchTimerEvent, getDurationCompletionSpeech, mode]);

    const toggleTimer = useCallback(() => {
        if (timerRef.current.isRunning) pauseTimer();
        else startTimer();
    }, [pauseTimer, startTimer]);

    const recordPartialRep = useCallback(() => {
        if (mode !== 'hold') return;
        clearTimerInterval();
        dispatchTimerEvent({ type: 'POCKET_LONG_PRESS' });
    }, [clearTimerInterval, dispatchTimerEvent, mode]);

    const setPocketOpen = useCallback((isPocketOpen) => {
        dispatchTimerEvent({ type: isPocketOpen ? 'POCKET_OPEN' : 'POCKET_CLOSE' });
    }, [dispatchTimerEvent]);

    const remainingSeconds = useMemo(() => getRemainingSeconds(timer), [timer]);
    const elapsedSeconds = useMemo(() => Math.floor(timer.elapsedMs / 1000), [timer.elapsedMs]);

    return {
        isRunning: timer.isRunning,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
        completedReps: timer.completedReps,
        elapsedSeconds,
        remainingSeconds,
        timerDisplay: formatTimerDisplay(remainingSeconds),
        partialRep: timer.partialRep,
        startTimer,
        pauseTimer,
        resetTimer,
        toggleTimer,
        recordPartialRep,
        setPocketOpen,
    };
}
