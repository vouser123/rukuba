// ExerciseFormCore.js — exercise form sections 1–4: basic info, equipment, muscles, form parameters

import { useMemo, useState } from 'react';
import styles from './ExerciseForm.module.css';
import NativeSelect from './NativeSelect';
import { mapVocabTermsToOptions } from '../lib/vocab-options';
import { toLower, toSentenceCase } from '../lib/text-format';
const MODIFIERS = ['duration_seconds', 'hold_seconds', 'distance_feet'];

/**
 * Local helper: native select + explicit Other input + remove chip list.
 * Not exported — used only within this file.
 */
function SelectTagSection({
  label,
  items,
  options,
  onAdd,
  onRemove,
  normalizeInput = null,
  placeholder,
  emptyValueLabel,
}) {
  const [input, setInput] = useState('');
  const normalizedOptions = useMemo(
    () => (options ?? []).map((option) => (
      typeof option === 'string' ? { value: option, label: option } : option
    )),
    [options]
  );

  function handleAdd() {
    const raw = input.trim();
    const val = normalizeInput ? normalizeInput(raw) : raw;
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput('');
    }
  }

  return (
    <div className={styles.tagSection}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.tagInput}>
        <NativeSelect
          className={styles.select}
          value={input}
          onChange={setInput}
          options={normalizedOptions}
          allowOther
          formatValue={normalizeInput}
          placeholder={placeholder}
        />
        <button type="button" onPointerUp={handleAdd} className={styles.btnSecondary}>
          Add
        </button>
      </div>
      {emptyValueLabel && <span className={styles.hint}>{emptyValueLabel}</span>}
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
 * @param {Object} vocabularies   - keyed by category; values are { code, definition }[]
 * @param {boolean} isNew         - controls whether ID field is editable
 */
export default function ExerciseFormCore({
  basics, onBasicsChange,
  patternModifiers, onPatternModifiersChange,
  equipment, onEquipmentChange,
  muscles, onMusclesChange,
  formParameters, onFormParametersChange,
  referenceData,
  vocabularies,
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
              <NativeSelect
                className={styles.select}
                {...field('pt_category')}
                placeholder="Select..."
                options={mapVocabTermsToOptions(vocabularies?.pt_category ?? [])}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Pattern *</label>
              <NativeSelect
                className={styles.select}
                {...field('pattern')}
                placeholder="Select..."
                options={mapVocabTermsToOptions(vocabularies?.pattern ?? [])}
              />
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
          <SelectTagSection
            label="Required Equipment"
            items={equipment.required}
            options={referenceData.equipment}
            normalizeInput={toSentenceCase}
            placeholder="Select equipment..."
            emptyValueLabel="Choose an existing item or use Other to add a new one."
            onAdd={item => onEquipmentChange('required', [...equipment.required, item])}
            onRemove={i => onEquipmentChange('required', equipment.required.filter((_, idx) => idx !== i))}
          />
          <SelectTagSection
            label="Optional Equipment"
            items={equipment.optional}
            options={referenceData.equipment}
            normalizeInput={toSentenceCase}
            placeholder="Select equipment..."
            emptyValueLabel="Choose an existing item or use Other to add a new one."
            onAdd={item => onEquipmentChange('optional', [...equipment.optional, item])}
            onRemove={i => onEquipmentChange('optional', equipment.optional.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>

      {/* Section 3: Muscles */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Muscles</summary>
        <div className={styles.sectionContent}>
          <SelectTagSection
            label="Primary Muscles"
            items={muscles.primary}
            options={referenceData.muscles}
            normalizeInput={toSentenceCase}
            placeholder="Select muscle..."
            emptyValueLabel="Choose an existing item or use Other to add a new one."
            onAdd={item => onMusclesChange('primary', [...muscles.primary, item])}
            onRemove={i => onMusclesChange('primary', muscles.primary.filter((_, idx) => idx !== i))}
          />
          <SelectTagSection
            label="Secondary Muscles"
            items={muscles.secondary}
            options={referenceData.muscles}
            normalizeInput={toSentenceCase}
            placeholder="Select muscle..."
            emptyValueLabel="Choose an existing item or use Other to add a new one."
            onAdd={item => onMusclesChange('secondary', [...muscles.secondary, item])}
            onRemove={i => onMusclesChange('secondary', muscles.secondary.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>

      {/* Section 4: Form Parameters */}
      <details className={styles.section}>
        <summary className={styles.sectionHeader}>Form Parameters</summary>
        <div className={styles.sectionContent}>
          <SelectTagSection
            label="Required Form Parameters"
            items={formParameters}
            options={referenceData.formParameters}
            normalizeInput={toLower}
            placeholder="Select parameter..."
            emptyValueLabel="Choose an existing item or use Other to add a new one."
            onAdd={item => onFormParametersChange([...formParameters, item])}
            onRemove={i => onFormParametersChange(formParameters.filter((_, idx) => idx !== i))}
          />
        </div>
      </details>
    </>
  );
}
