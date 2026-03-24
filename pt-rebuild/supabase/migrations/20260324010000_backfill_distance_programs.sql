-- Repair migrated distance program rows that lost distance_feet and kept the
-- legacy placeholder reps_per_set=1 shape.
UPDATE public.patient_programs AS p
SET
  dosage_type = 'distance',
  reps_per_set = NULL,
  distance_feet = 20,
  updated_at = NOW()
FROM public.exercises AS e
WHERE p.exercise_id = e.id
  AND e.canonical_name IN ('Side Steps', 'Monster Walk')
  AND p.dosage_type = 'reps'
  AND p.reps_per_set = 1
  AND p.distance_feet IS NULL;
