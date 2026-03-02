// ExerciseFormLifecycle.js — exercise form section 6: lifecycle, status, and supersedes relationship

import styles from './ExerciseForm.module.css';

const LIFECYCLE_STATUSES = ['active', 'archived', 'deprecated'];

/**
 * Exercise form section 6: Lifecycle & Status.
 * Manages status, effective dates, supersedes relationship, and read-only audit fields.
 * Extracted from ExerciseFormCues so lifecycle concerns have a focused home and
 * can receive the exercises list (needed for the supersedes dropdown) without polluting cues.
 *
 * @param {Object} lifecycle            - { status, effective_start_date, effective_end_date,
 *                                         added_date, updated_date, superseded_by, superseded_date }
 * @param {Function} onLifecycleChange  - (updatedLifecycle) => void
 * @param {string|null} supersedes      - ID of the exercise this one supersedes (editable)
 * @param {Function} onSupersedingChange - (exerciseId|null) => void
 * @param {Array} exercises             - full exercise list for the supersedes dropdown
 * @param {string|null} currentExerciseId - ID of the exercise being edited (excluded from dropdown)
 */
export default function ExerciseFormLifecycle({
  lifecycle, onLifecycleChange,
  supersedes, onSupersedingChange,
  exercises, currentExerciseId,
}) {
  // Find the exercise that superseded this one (for read-only display)
  const supersededByExercise = lifecycle.superseded_by
    ? exercises.find(ex => ex.id === lifecycle.superseded_by)
    : null;

  // Exercises eligible for the supersedes dropdown: all except current exercise
  const supersedableExercises = (exercises ?? []).filter(ex => ex.id !== currentExerciseId);

  return (
    <details className={styles.section}>
      <summary className={styles.sectionHeader}>Lifecycle &amp; Status</summary>
      <div className={styles.sectionContent}>

        {/* Status */}
        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Status</label>
          <select
            className={styles.select}
            value={lifecycle.status ?? ''}
            onChange={e => onLifecycleChange({ ...lifecycle, status: e.target.value || null })}
          >
            <option value="">None</option>
            {LIFECYCLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className={styles.hint}>
            <strong>active</strong> — in use.&nbsp;
            <strong>archived</strong> — temporarily set aside; appears when "Show archived" is on.&nbsp;
            <strong>deprecated</strong> — permanently removed from use; never appears in the exercise list.
          </span>
        </div>

        {/* Effective dates */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Effective Start</label>
            <input
              type="date"
              className={styles.input}
              value={lifecycle.effective_start_date ?? ''}
              onChange={e => onLifecycleChange({ ...lifecycle, effective_start_date: e.target.value || null })}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Effective End</label>
            <input
              type="date"
              className={styles.input}
              value={lifecycle.effective_end_date ?? ''}
              onChange={e => onLifecycleChange({ ...lifecycle, effective_end_date: e.target.value || null })}
            />
          </div>
        </div>

        {/* Supersedes: this exercise replaces another */}
        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Supersedes</label>
          <select
            className={styles.select}
            value={supersedes ?? ''}
            onChange={e => onSupersedingChange(e.target.value || null)}
          >
            <option value="">None</option>
            {supersedableExercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.canonical_name}</option>
            ))}
          </select>
          <span className={styles.hint}>This exercise replaces the selected exercise. Saving updates the superseded exercise automatically.</span>
        </div>

        {/* Superseded by: read-only — set automatically when another exercise supersedes this one */}
        <div className={styles.formGroup}>
          <label className={styles.fieldLabel}>Superseded by</label>
          {lifecycle.superseded_by ? (
            <>
              <p className={styles.readonlyDate}>
                {supersededByExercise ? supersededByExercise.canonical_name : lifecycle.superseded_by}
                {lifecycle.superseded_date ? ` (${lifecycle.superseded_date.split('T')[0]})` : ''}
              </p>
              <span className={styles.hint}>Set automatically when another exercise supersedes this one.</span>
            </>
          ) : (
            <p className={styles.readonlyDate}>—</p>
          )}
        </div>

        {/* Read-only audit dates — always shown; format strips time component from ISO timestamps */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Added Date</label>
            <p className={styles.readonlyDate}>
              {lifecycle.added_date ? lifecycle.added_date.split('T')[0] : '—'}
            </p>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Last Updated</label>
            <p className={styles.readonlyDate}>
              {lifecycle.updated_date ? lifecycle.updated_date.split('T')[0] : '—'}
            </p>
          </div>
        </div>

      </div>
    </details>
  );
}
