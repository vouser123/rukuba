import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function getMode(exercise) {
    const modifiers = exercise?.pattern_modifiers ?? [];
    const dosageType = exercise?.dosage_type ?? null;
    if (modifiers.includes('distance_feet') || dosageType === 'distance') return 'distance';
    if (modifiers.includes('duration_seconds') || dosageType === 'duration') return 'duration';
    if (modifiers.includes('hold_seconds') || dosageType === 'hold') return 'hold';
    return 'reps';
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useTimerSpeech(exercise, isOpen = false) {
    const mode = useMemo(() => getMode(exercise), [exercise]);
    const isSided = exercise?.pattern === 'side';
    const targetReps = Number(exercise?.current_reps ?? 0) || 0;
    const targetSeconds = mode === 'duration'
        ? Number(exercise?.seconds_per_set ?? exercise?.seconds_per_rep ?? 60) || 60
        : Number(exercise?.seconds_per_rep ?? 10) || 10;

    const [counterValue, setCounterValue] = useState(0);
    const [selectedSide, setSelectedSide] = useState(isSided ? 'right' : null);
    const [timer, setTimer] = useState({
        isRunning: false,
        elapsedMs: 0,
        currentRep: 1,
        totalReps: Math.max(1, targetReps || 1),
        completedReps: 0,
        lastAnnouncedSecond: null,
    });

    const timerRef = useRef(timer);
    const intervalRef = useRef(null);
    const audioContextRef = useRef(null);

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
        setCounterValue(0);
        setSelectedSide(isSided ? 'right' : null);
        setTimer({
            isRunning: false,
            elapsedMs: 0,
            currentRep: 1,
            totalReps: Math.max(1, targetReps || 1),
            completedReps: 0,
            lastAnnouncedSecond: null,
        });
    }, [clearTimerInterval, exercise, isOpen, isSided, targetReps]);

    const ensureAudioReady = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (Ctx) audioContextRef.current = new Ctx();
            }
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        } catch {
            audioContextRef.current = null;
        }
    }, []);

    const playBeep = useCallback((frequency = 800, duration = 200, gain = 0.4) => {
        try {
            ensureAudioReady();
            const context = audioContextRef.current;
            if (!context) return;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = 'square';
            const durationInSeconds = duration / 1000;
            gainNode.gain.setValueAtTime(gain, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + durationInSeconds);
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + durationInSeconds);
        } catch {
            // Audio availability is best-effort only.
        }
    }, [ensureAudioReady]);

    const playCompletionSound = useCallback(() => {
        playBeep(1000, 150);
        setTimeout(() => playBeep(1200, 150), 200);
        setTimeout(() => playBeep(1400, 200), 400);
    }, [playBeep]);

    const speakText = useCallback((text) => {
        try {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch {
            // Speech availability is best-effort only.
        }
    }, []);

    const pauseTimer = useCallback((announce = true) => {
        clearTimerInterval();
        setTimer((prev) => ({ ...prev, isRunning: false }));
        if (announce && targetSeconds > 10) speakText('Pause');
    }, [clearTimerInterval, speakText, targetSeconds]);

    const resetTimer = useCallback(() => {
        pauseTimer(false);
        setTimer((prev) => ({
            ...prev,
            elapsedMs: 0,
            currentRep: 1,
            completedReps: 0,
            lastAnnouncedSecond: null,
            totalReps: Math.max(1, targetReps || 1),
        }));
    }, [pauseTimer, targetReps]);

    const startTimer = useCallback(() => {
        if (intervalRef.current) return;
        ensureAudioReady();
        if (targetSeconds > 10) speakText('Start');

        const startFrom = Date.now() - timerRef.current.elapsedMs;
        setTimer((prev) => ({ ...prev, isRunning: true }));

        intervalRef.current = setInterval(() => {
            const snapshot = timerRef.current;
            const elapsedMs = Date.now() - startFrom;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const remaining = Math.max(0, targetSeconds - elapsedSeconds);
            const previousRemaining = snapshot.lastAnnouncedSecond;

            if (remaining !== previousRemaining) {
                if (remaining <= 3 && remaining > 0) playBeep(600, 100, 0.35);

                if (remaining === 0) {
                    playCompletionSound();
                    clearTimerInterval();

                    if (mode === 'hold') {
                        const nextCompletedReps = Math.min(snapshot.completedReps + 1, snapshot.totalReps);
                        const repsLeft = snapshot.totalReps - nextCompletedReps;
                        if (repsLeft <= 0) speakText('Set complete');
                        else if (repsLeft === 1) speakText('Last rep');
                        else if (repsLeft === 3) speakText('3 reps left');
                        else if (repsLeft === 5) speakText('5 reps left');

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

                    speakText('Set complete');
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
    }, [
        clearTimerInterval,
        ensureAudioReady,
        mode,
        playBeep,
        playCompletionSound,
        speakText,
        targetSeconds,
    ]);

    const toggleTimer = useCallback(() => {
        if (timerRef.current.isRunning) pauseTimer();
        else startTimer();
    }, [pauseTimer, startTimer]);

    const incrementCounter = useCallback(() => {
        setCounterValue((prev) => {
            const next = prev + 1;
            playBeep(440, 80, 0.25);
            if (targetReps > 0) {
                const repsLeft = targetReps - next;
                if (repsLeft === 5) speakText('5 reps left');
                else if (repsLeft === 3) speakText('3 reps left');
                else if (repsLeft === 1) speakText('Last rep');
                else if (repsLeft === 0) {
                    playCompletionSound();
                    speakText('Set complete');
                }
            }
            return next;
        });
    }, [playBeep, playCompletionSound, speakText, targetReps]);

    const decrementCounter = useCallback(() => {
        setCounterValue((prev) => Math.max(0, prev - 1));
    }, []);

    const resetCounter = useCallback(() => {
        setCounterValue(0);
    }, []);

    const remainingSeconds = useMemo(
        () => Math.max(0, targetSeconds - Math.floor(timer.elapsedMs / 1000)),
        [targetSeconds, timer.elapsedMs]
    );

    const elapsedSeconds = useMemo(
        () => Math.floor(timer.elapsedMs / 1000),
        [timer.elapsedMs]
    );

    const timerDisplay = useMemo(
        () => formatTime(Math.max(0, remainingSeconds) * 1000),
        [remainingSeconds]
    );

    const repInfoText = useMemo(() => {
        if (mode === 'duration') return 'Duration Exercise';
        if (mode === 'hold') {
            if (timer.completedReps >= timer.totalReps) return 'Set complete';
            return `Rep ${timer.currentRep} of ${timer.totalReps}`;
        }
        return targetReps > 0 ? `${counterValue} / ${targetReps} reps` : `${counterValue} reps`;
    }, [counterValue, mode, targetReps, timer.completedReps, timer.currentRep, timer.totalReps]);

    const buildCurrentSetPatch = useCallback(() => {
        if (mode === 'distance') {
            return {
                reps: null,
                seconds: null,
                distance_feet: Number(exercise?.distance_feet ?? 0) || null,
                side: selectedSide,
            };
        }

        if (mode === 'duration') {
            return {
                reps: 1,
                seconds: elapsedSeconds > 0 ? elapsedSeconds : targetSeconds,
                distance_feet: null,
                side: selectedSide,
                manual_log: false,
            };
        }

        if (mode === 'hold') {
            const repsDone = Math.min(timerRef.current.completedReps, timerRef.current.totalReps);
            return {
                reps: repsDone > 0 ? repsDone : null,
                seconds: targetSeconds,
                distance_feet: null,
                side: selectedSide,
                manual_log: false,
            };
        }

        return {
            reps: counterValue > 0 ? counterValue : (targetReps || null),
            seconds: null,
            distance_feet: null,
            side: selectedSide,
            manual_log: false,
        };
    }, [counterValue, elapsedSeconds, exercise?.distance_feet, mode, selectedSide, targetReps, targetSeconds]);

    return {
        mode,
        isSided,
        selectedSide,
        setSelectedSide,
        counterValue,
        targetReps,
        incrementCounter,
        decrementCounter,
        resetCounter,
        isRunning: timer.isRunning,
        targetSeconds,
        remainingSeconds,
        elapsedSeconds,
        timerDisplay,
        repInfoText,
        currentRep: timer.currentRep,
        totalReps: timer.totalReps,
        completedReps: timer.completedReps,
        startTimer,
        pauseTimer,
        resetTimer,
        toggleTimer,
        buildCurrentSetPatch,
    };
}
