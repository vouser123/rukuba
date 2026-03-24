-- Drop backup table (pt-zdk.11) — created 2026-02-21, no longer needed
DROP TABLE IF EXISTS public.exercises_backup_20260221;

-- Drop unused indexes (Supabase advisor: unused_index)
-- None of these have ever been used; all were pre-emptive additions

-- patient_programs
DROP INDEX IF EXISTS idx_patient_programs_assigned_at;
DROP INDEX IF EXISTS idx_patient_programs_assigned_by;
DROP INDEX IF EXISTS idx_patient_programs_archived_at;
DROP INDEX IF EXISTS patient_programs_created_at_idx;

-- patient_program_history
DROP INDEX IF EXISTS idx_program_history_patient;
DROP INDEX IF EXISTS idx_program_history_changed_at;
DROP INDEX IF EXISTS idx_patient_program_history_changed_by;

-- clinical_messages
DROP INDEX IF EXISTS idx_clinical_messages_patient;
DROP INDEX IF EXISTS idx_clinical_messages_created_at;
DROP INDEX IF EXISTS idx_clinical_messages_deleted_by;

-- offline_mutations
DROP INDEX IF EXISTS idx_offline_mutations_user;
DROP INDEX IF EXISTS idx_offline_mutations_pending;

-- exercise child tables
DROP INDEX IF EXISTS exercise_pattern_modifiers_exercise_id_idx;
DROP INDEX IF EXISTS exercise_form_parameters_exercise_id_idx;
DROP INDEX IF EXISTS exercise_guidance_exercise_id_idx;
DROP INDEX IF EXISTS idx_exercise_roles_active;;
