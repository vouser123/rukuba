import { createInitialTimerState } from './timer-panel.js';

export function createLoggerTimerState({
    mode,
    targetReps,
    targetSeconds,
    isSided,
    selectedSide,
}) {
    const timerState = createInitialTimerState(targetReps);
    return {
        mode,
        targetReps,
        targetSeconds,
        isSided,
        selectedSide: isSided ? (selectedSide ?? 'right') : null,
        counterValue: 0,
        isRunning: timerState.isRunning,
        elapsedMs: timerState.elapsedMs,
        currentRep: timerState.currentRep,
        totalReps: timerState.totalReps,
        completedReps: timerState.completedReps,
        lastAnnouncedSecond: timerState.lastAnnouncedSecond,
        pocketOpen: false,
        partialRep: false,
    };
}

export function getElapsedSeconds(state) {
    return Math.floor((state.elapsedMs ?? 0) / 1000);
}

export function getRemainingSeconds(state) {
    return Math.max(0, (state.targetSeconds ?? 0) - getElapsedSeconds(state));
}

export function getCanApply(state, distanceFeet = 0) {
    if (state.mode === 'duration') return getElapsedSeconds(state) > 0;
    if (state.mode === 'hold') return state.completedReps > 0;
    if (state.mode === 'distance') return Number(distanceFeet ?? 0) > 0;
    return state.counterValue > 0;
}

function milestoneSpeechFromRepsLeft(repsLeft) {
    if (repsLeft === 5) return '5 reps left';
    if (repsLeft === 3) return '3 reps left';
    if (repsLeft === 1) return 'Last rep';
    if (repsLeft <= 0) return 'Set complete';
    return null;
}

export function applyLoggerTimerEvent(state, event) {
    switch (event.type) {
    case 'OPEN_EXERCISE':
        return {
            state: createLoggerTimerState(event.payload),
            effects: [],
        };

    case 'CLOSE_EXERCISE':
        return {
            state: {
                ...state,
                isRunning: false,
                pocketOpen: false,
            },
            effects: [{ type: 'clear_speech_queue' }],
        };

    case 'SELECT_SIDE':
        if (!state.isSided || !event.side || state.selectedSide === event.side) {
            return { state, effects: [] };
        }
        return {
            state: {
                ...state,
                selectedSide: event.side,
            },
            effects: [
                { type: 'clear_speech_queue' },
                { type: 'speak_text', text: `Working ${event.side} side` },
            ],
        };

    case 'INCREMENT_COUNTER': {
        const nextCounterValue = state.counterValue + 1;
        const repsLeft = state.targetReps - nextCounterValue;
        const milestone = milestoneSpeechFromRepsLeft(repsLeft);
        const effects = [
            { type: 'play_soft_tick' },
        ];
        if (repsLeft === 0) effects.push({ type: 'play_completion_triple' });
        if (milestone) effects.push({ type: 'speak_text', text: milestone });
        return {
            state: {
                ...state,
                counterValue: nextCounterValue,
                partialRep: false,
            },
            effects,
        };
    }

    case 'DECREMENT_COUNTER':
        return {
            state: {
                ...state,
                counterValue: Math.max(0, state.counterValue - 1),
            },
            effects: [],
        };

    case 'START_TIMER': {
        if (state.isRunning) return { state, effects: [] };
        const effects = [{ type: 'ensure_audio_ready' }];
        if (state.targetSeconds >= 5) {
            effects.push({ type: 'play_start_confirm' });
        }
        return {
            state: {
                ...state,
                isRunning: true,
                partialRep: false,
            },
            effects,
        };
    }

    case 'PAUSE_TIMER': {
        if (!state.isRunning && !event.announce) return { state, effects: [] };
        const effects = [];
        if (event.announce !== false && (state.targetSeconds > 5 || state.pocketOpen)) {
            effects.push({ type: 'speak_text', text: 'Pause' });
        }
        return {
            state: {
                ...state,
                isRunning: false,
            },
            effects,
        };
    }

    case 'RESET_TIMER':
        return {
            state: {
                ...state,
                isRunning: false,
                elapsedMs: 0,
                lastAnnouncedSecond: null,
                partialRep: false,
            },
            effects: [{ type: 'clear_speech_queue' }],
        };

    case 'TIMER_TICK': {
        const elapsedMs = event.elapsedMs ?? state.elapsedMs;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const remaining = Math.max(0, state.targetSeconds - elapsedSeconds);
        if (remaining === state.lastAnnouncedSecond) {
            return {
                state: {
                    ...state,
                    elapsedMs,
                },
                effects: [],
            };
        }

        if (remaining > 0) {
            const effects = [];
            if (remaining <= 3) effects.push({ type: 'play_countdown_warning' });
            return {
                state: {
                    ...state,
                    elapsedMs,
                    lastAnnouncedSecond: remaining,
                },
                effects,
            };
        }

        const effects = [{ type: 'play_completion_triple' }];
        if (state.mode === 'hold') {
            const nextCompletedReps = Math.min(state.completedReps + 1, state.totalReps);
            const repsLeft = state.totalReps - nextCompletedReps;
            const milestone = milestoneSpeechFromRepsLeft(repsLeft);
            if (milestone) effects.push({ type: 'speak_text', text: milestone });
            return {
                state: {
                    ...state,
                    isRunning: false,
                    elapsedMs: 0,
                    lastAnnouncedSecond: null,
                    completedReps: nextCompletedReps,
                    currentRep: Math.min(nextCompletedReps + 1, state.totalReps),
                    partialRep: false,
                },
                effects,
            };
        }

        effects.push({ type: 'speak_text', text: 'Set complete' });
        return {
            state: {
                ...state,
                isRunning: false,
                elapsedMs: state.targetSeconds * 1000,
                lastAnnouncedSecond: 0,
                partialRep: false,
            },
            effects,
        };
    }

    case 'POCKET_OPEN':
        return {
            state: {
                ...state,
                pocketOpen: true,
            },
            effects: [],
        };

    case 'POCKET_CLOSE':
        return {
            state: {
                ...state,
                pocketOpen: false,
            },
            effects: [],
        };

    case 'POCKET_LONG_PRESS': {
        if (state.mode !== 'hold') return { state, effects: [] };
        const nextCompletedReps = Math.min(state.completedReps + 1, state.totalReps);
        return {
            state: {
                ...state,
                isRunning: false,
                elapsedMs: 0,
                lastAnnouncedSecond: null,
                completedReps: nextCompletedReps,
                currentRep: Math.min(nextCompletedReps + 1, state.totalReps),
                partialRep: true,
            },
            effects: [{ type: 'play_partial_confirm' }],
        };
    }

    default:
        return { state, effects: [] };
    }
}
