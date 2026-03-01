// components/CoverageSummary.js — summary metrics card for the rehab coverage page
import styles from './CoverageSummary.module.css';

export default function CoverageSummary({ summary }) {
  if (!summary) return null;

  const { lastDoneAgo, coverage7, exercisesDone7, totalExercises, avgOpacity } = summary;

  let lastActivityText = 'No activity';
  let lastActivityColor = 'var(--danger-color)';
  if (lastDoneAgo !== null) {
    lastActivityText = lastDoneAgo === 0 ? 'Today' : `${lastDoneAgo} days ago`;
    lastActivityColor = lastDoneAgo <= 1
      ? 'var(--success-color)'
      : lastDoneAgo <= 3
        ? 'var(--warning-color)'
        : 'var(--danger-color)';
  }

  const weekText = `${coverage7}% (${exercisesDone7}/${totalExercises})`;
  const weekColor = coverage7 >= 70
    ? 'var(--success-color)'
    : coverage7 >= 40
      ? 'var(--warning-color)'
      : 'var(--danger-color)';

  let trendText = `📉 Low (${avgOpacity}%) - needs more sessions`;
  let trendColor = 'var(--danger-color)';
  if (avgOpacity >= 70) {
    trendText = `📈 Strong (${avgOpacity}%) - exercising consistently`;
    trendColor = 'var(--success-color)';
  } else if (avgOpacity >= 50) {
    trendText = `↗️ Building (${avgOpacity}%) - good momentum`;
    trendColor = 'var(--success-color)';
  } else if (avgOpacity >= 30) {
    trendText = `↘️ Fading (${avgOpacity}%) - activity dropping`;
    trendColor = 'var(--warning-color)';
  }

  return (
    <div className={styles['summary-card']}>
      <h3>Coverage Overview</h3>
      <div className={styles['summary-row']}>
        <span className={styles['summary-label']}>Last Activity:</span>
        <span className={styles['summary-value']} style={{ color: lastActivityColor }}>
          {lastActivityText}
        </span>
      </div>
      <div className={styles['summary-row']}>
        <span className={styles['summary-label']}>7-Day Coverage:</span>
        <span className={styles['summary-value']} style={{ color: weekColor }}>
          {weekText}
        </span>
      </div>
      <div className={styles['summary-row']}>
        <span className={styles['summary-label']}>21-Day Trend:</span>
        <span className={styles['summary-value']} style={{ color: trendColor }}>
          {trendText}
        </span>
      </div>
    </div>
  );
}
