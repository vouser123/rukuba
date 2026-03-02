// components/BottomNav.js — fixed bottom tab bar for index page (Exercises / History).

import styles from './BottomNav.module.css';

/**
 * Bottom navigation bar with two tabs.
 *
 * @param {string}   activeTab    - 'exercises' or 'history'
 * @param {Function} onTabChange  - (tab: string) => void
 * @param {number}   pendingSync  - Number of items pending offline sync (shown as badge on Exercises tab)
 */
export default function BottomNav({ activeTab, onTabChange, pendingSync = 0 }) {
    return (
        <nav className={styles.nav} aria-label="Main navigation">
            <button
                type="button"
                className={`${styles.tab} ${activeTab === 'exercises' ? styles.active : ''}`}
                onPointerUp={() => onTabChange('exercises')}
                aria-current={activeTab === 'exercises' ? 'page' : undefined}
            >
                Exercises
                {pendingSync > 0 && (
                    <span className={styles.syncBadge}>{pendingSync} unsynced</span>
                )}
            </button>
            <button
                type="button"
                className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
                onPointerUp={() => onTabChange('history')}
                aria-current={activeTab === 'history' ? 'page' : undefined}
            >
                History
            </button>
        </nav>
    );
}
