// components/HistoryPanel.js — history tab panel for the index (tracker) page.
// Renders all history by default; filters to a single exercise when one is active in the logger.
// Reuses the existing HistoryList component for grouped date rendering.

import { useState } from 'react';
import HistoryList from './HistoryList';
import { filterHistoryByExercise, groupLogsByDate } from '../lib/index-history';
import styles from './HistoryPanel.module.css';

/**
 * History panel for the tracker index page.
 *
 * @param {Array}       logs                - Full log array from useIndexData
 * @param {string|null} activeExerciseId    - Set when a session is open; null = show all history
 * @param {string|null} activeExerciseName  - Display name for the filter badge
 * @param {Function}    onClearFilter       - Called when user taps "Show all" in the filter badge
 */
export default function HistoryPanel({ logs, activeExerciseId, activeExerciseName, onClearFilter }) {
    const [expandedSessions, setExpandedSessions] = useState(new Set());

    /** Toggle expanded state for a session card. */
    function handleToggleSession(logId) {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            next.has(logId) ? next.delete(logId) : next.add(logId);
            return next;
        });
    }

    const filteredLogs = filterHistoryByExercise(logs, activeExerciseId);
    const groups = groupLogsByDate(filteredLogs);
    const isFiltered = Boolean(activeExerciseId);

    return (
        <div className={styles.panel}>
            {isFiltered && (
                <div className={styles.filterBadge}>
                    <span>Filtering: {activeExerciseName}</span>
                    <button
                        type="button"
                        className={styles.clearFilter}
                        onPointerUp={onClearFilter}
                        aria-label="Show all history"
                    >
                        Show all
                    </button>
                </div>
            )}

            <HistoryList
                groups={groups}
                expandedSessions={expandedSessions}
                onToggleSession={handleToggleSession}
                onExerciseClick={() => {}} // no-op on index: exercise context set by ExercisePicker
            />
        </div>
    );
}
