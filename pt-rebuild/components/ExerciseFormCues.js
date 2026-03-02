// ExerciseFormCues.js — exercise form sections 5, 7, 8: guidance & cues, roles editing, vocab reference
// Section 6 (Lifecycle & Status) is handled by ExerciseFormLifecycle.js

import { useState } from 'react';
import styles from './ExerciseForm.module.css';

const CONTRIBUTION_OPTIONS = ['high', 'medium', 'low'];

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
 * Renders exercise form sections 5, 7, 8.
 * Section 6 (Lifecycle & Status) is rendered by ExerciseFormLifecycle.
 *
 * @param {Object} guidance             - { motor_cues, compensation_warnings, safety_flags, external_cues }
 * @param {Function} onGuidanceChange   - (updatedGuidance) => void
 * @param {Array} roles                 - current role assignments for this exercise
 * @param {Function} onAddRole          - ({ region, capacity, focus, contribution }) => Promise<void>
 * @param {Function} onDeleteRole       - (roleId) => Promise<void>
 * @param {boolean} rolesLoading        - true while an add/delete API call is in flight
 * @param {boolean} rolesDisabled       - true for new unsaved exercises (no ID yet)
 * @param {Object} vocabularies         - keyed by category; values are { code, definition }[]
 */
export default function ExerciseFormCues({
  guidance, onGuidanceChange,
  roles, onAddRole, onDeleteRole, rolesLoading, rolesDisabled,
  vocabularies,
}) {
  const [newRegion, setNewRegion] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newContribution, setNewContribution] = useState('');
  const [addRoleError, setAddRoleError] = useState(null);

  function guidanceSetter(section) {
    const items = guidance[section] ?? [];
    return {
      items,
      onAdd: item => onGuidanceChange({ ...guidance, [section]: [...items, item] }),
      onRemove: i => onGuidanceChange({ ...guidance, [section]: items.filter((_, idx) => idx !== i) }),
    };
  }

  // Vocab terms for role dropdowns — fall back to empty if category not present
  const regionOptions = (vocabularies?.region ?? []).map(t => t.code);
  const capacityOptions = (vocabularies?.capacity ?? []).map(t => t.code);
  const focusOptions = (vocabularies?.focus ?? []).map(t => t.code);

  async function handleAddRole() {
    setAddRoleError(null);
    if (!newRegion || !newCapacity || !newContribution) {
      setAddRoleError('Region, Capacity, and Contribution are required.');
      return;
    }
    try {
      await onAddRole({
        region: newRegion,
        capacity: newCapacity,
        focus: newFocus || null,
        contribution: newContribution,
      });
      // Reset add form on success
      setNewRegion('');
      setNewCapacity('');
      setNewFocus('');
      setNewContribution('');
    } catch (err) {
      setAddRoleError(err.message);
    }
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

      {/* Section 7: Roles */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Roles</summary>
        <div className={styles.sectionContent}>
          {rolesDisabled && (
            <p className={styles.hint}>Save this exercise first before assigning roles.</p>
          )}

          {/* Existing roles table */}
          {roles && roles.length > 0 ? (
            <table className={styles.rolesTable}>
              <thead>
                <tr>
                  <th>Region</th><th>Capacity</th><th>Focus</th><th>Contribution</th><th></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.region}</td>
                    <td>{r.capacity}</td>
                    <td>{r.focus ?? '—'}</td>
                    <td>{r.contribution}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.roleRemoveBtn}
                        onPointerUp={() => onDeleteRole(r.id)}
                        disabled={rolesLoading || rolesDisabled}
                        aria-label="Remove role"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !rolesDisabled && <p className={styles.emptyNote}>No roles assigned.</p>
          )}

          {/* Add role form — hidden for unsaved exercises */}
          {!rolesDisabled && (
            <div className={styles.addRoleForm}>
              <p className={styles.fieldLabel}>Add Role</p>
              {addRoleError && <p className={styles.roleError}>{addRoleError}</p>}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Region *</label>
                  <select
                    className={styles.select}
                    value={newRegion}
                    onChange={e => setNewRegion(e.target.value)}
                    disabled={rolesLoading}
                  >
                    <option value="">Select…</option>
                    {regionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Capacity *</label>
                  <select
                    className={styles.select}
                    value={newCapacity}
                    onChange={e => setNewCapacity(e.target.value)}
                    disabled={rolesLoading}
                  >
                    <option value="">Select…</option>
                    {capacityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Focus</label>
                  <select
                    className={styles.select}
                    value={newFocus}
                    onChange={e => setNewFocus(e.target.value)}
                    disabled={rolesLoading}
                  >
                    <option value="">None</option>
                    {focusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>Contribution *</label>
                  <select
                    className={styles.select}
                    value={newContribution}
                    onChange={e => setNewContribution(e.target.value)}
                    disabled={rolesLoading}
                  >
                    <option value="">Select…</option>
                    {CONTRIBUTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                onPointerUp={handleAddRole}
                disabled={rolesLoading}
              >
                {rolesLoading ? 'Saving…' : '+ Add Role'}
              </button>
            </div>
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
