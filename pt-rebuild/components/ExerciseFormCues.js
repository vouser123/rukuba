// ExerciseFormCues.js — exercise form section 5: guidance & cues
// Section 6 (Lifecycle & Status) is handled by ExerciseFormLifecycle.js

import { useState } from 'react';
import styles from './ExerciseForm.module.css';

/**
 * Local helper: ordered text-entry list with add + remove.
 * Used for motor cues, warnings, safety flags, external cues.
 * Not exported — used only within this file.
 */
function GuidanceSection({ label, items, onAdd, onRemove }) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const val = input.trim();
    if (val) {
      onAdd(val);
      setInput('');
    }
  }

  return (
    <div className={styles.guidanceSection}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.tagInput}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter text…"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <button type="button" onPointerUp={handleAdd} className={styles.btnSecondary}>
          Add
        </button>
      </div>
      <ol className={styles.guidanceList}>
        {items.map((item, i) => (
          <li key={i} className={styles.guidanceItem}>
            <span>{item}</span>
            <button
              type="button"
              className={styles.tagRemove}
              onPointerUp={() => onRemove(i)}
              aria-label="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Renders exercise form section 5.
 * Section 6 (Lifecycle & Status) is rendered by ExerciseFormLifecycle.
 *
 * @param {Object} guidance             - { motor_cues, compensation_warnings, safety_flags, external_cues }
 * @param {Function} onGuidanceChange   - (updatedGuidance) => void
 */
export default function ExerciseFormCues({
  guidance, onGuidanceChange,
}) {
  function guidanceSetter(section) {
    const items = guidance[section] ?? [];
    return {
      items,
      onAdd: item => onGuidanceChange({ ...guidance, [section]: [...items, item] }),
      onRemove: i => onGuidanceChange({ ...guidance, [section]: items.filter((_, idx) => idx !== i) }),
    };
  }

  return (
    <>
      {/* Section 5: Guidance & Cues */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Guidance &amp; Cues</summary>
        <div className={styles.sectionContent}>
          <GuidanceSection label="Motor Cues" {...guidanceSetter('motor_cues')} />
          <GuidanceSection label="Compensation Warnings" {...guidanceSetter('compensation_warnings')} />
          <GuidanceSection label="Safety Flags" {...guidanceSetter('safety_flags')} />
          <GuidanceSection label="External Cues" {...guidanceSetter('external_cues')} />
        </div>
      </details>

    </>
  );
}
