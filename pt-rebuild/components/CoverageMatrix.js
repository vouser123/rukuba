// components/CoverageMatrix.js — region-level matrix renderer for rehab coverage data
import CoverageCapacity from './CoverageCapacity';
import styles from './CoverageMatrix.module.css';

export default function CoverageMatrix({
  coverageData,
  collapsedRegions,
  onToggleRegion,
  expandedCapacities,
  onToggleCapacity,
  colorScoreToRGB,
  coverageConstants,
}) {
  if (!coverageData || Object.keys(coverageData).length === 0) {
    return <div className={styles['empty-state']}>No coverage data available.</div>;
  }

  const regions = Object.keys(coverageData).sort((a, b) => {
    const aScore = (coverageData[a]._regionBar || {}).color_score || 0;
    const bScore = (coverageData[b]._regionBar || {}).color_score || 0;
    return aScore - bScore;
  });

  return regions.map((region) => {
    const regionBar = coverageData[region]._regionBar || { percent: 0, color_score: 50, opacity: 50 };
    const capacities = Object.keys(coverageData[region]).filter((key) => key !== '_regionBar');
    const isCollapsed = collapsedRegions.has(region);
    const regionColor = colorScoreToRGB(regionBar.color_score);
    const regionOpacity = Math.max(20, regionBar.opacity);

    return (
      <div key={region} className={styles['region-group']}>
        <div
          className={styles['region-header']}
          onPointerUp={() => onToggleRegion(region)}
          role="button"
          aria-expanded={!isCollapsed}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleRegion(region);
            }
          }}
        >
          <span className={styles['region-title']}>{region}</span>
          <div className={styles['region-bar-container']}>
            <div className={styles['coverage-bar']}>
              <div
                className={styles['coverage-bar-fill']}
                style={{
                  width: `${regionBar.percent}%`,
                  background: regionColor,
                  opacity: regionOpacity / 100,
                }}
              />
            </div>
            <span className={styles['region-stats']}>{regionBar.percent}%</span>
          </div>
          <span className={`${styles['expand-icon']} ${isCollapsed ? styles.collapsed : ''}`}>▼</span>
        </div>
        <div className={`${styles['region-content']} ${isCollapsed ? styles.collapsed : ''}`}>
          {capacities.map((capacity) => {
            const capKey = `${region}-${capacity}`;
            return (
              <CoverageCapacity
                key={capKey}
                region={region}
                capacity={capacity}
                capData={coverageData[region][capacity]}
                isExpanded={expandedCapacities.has(capKey)}
                onToggleCapacity={onToggleCapacity}
                colorScoreToRGB={colorScoreToRGB}
                coverageConstants={coverageConstants}
              />
            );
          })}
        </div>
      </div>
    );
  });
}
