// components/CoverageCapacity.js — expandable capacity row and focus groups for rehab coverage
import CoverageExerciseCard from './CoverageExerciseCard';
import styles from './CoverageCapacity.module.css';

export default function CoverageCapacity({
  region,
  capacity,
  capData,
  isExpanded,
  onToggleCapacity,
  colorScoreToRGB,
  coverageConstants,
}) {
  const exercises = capData.exercises || [];
  const percent = Math.round(capData.percent || 0);
  const colorScore = capData.color_score || 0;
  const opacity = Math.max(20, capData.opacity || 20);
  const color = capData.color || colorScoreToRGB(colorScore);
  const capKey = `${region}-${capacity}`;

  const C = coverageConstants;
  let recencyText = '!! very overdue';
  if (colorScore >= C.RECENCY_RECENT_MIN) recencyText = '✓ done recently';
  else if (colorScore >= C.RECENCY_FEW_DAYS_MIN) recencyText = '~ a few days ago';
  else if (colorScore >= C.RECENCY_STALE_MIN) recencyText = '⚠ getting stale';
  else if (colorScore >= C.RECENCY_OVERDUE_MIN) recencyText = '! overdue';

  let trendText = `↓↓ low (${opacity}%)`;
  if (opacity >= C.TREND_STEADY_MIN) trendText = `↑ steady (${opacity}%)`;
  else if (opacity >= C.TREND_OK_MIN) trendText = `→ ok (${opacity}%)`;
  else if (opacity >= C.TREND_SLIPPING_MIN) trendText = `↓ slipping (${opacity}%)`;

  const focusGroups = new Map();
  focusGroups.set('general', []);
  for (const exercise of exercises) {
    const focus = exercise.focus || 'general';
    if (!focusGroups.has(focus)) focusGroups.set(focus, []);
    focusGroups.get(focus).push(exercise);
  }

  return (
    <div className={`${styles['capacity-group']} ${isExpanded ? styles.expanded : ''}`}>
      <div
        className={styles['capacity-header']}
        onPointerUp={() => onToggleCapacity(capKey)}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleCapacity(capKey);
          }
        }}
      >
        <span className={styles['capacity-title']}>{capacity}</span>
        <div className={styles['capacity-bar-container']}>
          <div className={styles['coverage-bar']}>
            <div
              className={styles['coverage-bar-fill']}
              style={{
                width: `${percent}%`,
                background: color,
                opacity: opacity / 100,
              }}
            />
          </div>
          <span className={styles['capacity-stats']}>{percent}%</span>
        </div>
        <span className={styles['capacity-chevron']}>›</span>
      </div>
      <div className={styles['capacity-meta']}>
        This week: {percent}% • Last done: {recencyText} • 3-week: {trendText}
      </div>
      <div className={styles['focus-list']}>
        {Array.from(focusGroups.entries()).map(([focus, focusExercises]) => {
          if (focusExercises.length === 0) return null;
          const doneCount = focusExercises.filter((exercise) => exercise.lastDone).length;
          const totalCount = focusExercises.length;
          let statusClass = '';
          if (doneCount === 0) statusClass = 'not-covered';
          else if (doneCount < totalCount) statusClass = 'needs-attention';

          return (
            <div key={focus} className={[styles['focus-item'], statusClass ? styles[statusClass] : ''].filter(Boolean).join(' ')}>
              <div className={styles['focus-header']}>
                <span className={styles['focus-name']}>
                  {focus === 'general' ? 'General' : focus.replace(/_/g, ' ')}
                </span>
                <span className={styles['focus-stats']}>
                  {doneCount}/{totalCount}
                </span>
              </div>
              <div className={styles['exercise-list']}>
                {focusExercises.map((exercise) => (
                  <CoverageExerciseCard key={exercise.id} exercise={exercise} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
