import { useMemo, useState } from 'react';
import NativeSelect from './NativeSelect';
import styles from './ExerciseForm.module.css';
import { mapVocabTermsToOptions } from '../lib/vocab-options';

export default function ProgramRolesSection({
  exercise,
  roles,
  rolesLoading,
  vocabularies,
  onAddRole,
  onDeleteRole,
}) {
  const [newRegion, setNewRegion] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newContribution, setNewContribution] = useState('');
  const [addRoleError, setAddRoleError] = useState(null);

  const regionOptions = useMemo(
    () => mapVocabTermsToOptions(vocabularies?.region ?? []),
    [vocabularies?.region]
  );
  const capacityOptions = useMemo(
    () => mapVocabTermsToOptions(vocabularies?.capacity ?? []),
    [vocabularies?.capacity]
  );
  const focusOptions = useMemo(
    () => mapVocabTermsToOptions(vocabularies?.focus ?? []),
    [vocabularies?.focus]
  );
  const contributionOptions = useMemo(
    () => mapVocabTermsToOptions(vocabularies?.contribution ?? []),
    [vocabularies?.contribution]
  );

  async function handleAddRole() {
    setAddRoleError(null);
    if (!exercise?.id) {
      setAddRoleError('Save and select an exercise first.');
      return;
    }
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
      setNewRegion('');
      setNewCapacity('');
      setNewFocus('');
      setNewContribution('');
    } catch (err) {
      setAddRoleError(err.message);
    }
  }

  if (!exercise?.id) {
    return <p className={styles.emptyNote}>Select or save an exercise above to manage roles.</p>;
  }

  return (
    <div className={styles.sectionContent}>
      <p className={styles.hint}>Managing roles for <strong>{exercise.canonical_name}</strong>.</p>

      {roles && roles.length > 0 ? (
        <table className={styles.rolesTable}>
          <thead>
            <tr>
              <th>Region</th>
              <th>Capacity</th>
              <th>Focus</th>
              <th>Contribution</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role, index) => (
              <tr key={role.id ?? `${role.region}-${role.capacity}-${role.focus ?? 'general'}-${index}`}>
                <td>{role.region}</td>
                <td>{role.capacity}</td>
                <td>{role.focus ?? '—'}</td>
                <td>{role.contribution}</td>
                <td>
                  <button
                    type="button"
                    className={styles.roleRemoveBtn}
                    onPointerUp={() => onDeleteRole(role.id)}
                    disabled={rolesLoading || !role.id}
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
        <p className={styles.emptyNote}>No roles assigned yet.</p>
      )}

      <div className={styles.addRoleForm}>
        <p className={styles.fieldLabel}>Add Role</p>
        {addRoleError && <p className={styles.roleError}>{addRoleError}</p>}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Region *</label>
            <NativeSelect
              className={styles.select}
              value={newRegion}
              onChange={setNewRegion}
              disabled={rolesLoading}
              placeholder="Select..."
              options={regionOptions}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Capacity *</label>
            <NativeSelect
              className={styles.select}
              value={newCapacity}
              onChange={setNewCapacity}
              disabled={rolesLoading}
              placeholder="Select..."
              options={capacityOptions}
            />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Focus</label>
            <NativeSelect
              className={styles.select}
              value={newFocus}
              onChange={setNewFocus}
              disabled={rolesLoading}
              placeholder="None"
              options={focusOptions}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Contribution *</label>
            <NativeSelect
              className={styles.select}
              value={newContribution}
              onChange={setNewContribution}
              disabled={rolesLoading}
              placeholder="Select..."
              options={contributionOptions}
            />
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
    </div>
  );
}
