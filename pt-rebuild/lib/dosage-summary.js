export function formatDosageSummary(source, options = {}) {
  const exercise = options.exercise ?? null;
  const emptyLabel = options.emptyLabel ?? null;
  const merged = { ...(exercise ?? {}), ...(source ?? {}) };

  const sets = merged.current_sets ?? merged.sets ?? 0;
  const reps = merged.current_reps ?? merged.reps_per_set ?? 0;
  const holdSeconds = merged.seconds_per_rep ?? 0;
  const durationSeconds = merged.seconds_per_set ?? 0;
  const distanceFeet = merged.distance_feet ?? 0;
  const dosageType = merged.dosage_type ?? null;
  const modifiers = Array.isArray(merged.pattern_modifiers) ? merged.pattern_modifiers : [];
  const isPerSide = merged.pattern === 'side';

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
