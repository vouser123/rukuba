// DosageModal.js — shared modal for viewing/editing a patient's dosage for an exercise

import { useState, useEffect } from 'react';
import styles from './DosageModal.module.css';

/**
 * Shared dosage editor modal. Fields shown adapt to the exercise's pattern_modifiers.
 * Parent is responsible for calling the API — this component calls onSave(formData).
 * Reusable from /program and from the future migrated tracker page.
 *
 * @param {Object} exercise       - full exercise object; reads pattern_modifiers and canonical_name
 * @param {Object|null} program   - existing program record (pre-fills form), or null for new
 * @param {Function} onSave       - (formData) => Promise<void> — parent calls API, then closes
 * @param {Function} onClose      - () => void — close without saving
 */
export default function DosageModal({ exercise, program, onSave, onClose }) {
  const modifiers = exercise?.pattern_modifiers ?? [];
  const hasDuration = modifiers.includes('duration_seconds');
  const hasDistance = modifiers.includes('distance_feet');
  const hasHold = modifiers.includes('hold_seconds');

  // Reps are replaced by duration or distance
  const showReps = !hasDuration && !hasDistance;
  // Seconds shown for hold or duration
  const showSeconds = hasHold || hasDuration;
  const secondsLabel = hasDuration ? 'Duration (seconds)' : 'Hold seconds (per rep)';

  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [seconds, setSeconds] = useState('');
  const [distance, setDistance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill from existing program when modal opens
  useEffect(() => {
    if (program) {
      setSets(program.sets != null ? String(program.sets) : '');
      setReps(program.reps_per_set != null ? String(program.reps_per_set) : '');
      setSeconds(program.seconds_per_rep != null ? String(program.seconds_per_rep) : '');
      setDistance(program.distance_feet != null ? String(program.distance_feet) : '');
    } else {
      setSets('');
      setReps('');
      setSeconds('');
      setDistance('');
    }
    setError(null);
  }, [program]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const parsedSets = parseInt(sets, 10);
    if (!parsedSets || parsedSets < 1) {
      setError('Sets is required and must be a positive number.');
      return;
    }
    if (showReps) {
      const parsedReps = parseInt(reps, 10);
      if (!parsedReps || parsedReps < 1) {
        setError('Reps is required for this exercise type.');
        return;
      }
    }
    if (showSeconds) {
      const parsedSec = parseInt(seconds, 10);
      if (!parsedSec || parsedSec < 1) {
        setError(`${secondsLabel} is required for this exercise type.`);
        return;
      }
    }
    if (hasDistance) {
      const parsedDist = parseInt(distance, 10);
      if (!parsedDist || parsedDist < 1) {
        setError('Distance is required for this exercise type.');
        return;
      }
    }

    const formData = {
      sets: parsedSets,
      reps_per_set: showReps ? parseInt(reps, 10) || null : null,
      seconds_per_rep: showSeconds ? parseInt(seconds, 10) || null : null,
      distance_feet: hasDistance ? parseInt(distance, 10) || null : null,
    };

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onPointerUp={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Edit Dosage">
        <div className={styles.header}>
          <h2 className={styles.title}>
            {program ? 'Edit Dosage' : 'Set Dosage'}
          </h2>
          <p className={styles.exerciseName}>{exercise?.canonical_name}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          {/* Sets — always shown */}
          <div className={styles.field}>
            <label className={styles.label}>Sets</label>
            <input
              type="number"
              className={styles.input}
              value={sets}
              min="1"
              onChange={e => setSets(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>

          {/* Reps — hidden for duration / distance exercises */}
          {showReps && (
            <div className={styles.field}>
              <label className={styles.label}>Reps (per set)</label>
              <input
                type="number"
                className={styles.input}
                value={reps}
                min="1"
                onChange={e => setReps(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          )}

          {/* Seconds — shown for hold or duration exercises */}
          {showSeconds && (
            <div className={styles.field}>
              <label className={styles.label}>{secondsLabel}</label>
              <input
                type="number"
                className={styles.input}
                value={seconds}
                min="1"
                onChange={e => setSeconds(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          )}

          {/* Distance — shown for distance exercises */}
          {hasDistance && (
            <div className={styles.field}>
              <label className={styles.label}>Distance (feet)</label>
              <input
                type="number"
                className={styles.input}
                value={distance}
                min="1"
                onChange={e => setDistance(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onPointerUp={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Dosage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
