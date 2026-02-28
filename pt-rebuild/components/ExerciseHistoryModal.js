/**
 * ExerciseHistoryModal — shows all logged sessions for a single exercise.
 *
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   exerciseName  string — display name shown in the title
 *   logs          array — all logs for this exercise (pre-filtered by parent)
 */
import { useState } from 'react';
import styles from './ExerciseHistoryModal.module.css';

export default function ExerciseHistoryModal({ isOpen, onClose, exerciseName, logs }) {
    const [search, setSearch] = useState('');

    if (!isOpen) return null;

    const filtered = search
        ? logs.filter(l =>
            l.notes?.toLowerCase().includes(search.toLowerCase()) ||
            new Date(l.performed_at).toLocaleDateString().includes(search)
        )
        : logs;

    // Sort newest first
    const sorted = [...filtered].sort(
        (a, b) => new Date(b.performed_at) - new Date(a.performed_at)
    );

    function formatDate(isoString) {
        return new Date(isoString).toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            year: 'numeric', hour: 'numeric', minute: '2-digit',
        });
    }

    function summarizeSets(sets) {
        if (!sets?.length) return 'No set data';
        return sets.map(s => {
            const parts = [`Set ${s.set_number}`];
            if (s.reps)           parts.push(`${s.reps} reps`);
            if (s.seconds)        parts.push(`${s.seconds}s`);
            if (s.distance_feet)  parts.push(`${s.distance_feet} ft`);
            if (s.side)           parts.push(s.side);
            return parts.join(' · ');
        }).join(' | ');
    }

    return (
        <div className={styles.overlay} onPointerUp={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{exerciseName}</h2>
                        <p className={styles.subtitle}>{sorted.length} session{sorted.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button className={styles['close-btn']} onPointerUp={onClose} aria-label="Close">✕</button>
                </div>

                <div className={styles.search}>
                    <input
                        type="text"
                        placeholder="Search by date or notes…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles['search-input']}
                    />
                </div>

                <div className={styles.list}>
                    {sorted.length === 0 && (
                        <p className={styles.empty}>No sessions found.</p>
                    )}
                    {sorted.map(log => (
                        <div key={log.id} className={styles.item}>
                            <div className={styles['item-date']}>{formatDate(log.performed_at)}</div>
                            <div className={styles['item-sets']}>{summarizeSets(log.sets)}</div>
                            {log.notes && (
                                <div className={styles['item-notes']}>{log.notes}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
