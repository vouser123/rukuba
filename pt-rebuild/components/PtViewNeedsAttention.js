// components/PtViewNeedsAttention.js — page-only needs-attention panel for the rehab history route
import styles from './PtViewNeedsAttention.module.css';

export default function PtViewNeedsAttention({ items, onCardClick }) {
    if (items.length === 0) return null;

    return (
        <div className={styles.section}>
            <div className={styles['section-title']}>Needs Attention</div>
            <div className={styles['top-exercises-grid']}>
                {items.map((item) => (
                    <div
                        key={item.exerciseId}
                        className={styles['exercise-card']}
                        onPointerUp={() => onCardClick(item.exerciseId, item.exerciseName)}
                        style={{ borderLeft: `4px solid ${item.urgencyColor}` }}
                    >
                        <div className={styles['exercise-card-title']}>{item.exerciseName}</div>
                        <div className={styles['exercise-card-meta']}>
                            {item.neverDone ? 'Never performed' : `${item.daysSince} days ago`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
