-- Migration 010: Clean up duplicate sets created by failed edit attempts
--
-- Before the UPDATE/DELETE RLS policies were added (migration 009),
-- editing a session via PATCH would fail to delete old sets but succeed
-- in inserting new ones, creating duplicates on each attempt.
--
-- This removes duplicate sets, keeping only the most recently created
-- set for each (activity_log_id, set_number) pair.

DELETE FROM patient_activity_set_form_data
WHERE activity_set_id IN (
  SELECT id FROM patient_activity_sets
  WHERE id NOT IN (
    SELECT DISTINCT ON (activity_log_id, set_number) id
    FROM patient_activity_sets
    ORDER BY activity_log_id, set_number, created_at DESC
  )
);

DELETE FROM patient_activity_sets
WHERE id NOT IN (
  SELECT DISTINCT ON (activity_log_id, set_number) id
  FROM patient_activity_sets
  ORDER BY activity_log_id, set_number, created_at DESC
);
