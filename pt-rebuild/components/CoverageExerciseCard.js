// components/CoverageExerciseCard.js — exercise status card within rehab capacity groups
import styles from './CoverageExerciseCard.module.css';

export default function CoverageExerciseCard({ exercise }) {
  const isDone = !!exercise.lastDone;
  const daysSince = exercise.daysSince || 0;
  const isOverdue = !isDone || daysSince >= 7;
  const statusIcon = isOverdue ? '⚠' : '✓';
  const statusColor = isOverdue ? 'var(--warning-color)' : 'var(--success-color)';
  const statusText = isDone ? `${daysSince}d ago` : 'never';
  const contribution = exercise.contribution || 'low';
  const contribColor = contribution === 'high'
    ? 'var(--danger-color)'
    : contribution === 'medium'
      ? 'var(--warning-color)'
      : 'var(--accent-color)';

  return (
    <div className={`${styles['exercise-card']} ${styles[`contrib-${contribution}`]}`}>
      <span className={styles['exercise-card-icon']} style={{ color: statusColor }}>
        {statusIcon}
      </span>
      <div className={styles['exercise-card-content']}>
        <div className={styles['exercise-card-title']}>{exercise.name}</div>
        <div className={styles['exercise-card-meta']}>
          <span style={{ color: contribColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {contribution}
          </span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
          <span style={{ color: statusColor }}>{statusText}</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
          <span style={{ opacity: 0.7 }}>7d: {exercise.days7} · 21d: {exercise.days21}</span>
        </div>
      </div>
    </div>
  );
}
