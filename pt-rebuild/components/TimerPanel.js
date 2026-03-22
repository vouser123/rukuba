// components/TimerPanel.js — in-panel exercise execution UI for reps/timer flows

import { useEffect, useRef, useState } from 'react';
import PocketModeOverlay from './PocketModeOverlay';
import styles from './TimerPanel.module.css';
import { useTimerSpeech } from '../hooks/useTimerSpeech';

export default function TimerPanel({
    isOpen,
    exercise,
    resetToken = 0,
    sessionProgress,
    selectedSide = null,
    onSideChange,
    onClose,
    onFinish,
    onBack,
    onApplySet,
    onOpenManual,
}) {
    const timer = useTimerSpeech(exercise, isOpen, resetToken, sessionProgress, selectedSide, onSideChange);
    const [isPocketOpen, setIsPocketOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const syncPocketOpen = timer.setPocketOpen;
    const previousCompletedRepsRef = useRef(timer.completedReps);

    useEffect(() => {
        syncPocketOpen?.(isPocketOpen);
    }, [isPocketOpen, syncPocketOpen]);

    useEffect(() => {
        if (!isOpen) setIsPocketOpen(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setStatusMessage('');
            previousCompletedRepsRef.current = timer.completedReps;
            return;
        }

        const previousCompletedReps = previousCompletedRepsRef.current;
        previousCompletedRepsRef.current = timer.completedReps;

        if (
            timer.mode === 'hold'
            && timer.completedReps > previousCompletedReps
            && timer.completedReps < timer.totalReps
        ) {
            setStatusMessage(`Rep ${timer.completedReps} complete`);
            return;
        }

        if (timer.mode !== 'hold') {
            setStatusMessage('');
        }
    }, [isOpen, timer.completedReps, timer.mode, timer.totalReps]);

    useEffect(() => {
        if (!statusMessage) return undefined;
        const timeoutId = window.setTimeout(() => setStatusMessage(''), 2000);
        return () => window.clearTimeout(timeoutId);
    }, [statusMessage]);

    if (!isOpen || !exercise) return null;

    const isTimerMode = timer.mode === 'hold' || timer.mode === 'duration';
    const targetSets = sessionProgress?.targetSets ?? 0;
    const totalLogged = sessionProgress?.totalLogged ?? 0;
    const leftCount = sessionProgress?.leftCount ?? 0;
    const rightCount = sessionProgress?.rightCount ?? 0;
    const setsLeft = Math.max(0, targetSets - totalLogged);
    const sideLabel = timer.selectedSide === 'left' ? 'Working left side' : 'Working right side';
    const pocketMeta = isTimerMode
        ? `Rep ${timer.currentRep} of ${timer.totalReps} · Sets left: ${setsLeft} · ${timer.isRunning ? 'Running' : 'Paused'}`
        : `Sets left: ${setsLeft} · Reps left: ${Math.max(0, timer.targetReps - timer.counterValue)}`;
    const pocketHint = isTimerMode
        ? (timer.isRunning ? 'Tap to pause · Hold for partial' : 'Tap to start')
        : 'Tap to count';

    return (
        <div className={styles.overlay} onPointerUp={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section className={styles.panel} aria-label="Exercise timer and counter">
                <header className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{exercise.canonical_name}</h2>
                        <p className={styles.subtitle}>{timer.targetDoseText}</p>
                    </div>
                    <button className={styles.closeBtn} type="button" onPointerUp={onFinish ?? onClose}>Done</button>
                </header>

                {timer.isSided && (
                    <div className={styles.sideRow}>
                        <span className={styles.sideLabel}>{sideLabel}</span>
                        <div className={styles.sideButtons}>
                            <button
                                type="button"
                                onPointerUp={() => timer.setSelectedSide('left')}
                                className={`${styles.sideBtn} ${timer.selectedSide === 'left' ? styles.sideActive : ''}`}
                            >
                                👈 Left
                            </button>
                            <button
                                type="button"
                                onPointerUp={() => timer.setSelectedSide('right')}
                                className={`${styles.sideBtn} ${timer.selectedSide === 'right' ? styles.sideActive : ''}`}
                            >
                                👉 Right
                            </button>
                        </div>
                    </div>
                )}

                {timer.mode === 'reps' && (
                    <div className={styles.modeBlock}>
                        <p className={styles.counterLabel}>Reps</p>
                        <button type="button" className={styles.counterDisplay} onPointerUp={timer.incrementCounter}>
                            {timer.counterValue}
                        </button>
                        <div className={styles.controlRow}>
                            <button type="button" className={styles.secondaryBtn} onPointerUp={timer.decrementCounter}>− Undo</button>
                        </div>
                    </div>
                )}

                {isTimerMode && (
                    <div className={styles.modeBlock}>
                        <p className={styles.repInfo}>{timer.repInfoText}</p>
                        {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
                        <div className={styles.timerDisplay}>{timer.timerDisplay}</div>
                        <p className={styles.targetText}>Target: {timer.targetSeconds} seconds</p>
                        <div className={styles.controlRow}>
                            <button type="button" className={styles.primaryBtn} onPointerUp={timer.toggleTimer}>
                                {timer.isRunning ? 'Pause' : 'Start'}
                            </button>
                            <button type="button" className={styles.secondaryBtn} onPointerUp={timer.resetTimer}>Reset</button>
                        </div>
                    </div>
                )}

                {timer.mode === 'distance' && (
                    <div className={styles.modeBlock}>
                        <p className={styles.repInfo}>Distance Exercise</p>
                        <div className={styles.counterValue}>{exercise.distance_feet ?? 0} ft</div>
                    </div>
                )}

                <div className={styles.setInfo}>
                    {timer.isSided ? (
                        <>
                            <div className={styles.setInfoRow}>
                                <span>👈 Left:</span>
                                <span>{leftCount}/{targetSets}</span>
                            </div>
                            <div className={styles.setInfoRow}>
                                <span>👉 Right:</span>
                                <span>{rightCount}/{targetSets}</span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.setInfoRow}>
                            <span>Sets:</span>
                            <span>{totalLogged}/{targetSets}</span>
                        </div>
                    )}
                    <div className={styles.setInfoRow}>
                        <span>Target:</span>
                        <span>{timer.targetDoseText}</span>
                    </div>
                </div>

                <footer className={styles.controlFooter}>
                    <button type="button" className={styles.secondaryBtn} disabled>Previous</button>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onPointerUp={() => onOpenManual?.({ side: timer.selectedSide })}
                    >
                        Log Set
                    </button>
                    <button
                        type="button"
                        className={styles.successBtn}
                        disabled={!timer.canApply}
                        onPointerUp={() => onApplySet?.(timer.buildCurrentSetPatch())}
                    >
                        Next Set
                    </button>
                </footer>
                <button type="button" className={styles.finishBtn} onPointerUp={onFinish ?? onClose}>Done</button>
                <button type="button" className={styles.pocketBtn} onPointerUp={() => setIsPocketOpen(true)}>Pocket Mode</button>
                <button type="button" className={styles.backBtn} onPointerUp={onBack ?? onClose}>← Back to Exercises</button>
            </section>
            <PocketModeOverlay
                isOpen={isPocketOpen}
                label={isTimerMode ? timer.timerDisplay : String(timer.counterValue)}
                meta={pocketMeta}
                hint={pocketHint}
                onClose={() => setIsPocketOpen(false)}
                onTap={isTimerMode ? timer.toggleTimer : timer.incrementCounter}
                onLongPress={isTimerMode ? timer.recordPartialRep : null}
                longPressEnabled={timer.mode === 'hold'}
            />
        </div>
    );
}
