// components/PtViewSummaryStats.js — page-only summary stats row for the rehab history route
import styles from './PtViewSummaryStats.module.css';

export default function PtViewSummaryStats({ stats }) {
    return (
        <div className={styles['summary-section']}>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.daysActive}</span>
                <span className={styles['summary-label']}>Days active</span>
            </div>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.exercisesCovered}</span>
                <span className={styles['summary-label']}>Exercises covered</span>
            </div>
            <div className={styles['summary-card']}>
                <span className={styles['summary-value']}>{stats.totalSessions}</span>
                <span className={styles['summary-label']}>Total sessions</span>
            </div>
        </div>
    );
}
