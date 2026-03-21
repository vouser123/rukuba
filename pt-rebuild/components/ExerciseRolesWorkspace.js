// components/ExerciseRolesWorkspace.js — exercise roles workspace shell with selector controls

import NativeSelect from './NativeSelect';
import ProgramRolesSection from './ProgramRolesSection';
import styles from './ExerciseRolesWorkspace.module.css';

export default function ExerciseRolesWorkspace({
  roleSearch,
  onRoleSearchChange,
  roleExerciseId,
  onRoleExerciseChange,
  roleExerciseOptions,
  roleExercise,
  rolesLoading,
  vocabularies,
  onAddRole,
  onDeleteRole,
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Assign Roles to Exercises</h2>
      <p className={styles.description}>
        <strong>Roles</strong> define how an exercise contributes to different movement capacities in different body regions.
      </p>
      <div className={styles.selectorStack}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search exercises…"
          value={roleSearch}
          onChange={(event) => onRoleSearchChange(event.target.value)}
        />
        <NativeSelect
          className={styles.exerciseSelect}
          value={roleExerciseId}
          onChange={onRoleExerciseChange}
          placeholder="-- Choose an exercise --"
          options={roleExerciseOptions.map((exercise) => ({
            value: exercise.id,
            label: `${exercise.archived ? '[archived] ' : ''}${exercise.canonical_name}`,
          }))}
        />
      </div>
      <ProgramRolesSection
        exercise={roleExercise}
        roles={roleExercise?.roles ?? []}
        rolesLoading={rolesLoading}
        vocabularies={vocabularies}
        onAddRole={onAddRole}
        onDeleteRole={onDeleteRole}
      />
    </section>
  );
}
