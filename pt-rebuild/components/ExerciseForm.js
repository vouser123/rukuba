// ExerciseForm.js — exercise form orchestrator: state management, save/cancel, composes Core + Cues + Lifecycle

import { useState, useEffect } from 'react';
import { createExercise, updateExercise, addRole, deleteRole } from '../lib/pt-editor';
import ExerciseFormCore from './ExerciseFormCore';
import ExerciseFormCues from './ExerciseFormCues';
import ExerciseFormLifecycle from './ExerciseFormLifecycle';
import styles from './ExerciseForm.module.css';

const EMPTY_BASICS = {
  id: '', canonical_name: '', description: '', pt_category: '', pattern: '', archived: false,
};
const EMPTY_LIFECYCLE = {
  status: null, effective_start_date: null, effective_end_date: null,
  added_date: null, updated_date: null,
  superseded_by: null, superseded_date: null,
};

/**
 * Exercise form orchestrator. Holds all form state and delegates rendering to
 * ExerciseFormCore (sections 1–4), ExerciseFormCues (sections 5, 7, 8),
 * and ExerciseFormLifecycle (section 6).
 *
 * @param {Object|null} exercise      - null = new exercise; full exercise object = edit
 * @param {Array} exercises           - full exercise list for the supersedes dropdown
 * @param {Object} referenceData      - { equipment: [], muscles: [], formParameters: [] }
 * @param {Object} vocabularies       - keyed by category
 * @param {string} accessToken
 * @param {Function} onSaved          - (isNew: boolean) => void — called after successful save
 * @param {Function} onCancel
 */
export default function ExerciseForm({ exercise, exercises, referenceData, vocabularies, accessToken, onSaved, onCancel }) {
  const isNew = !exercise;

  const [basics, setBasics] = useState(EMPTY_BASICS);
  const [patternModifiers, setPatternModifiers] = useState([]);
  const [equipment, setEquipment] = useState({ required: [], optional: [] });
  const [muscles, setMuscles] = useState({ primary: [], secondary: [] });
  const [formParameters, setFormParameters] = useState([]);
  const [guidance, setGuidance] = useState({});
  const [lifecycle, setLifecycle] = useState(EMPTY_LIFECYCLE);
  // ID of the exercise this one supersedes (null = none); saved as supersedes_exercise_id
  const [supersedes, setSupersedes] = useState(null);
  const [localRoles, setLocalRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
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
        superseded_by: exercise.superseded_by ?? null,
        superseded_date: exercise.superseded_date ?? null,
      });
      // supersedes is stored as an array from the GET; take first element
      setSupersedes(exercise.supersedes?.[0] ?? null);
      setLocalRoles(exercise.roles ?? []);
    } else {
      setBasics({ ...EMPTY_BASICS, id: crypto.randomUUID() });
      setPatternModifiers([]);
      setEquipment({ required: [], optional: [] });
      setMuscles({ primary: [], secondary: [] });
      setFormParameters([]);
      setGuidance({});
      setLifecycle(EMPTY_LIFECYCLE);
      setSupersedes(null);
      setLocalRoles([]);
    }
    setError(null);
  }, [exercise]);

  /** Add a role assignment. Calls the API and optimistically updates local state. */
  async function handleAddRole(roleData) {
    setRolesLoading(true);
    try {
      const result = await addRole(accessToken, { ...roleData, exercise_id: basics.id });
      setLocalRoles(prev => [...prev, result.role]);
    } finally {
      setRolesLoading(false);
    }
  }

  /** Remove a role assignment (soft-delete). Calls the API and updates local state. */
  async function handleDeleteRole(roleId) {
    setRolesLoading(true);
    try {
      await deleteRole(accessToken, roleId);
      setLocalRoles(prev => prev.filter(r => r.id !== roleId));
    } finally {
      setRolesLoading(false);
    }
  }

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
      supersedes_exercise_id: supersedes || null,
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
        roles={localRoles}
        onAddRole={handleAddRole}
        onDeleteRole={handleDeleteRole}
        rolesLoading={rolesLoading}
        rolesDisabled={isNew}
        vocabularies={vocabularies}
      />

      <ExerciseFormLifecycle
        lifecycle={lifecycle}
        onLifecycleChange={setLifecycle}
        supersedes={supersedes}
        onSupersedingChange={setSupersedes}
        exercises={exercises ?? []}
        currentExerciseId={basics.id}
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
