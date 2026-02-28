// components/PatientNotes.js — collapsible patient notes panel with keyword highlighting and dismiss
import styles from './PatientNotes.module.css';

/**
 * Collapsible patient notes alert showing session notes with keyword highlighting.
 * All data transformation (filtering, keyword detection, HTML building) is done by the parent
 * and passed in as pre-processed notes — component is purely presentational.
 *
 * @param {Array}    notes     - Pre-processed note objects: { id, performed_at, exercise_name,
 *                               isConcerning, displayText } — already filtered and sliced
 * @param {boolean}  collapsed - Whether the notes panel is collapsed
 * @param {Function} onToggle  - Toggle collapsed state
 * @param {Function} onDismiss - Dismiss a note by log id
 */
export default function PatientNotes({ notes, collapsed, onToggle, onDismiss }) {
    if (notes.length === 0) return null;

    return (
        <div className={`${styles['notes-alert-section']} ${collapsed ? styles.collapsed : ''}`}>
            <div className={styles['notes-header']} onPointerUp={onToggle}>
                <div className={styles['notes-header-left']}>
                    <span className={styles['notes-collapse-icon']}>▼</span>
                    <span>Patient Notes</span>
                    <span className={styles['notes-header-count']}>{notes.length}</span>
                </div>
                <span className={styles['notes-header-hint']}>tap to {collapsed ? 'expand' : 'collapse'}</span>
            </div>
            <div className={styles['notes-list']}>
                {notes.map(log => (
                    <div key={log.id} className={`${styles['note-card']} ${log.isConcerning ? styles.concerning : ''}`}>
                        <div className={styles['note-meta']}>
                            <span className={styles['note-date']}>
                                {new Date(log.performed_at).toLocaleDateString()}
                            </span>
                            <span className={styles['note-exercise']}>{log.exercise_name}</span>
                        </div>
                        {/* eslint-disable-next-line react/no-danger */}
                        <div className={styles['note-text']} dangerouslySetInnerHTML={{ __html: log.displayText }} />
                        <button className={styles['note-dismiss-btn']} onPointerUp={() => onDismiss(log.id)} aria-label="Dismiss note">×</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
