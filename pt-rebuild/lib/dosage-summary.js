export function formatDosageSummary(source, options = {}) {
  const exercise = options.exercise ?? null;
  const emptyLabel = options.emptyLabel ?? null;
  const firstDefined = (...values) => values.find((value) => value !== null && value !== undefined);

  const sets = firstDefined(source?.current_sets, source?.sets, exercise?.current_sets, exercise?.sets, 0);
  const reps = firstDefined(source?.current_reps, source?.reps_per_set, exercise?.current_reps, exercise?.reps_per_set, 0);
  const holdSeconds = firstDefined(source?.seconds_per_rep, exercise?.seconds_per_rep, 0);
  const durationSeconds = firstDefined(source?.seconds_per_set, exercise?.seconds_per_set, 0);
  const distanceFeet = firstDefined(source?.distance_feet, exercise?.distance_feet, 0);
  const dosageType = firstDefined(source?.dosage_type, exercise?.dosage_type, null);
  const modifiers = Array.isArray(source?.pattern_modifiers) && source.pattern_modifiers.length > 0
    ? source.pattern_modifiers
    : (Array.isArray(exercise?.pattern_modifiers) ? exercise.pattern_modifiers : []);
  const pattern = firstDefined(source?.pattern, exercise?.pattern, null);
  const isPerSide = pattern === 'side';

  const hasDuration = modifiers.includes('duration_seconds') || dosageType === 'duration';
  const hasHold = modifiers.includes('hold_seconds') || dosageType === 'hold';
  const hasDistance = modifiers.includes('distance_feet') || dosageType === 'distance';

  if (!sets) return emptyLabel;

  let summary = null;

  if (hasDistance && distanceFeet > 0) {
    summary = `${sets} x ${distanceFeet} ft`;
  } else if (hasDuration && durationSeconds > 0) {
    summary = `${sets} x ${durationSeconds} sec`;
  } else if (hasHold && holdSeconds > 0 && reps > 0) {
    summary = `${sets} x ${reps} reps x ${holdSeconds} sec hold`;
  } else if (reps > 0) {
    summary = `${sets} x ${reps} reps`;
  } else {
    summary = `${sets} set${sets === 1 ? '' : 's'}`;
  }

  return isPerSide ? `${summary} per side` : summary;
}
