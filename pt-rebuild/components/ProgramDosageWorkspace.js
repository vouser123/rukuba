// components/ProgramDosageWorkspace.js — /program dosage workspace shell with patient context and selector controls

import NativeSelect from './NativeSelect';
import styles from './ProgramDosageWorkspace.module.css';

function formatDosageSummary(program) {
  if (!program) return null;
  const { sets, reps_per_set, seconds_per_rep, distance_feet } = program;
  if (!sets) return null;
  if (distance_feet) return `${sets} × ${distance_feet} ft`;
  if (seconds_per_rep) return `${sets} × ${seconds_per_rep}s`;
  if (reps_per_set) return `${sets} × ${reps_per_set}`;
  return `${sets} set${sets !== 1 ? 's' : ''}`;
}

export default function ProgramDosageWorkspace({
  programPatientName,
  dosageSearch,
  onDosageSearchChange,
  dosageExerciseId,
  onDosageExerciseChange,
  dosageExerciseOptions,
  dosageExercise,
  selectedProgram,
  onEditDosage,
}) {
  const dosageSummary = formatDosageSummary(selectedProgram);

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Manage Patient Dosages</h2>
      <p className={styles.description}>
        <strong>Dosages</strong> are the prescribed sets, reps, and parameters for each exercise.
      </p>
      {programPatientName && (
        <p className={styles.patientContextBanner}>
          Patient context for dosage: <strong>{programPatientName}</strong>
        </p>
      )}
      <div className={styles.selectorStack}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search exercises…"
          value={dosageSearch}
          onChange={(event) => onDosageSearchChange(event.target.value)}
        />
        <NativeSelect
          className={styles.exerciseSelect}
          value={dosageExerciseId}
          onChange={onDosageExerciseChange}
          placeholder="-- Choose an exercise --"
          options={dosageExerciseOptions.map((exercise) => ({
            value: exercise.id,
            label: `${exercise.archived ? '[archived] ' : ''}${exercise.canonical_name}`,
          }))}
        />
      </div>
      {dosageExercise ? (
        <div className={styles.dosageCard}>
          <p className={styles.dosageName}>{dosageExercise.canonical_name}</p>
          <p className={styles.dosageSummary}>
            {dosageSummary ? `Current dosage: ${dosageSummary}` : 'No dosage assigned yet.'}
          </p>
          <button
            className={styles.btnDosage}
            onPointerUp={onEditDosage}
          >
            {dosageSummary ? 'Edit dosage' : 'Set dosage'}
          </button>
        </div>
      ) : (
        <p className={styles.emptyState}>Select an exercise to manage dosage.</p>
      )}
    </section>
  );
}
