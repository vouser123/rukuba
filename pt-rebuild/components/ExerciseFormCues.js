// ExerciseFormCues.js — exercise form sections 5–8: guidance & cues, lifecycle, roles display, vocab reference

import { useState } from 'react';
import styles from './ExerciseForm.module.css';

const LIFECYCLE_STATUSES = ['active', 'deprecated', 'archived'];

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
 * Renders exercise form sections 5–8.
 * Roles section is read-only in Phase 3a — role editing is Phase 3b.
 *
 * @param {Object} guidance     - { motor_cues: [], compensation_warnings: [], safety_flags: [], external_cues: [] }
 * @param {Function} onGuidanceChange - (updatedGuidance) => void
 * @param {Object} lifecycle    - { status, effective_start_date, effective_end_date, added_date, updated_date }
 * @param {Function} onLifecycleChange - (updatedLifecycle) => void
 * @param {Array} roles         - read-only; from exercise.roles on GET (not saved via exercises API)
 * @param {Object} vocabularies - keyed by category; each value is array of { code, definition }
 */
export default function ExerciseFormCues({
  guidance, onGuidanceChange,
  lifecycle, onLifecycleChange,
  roles,
  vocabularies,
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

      {/* Section 6: Lifecycle & Status */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Lifecycle &amp; Status</summary>
        <div className={styles.sectionContent}>
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
          {lifecycle.added_date && (
            <p className={styles.readonlyDate}>
              Added: {lifecycle.added_date}{lifecycle.updated_date ? ` · Updated: ${lifecycle.updated_date}` : ''}
            </p>
          )}
        </div>
      </details>

      {/* Section 7: Roles (read-only — editing is Phase 3b) */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Roles (read-only — editing coming in Phase 3b)</summary>
        <div className={styles.sectionContent}>
          {roles && roles.length > 0 ? (
            <table className={styles.rolesTable}>
              <thead>
                <tr><th>Region</th><th>Capacity</th><th>Focus</th><th>Contribution</th></tr>
              </thead>
              <tbody>
                {roles.map((r, i) => (
                  <tr key={i}>
                    <td>{r.region}</td>
                    <td>{r.capacity}</td>
                    <td>{r.focus}</td>
                    <td>{r.contribution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyNote}>No roles assigned.</p>
          )}
        </div>
      </details>

      {/* Section 8: Vocabulary Reference (read-only) */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Vocabulary Reference</summary>
        <div className={styles.sectionContent}>
          {vocabularies && Object.entries(vocabularies).map(([cat, terms]) => (
            <div key={cat} className={styles.vocabCategory}>
              <h4 className={styles.vocabCategoryTitle}>{cat}</h4>
              <ul className={styles.vocabList}>
                {(terms ?? []).map(t => (
                  <li key={t.code}>{t.code}{t.definition ? ` — ${t.definition}` : ''}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
