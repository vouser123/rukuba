import styles from './TimerPanel.module.css';
import { useTimerSpeech } from '../hooks/useTimerSpeech';

export default function TimerPanel({
    isOpen,
    exercise,
    onClose,
    onApplySet,
    onOpenManual,
}) {
    const timer = useTimerSpeech(exercise, isOpen);

    if (!isOpen || !exercise) return null;

    const canApplyReps = timer.counterValue > 0;
    const canApplyDuration = timer.mode === 'duration' && timer.elapsedSeconds > 0;
    const canApplyHold = timer.mode === 'hold' && timer.completedReps > 0;
    const canApplyDistance = timer.mode === 'distance' && Number(exercise?.distance_feet ?? 0) > 0;
    const canApply = canApplyReps || canApplyDuration || canApplyHold || canApplyDistance;
    const isTimerMode = timer.mode === 'hold' || timer.mode === 'duration';

    return (
        <div className={styles.overlay} onPointerUp={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section className={styles.panel} aria-label="Exercise timer and counter">
                <header className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Exercise Mode</h2>
                        <p className={styles.subtitle}>{exercise.canonical_name}</p>
                    </div>
                    <button className={styles.closeBtn} type="button" onPointerUp={onClose}>Close</button>
                </header>

                {timer.isSided && (
                    <div className={styles.sideRow}>
                        <span className={styles.sideLabel}>Working side</span>
                        <div className={styles.sideButtons}>
                            <button
                                type="button"
                                onPointerUp={() => timer.setSelectedSide('left')}
                                className={`${styles.sideBtn} ${timer.selectedSide === 'left' ? styles.sideActive : ''}`}
                            >
                                Left
                            </button>
                            <button
                                type="button"
                                onPointerUp={() => timer.setSelectedSide('right')}
                                className={`${styles.sideBtn} ${timer.selectedSide === 'right' ? styles.sideActive : ''}`}
                            >
                                Right
                            </button>
                        </div>
                    </div>
                )}

                {timer.mode === 'reps' && (
                    <div className={styles.modeBlock}>
                        <p className={styles.repInfo}>{timer.repInfoText}</p>
                        <div className={styles.counterValue}>{timer.counterValue}</div>
                        <div className={styles.controlRow}>
                            <button type="button" className={styles.secondaryBtn} onPointerUp={timer.decrementCounter}>-</button>
                            <button type="button" className={styles.primaryBtn} onPointerUp={timer.incrementCounter}>+1 Rep</button>
                            <button type="button" className={styles.secondaryBtn} onPointerUp={timer.resetCounter}>Reset</button>
                        </div>
                    </div>
                )}

                {isTimerMode && (
                    <div className={styles.modeBlock}>
                        <p className={styles.repInfo}>{timer.repInfoText}</p>
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

                <footer className={styles.footer}>
                    <button
                        type="button"
                        className={styles.applyBtn}
                        disabled={!canApply}
                        onPointerUp={() => onApplySet?.(timer.buildCurrentSetPatch())}
                    >
                        Use This Value
                    </button>
                    <button type="button" className={styles.secondaryBtn} onPointerUp={onOpenManual}>
                        Open Full Log Form
                    </button>
                </footer>
            </section>
        </div>
    );
}
