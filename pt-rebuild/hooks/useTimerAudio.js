// hooks/useTimerAudio.js — audio and speech side effects for exercise execution feedback

import { useCallback, useRef } from 'react';

export function useTimerAudio() {
    const audioContextRef = useRef(null);

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

    const clearSpeechQueue = useCallback(() => {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        } catch {
            // Speech availability is best-effort only.
        }
    }, []);

    const executeEffects = useCallback((effects = []) => {
        effects.forEach((effect) => {
            switch (effect.type) {
            case 'ensure_audio_ready':
                ensureAudioReady();
                break;
            case 'play_soft_tick':
                playBeep(440, 80, 0.25);
                break;
            case 'play_start_confirm':
                playBeep(520, 90, 0.3);
                break;
            case 'play_countdown_warning':
                playBeep(600, 100, 0.35);
                break;
            case 'play_completion_triple':
                playCompletionSound();
                break;
            case 'play_partial_confirm':
                playBeep(500, 150, 0.4);
                break;
            case 'clear_speech_queue':
                clearSpeechQueue();
                break;
            case 'speak_text':
                if (effect.text) speakText(effect.text);
                break;
            default:
                break;
            }
        });
    }, [clearSpeechQueue, ensureAudioReady, playBeep, playCompletionSound, speakText]);

    return {
        ensureAudioReady,
        playBeep,
        playCompletionSound,
        speakText,
        clearSpeechQueue,
        executeEffects,
    };
}
