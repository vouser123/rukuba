// components/HistoryList.js — session history grouped by date with expandable set detail
import styles from './HistoryList.module.css';

/**
 * History list grouped by date with expandable session cards.
 * All data is pre-filtered and grouped by the parent (via groupLogsByDate + applyFilters).
 *
 * @param {Array}    groups           - Log groups: [{ dateKey, displayDate, logs }]
 * @param {Set}      expandedSessions - Set of log ids currently expanded
 * @param {Function} onToggleSession  - Toggle a session's expanded state by log id
 * @param {Function} onExerciseClick  - Open exercise history modal (exerciseId, exerciseName)
 */
export default function HistoryList({ groups, expandedSessions, onToggleSession, onExerciseClick }) {
    if (groups.length === 0) return <div className={styles['empty-state']}>No history to show.</div>;

    /** Format a log's sets into a compact summary string. */
    function summarizeSets(sets) {
        if (!sets?.length) return '';
        return sets.map(s => [
            s.reps && `${s.reps} reps`,
            s.seconds && `${s.seconds}s`,
            s.distance_feet && `${s.distance_feet} ft`,
            s.side,
        ].filter(Boolean).join(' · ')).join(' | ');
    }

    return (
        <div className={styles['history-section']}>
            {groups.map(({ dateKey, displayDate, logs }) => (
                <div key={dateKey} className={styles['grouped-by-date']}>
                    <div className={styles['date-group-header']}>
                        {displayDate} — {logs.length} session{logs.length !== 1 ? 's' : ''}
                    </div>
                    {logs.map(log => {
                        const isExpanded = expandedSessions.has(log.id);
                        return (
                            <div
                                key={log.id}
                                className={`${styles['session-card']} ${log.notes ? styles['has-notes'] : ''} ${isExpanded ? styles.expanded : ''}`}
                                onPointerUp={() => onToggleSession(log.id)}
                            >
                                <div className={styles['session-card-compact']}>
                                    <div className={styles['session-time-col']}>
                                        {new Date(log.performed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </div>
                                    <div className={styles['session-main-col']}>
                                        <div className={styles['session-exercise']}
                                            onPointerUp={e => { e.stopPropagation(); onExerciseClick(log.exercise_id, log.exercise_name); }}>
                                            {log.exercise_name}
                                        </div>
                                        <div className={styles['session-sets-summary']}>{summarizeSets(log.sets)}</div>
                                        {log.notes && <div className={styles['session-notes-inline']}>{log.notes}</div>}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className={styles['session-expanded-content']}>
                                        <div className={styles['session-sets']}>
                                            {log.sets?.map(s => (
                                                <div key={s.set_number} className={styles['set-item']}>
                                                    Set {s.set_number}
                                                    {s.reps && ` · ${s.reps} reps`}
                                                    {s.seconds && ` · ${s.seconds}s`}
                                                    {s.distance_feet && ` · ${s.distance_feet} ft`}
                                                    {s.side && ` · ${s.side}`}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
