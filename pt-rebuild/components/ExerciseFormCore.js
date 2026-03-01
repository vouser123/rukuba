// ExerciseFormCore.js — exercise form sections 1–4: basic info, equipment, muscles, form parameters

import { useState } from 'react';
import styles from './ExerciseForm.module.css';

const PT_CATEGORIES = ['back_sij', 'knee', 'ankle', 'hip', 'vestibular', 'foot', 'shoulder', 'other'];
const PATTERNS = ['side', 'both'];
const MODIFIERS = ['duration_seconds', 'hold_seconds', 'distance_feet'];

/**
 * Local helper: tag entry (datalist select or free text) + remove chip list.
 * Not exported — used only within this file.
 */
function TagSection({ label, items, options, onAdd, onRemove }) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput('');
    }
  }

  return (
    <div className={styles.tagSection}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.tagInput}>
        <input
          list={`taglist-${label}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder="Select or type…"
          className={styles.input}
        />
        {options && (
          <datalist id={`taglist-${label}`}>
            {options.filter(o => !items.includes(o)).map(o => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
        <button type="button" onPointerUp={handleAdd} className={styles.btnSecondary}>
          Add
        </button>
      </div>
      <div className={styles.tagList}>
        {items.map((item, i) => (
          <span key={i} className={styles.tag}>
            {item}
            <button
              type="button"
              className={styles.tagRemove}
              onPointerUp={() => onRemove(i)}
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders exercise form sections 1–4.
 * All state is owned by the parent ExerciseForm; this component is purely presentational.
 *
 * @param {Object} basics         - { id, canonical_name, description, pt_category, pattern, archived }
 * @param {Function} onBasicsChange - (updatedBasics) => void
 * @param {Array} patternModifiers
 * @param {Function} onPatternModifiersChange - (updatedArray) => void
 * @param {Object} equipment      - { required: [], optional: [] }
 * @param {Function} onEquipmentChange - (type: 'required'|'optional', items: []) => void
 * @param {Object} muscles        - { primary: [], secondary: [] }
 * @param {Function} onMusclesChange   - (type: 'primary'|'secondary', items: []) => void
 * @param {Array} formParameters
 * @param {Function} onFormParametersChange - (updatedArray) => void
 * @param {Object} referenceData  - { equipment: [], muscles: [], formParameters: [] }
 * @param {boolean} isNew         - controls whether ID field is editable
 */
export default function ExerciseFormCore({
  basics, onBasicsChange,
  patternModifiers, onPatternModifiersChange,
  equipment, onEquipmentChange,
  muscles, onMusclesChange,
  formParameters, onFormParametersChange,
  referenceData,
  isNew,
}) {
  function field(name) {
    return {
      value: basics[name] ?? '',
      onChange: e => onBasicsChange({ ...basics, [name]: e.target.value }),
    };
  }

  function toggleModifier(mod) {
    const updated = patternModifiers.includes(mod)
      ? patternModifiers.filter(m => m !== mod)
      : [...patternModifiers, mod];
    onPatternModifiersChange(updated);
  }

  return (
    <>
      {/* Section 1: Basic Information */}
      <details open className={styles.section}>
        <summary className={styles.sectionHeader}>Basic Information</summary>
        <div className={styles.sectionContent}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Exercise ID</label>
            <input
              className={styles.input}
              {...field('id')}
              readOnly
            />
            <span className={styles.hint}>Auto-assigned UUID. Read-only.</span>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Canonical Name *</label>
            <input className={styles.input} {...field('canonical_name')} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Description *</label>
            <textarea className={styles.textarea} rows={3} {...field('description')} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Category *</label>
              <select className={styles.select} {...field('pt_category')}>
                <option value="">Select…</option>
                {PT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Pattern *</label>
              <select className={styles.select} {...field('pattern')}>
                <option value="">Select…</option>
                {PATTERNS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Pattern Modifiers</label>
            <div className={styles.checkboxGroup}>
              {MODIFIERS.map(mod => (
                <label key={mod} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={patternModifiers.includes(mod)}
                    onChange={() => toggleModifier(mod)}
                  />
                  {mod}
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Section 2: Equipment */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Equipment</summary>
        <div className={styles.sectionContent}>
          <TagSection
            label="Required Equipment"
            items={equipment.required}
            options={referenceData.equipment}
            onAdd={item => onEquipmentChange('required', [...equipment.required, item])}
            onRemove={i => onEquipmentChange('required', equipment.required.filter((_, idx) => idx !== i))}
          />
          <TagSection
            label="Optional Equipment"
            items={equipment.optional}
            options={referenceData.equipment}
            onAdd={item => onEquipmentChange('optional', [...equipment.optional, item])}
            onRemove={i => onEquipmentChange('optional', equipment.optional.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>

      {/* Section 3: Muscles */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Muscles</summary>
        <div className={styles.sectionContent}>
          <TagSection
            label="Primary Muscles"
            items={muscles.primary}
            options={referenceData.muscles}
            onAdd={item => onMusclesChange('primary', [...muscles.primary, item])}
            onRemove={i => onMusclesChange('primary', muscles.primary.filter((_, idx) => idx !== i))}
          />
          <TagSection
            label="Secondary Muscles"
            items={muscles.secondary}
            options={referenceData.muscles}
            onAdd={item => onMusclesChange('secondary', [...muscles.secondary, item])}
            onRemove={i => onMusclesChange('secondary', muscles.secondary.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>

      {/* Section 4: Form Parameters */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Form Parameters</summary>
        <div className={styles.sectionContent}>
          <TagSection
            label="Required Form Parameters"
            items={formParameters}
            options={referenceData.formParameters}
            onAdd={item => onFormParametersChange([...formParameters, item])}
            onRemove={i => onFormParametersChange(formParameters.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>
    </>
  );
}
