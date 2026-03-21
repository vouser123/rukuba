// components/ProgramExerciseSelector.js — /program exercise selection workspace for opening or creating exercise forms

import NativeSelect from './NativeSelect';
import styles from './ProgramExerciseSelector.module.css';

export default function ProgramExerciseSelector({
  search,
  onSearchChange,
  showArchived,
  onShowArchivedChange,
  activeExerciseId,
  onExerciseChange,
  exerciseOptions,
}) {
  return (
    <div className={styles.selectorPanel}>
      <h2 className={styles.title}>Select Exercise to Edit</h2>
      <input
        className={styles.searchInput}
        type="search"
        placeholder="Search exercises…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <label className={styles.archiveToggle}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => onShowArchivedChange(event.target.checked)}
        />
        Show archived
      </label>
      <NativeSelect
        className={styles.exerciseSelect}
        value={activeExerciseId}
        onChange={onExerciseChange}
        placeholder="-- Add New Exercise (leave blank) --"
        options={exerciseOptions.map((exercise) => ({
          value: exercise.id,
          label: `${exercise.archived ? '[archived] ' : ''}${exercise.canonical_name}`,
        }))}
      />
    </div>
  );
}
