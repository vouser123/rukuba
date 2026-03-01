// ExerciseForm.js — exercise form orchestrator: state management, save/cancel, composes Core + Cues

import { useState, useEffect } from 'react';
import { createExercise, updateExercise } from '../lib/pt-editor';
import ExerciseFormCore from './ExerciseFormCore';
import ExerciseFormCues from './ExerciseFormCues';
import styles from './ExerciseForm.module.css';

const EMPTY_BASICS = {
  id: '', canonical_name: '', description: '', pt_category: '', pattern: '', archived: false,
};
const EMPTY_LIFECYCLE = {
  status: null, effective_start_date: null, effective_end_date: null, added_date: null, updated_date: null,
};

/**
 * Exercise form orchestrator. Holds all form state and delegates rendering to
 * ExerciseFormCore (sections 1–4) and ExerciseFormCues (sections 5–8).
 *
 * @param {Object|null} exercise      - null = new exercise; full exercise object = edit
 * @param {Object} referenceData      - { equipment: [], muscles: [], formParameters: [] }
 * @param {Object} vocabularies       - keyed by category
 * @param {string} accessToken
 * @param {Function} onSaved          - (isNew: boolean) => void — called after successful save
 * @param {Function} onCancel
 */
export default function ExerciseForm({ exercise, referenceData, vocabularies, accessToken, onSaved, onCancel }) {
  const isNew = !exercise;

  const [basics, setBasics] = useState(EMPTY_BASICS);
  const [patternModifiers, setPatternModifiers] = useState([]);
  const [equipment, setEquipment] = useState({ required: [], optional: [] });
  const [muscles, setMuscles] = useState({ primary: [], secondary: [] });
  const [formParameters, setFormParameters] = useState([]);
  const [guidance, setGuidance] = useState({});
  const [lifecycle, setLifecycle] = useState(EMPTY_LIFECYCLE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Populate form state when the exercise prop changes (edit mode) or resets (new mode)
  useEffect(() => {
    if (exercise) {
      setBasics({
        id: exercise.id,
        canonical_name: exercise.canonical_name,
        description: exercise.description ?? '',
        pt_category: exercise.pt_category ?? '',
        pattern: exercise.pattern ?? '',
        archived: exercise.archived ?? false,
      });
      setPatternModifiers(exercise.pattern_modifiers ?? []);
      setEquipment({
        required: exercise.equipment?.required ?? [],
        optional: exercise.equipment?.optional ?? [],
      });
      setMuscles({
        primary: exercise.primary_muscles ?? [],
        secondary: exercise.secondary_muscles ?? [],
      });
      setFormParameters(exercise.form_parameters_required ?? []);
      setGuidance(exercise.guidance ?? {});
      setLifecycle({
        status: exercise.lifecycle?.status ?? null,
        effective_start_date: exercise.lifecycle?.effective_start_date ?? null,
        effective_end_date: exercise.lifecycle?.effective_end_date ?? null,
        added_date: exercise.added_date ?? null,
        updated_date: exercise.updated_date ?? null,
      });
    } else {
      setBasics({ ...EMPTY_BASICS, id: crypto.randomUUID() });
      setPatternModifiers([]);
      setEquipment({ required: [], optional: [] });
      setMuscles({ primary: [], secondary: [] });
      setFormParameters([]);
      setGuidance({});
      setLifecycle(EMPTY_LIFECYCLE);
    }
    setError(null);
  }, [exercise]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      ...basics,
      pattern_modifiers: patternModifiers,
      equipment,
      primary_muscles: muscles.primary,
      secondary_muscles: muscles.secondary,
      form_parameters_required: formParameters,
      guidance,
      lifecycle_status: lifecycle.status,
      lifecycle_effective_start_date: lifecycle.effective_start_date,
      lifecycle_effective_end_date: lifecycle.effective_end_date,
    };

    try {
      if (isNew) {
        await createExercise(accessToken, payload);
      } else {
        await updateExercise(accessToken, basics.id, payload);
      }
      onSaved(isNew);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={styles.form}>
      {error && <p className={styles.errorBanner}>{error}</p>}

      <ExerciseFormCore
        basics={basics}
        onBasicsChange={setBasics}
        patternModifiers={patternModifiers}
        onPatternModifiersChange={setPatternModifiers}
        equipment={equipment}
        onEquipmentChange={(type, items) => setEquipment(prev => ({ ...prev, [type]: items }))}
        muscles={muscles}
        onMusclesChange={(type, items) => setMuscles(prev => ({ ...prev, [type]: items }))}
        formParameters={formParameters}
        onFormParametersChange={setFormParameters}
        referenceData={referenceData}
        isNew={isNew}
      />

      <ExerciseFormCues
        guidance={guidance}
        onGuidanceChange={setGuidance}
        lifecycle={lifecycle}
        onLifecycleChange={setLifecycle}
        roles={exercise?.roles}
        vocabularies={vocabularies}
      />

      <div className={styles.actionButtons}>
        <button type="button" className={styles.btnSecondary} onPointerUp={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? 'Saving…' : (isNew ? 'Create Exercise' : 'Save Exercise')}
        </button>
      </div>
    </form>
  );
}
