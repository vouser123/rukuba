-- Migration: fix_exercise_ids
-- Remaps 13 non-UUID exercise IDs to proper UUID v4 format.
--
-- Root causes:
--   - 9 "ex000X" IDs came from original Firebase data migrated Jan 18.
--   - 4 slug IDs (e.g. "passive-great-toe-plantarflexion-stretch") were inserted Jan 28 – Feb 3
--     via pt_editor.js, which was slugifying the canonical name instead of generating a UUID.
--
-- All FK constraints are dropped, IDs updated atomically, then constraints re-added.
-- A backup table is preserved until verification is complete.

BEGIN;

-- Safety backup
CREATE TABLE exercises_backup_20260221 AS SELECT * FROM exercises;

-- Old → New UUID mapping
CREATE TEMP TABLE exercise_id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL);
INSERT INTO exercise_id_map (old_id, new_id) VALUES
  ('double-knee-to-chest',                    '21ad2f05-e0f6-47d4-91f9-5374740d4e66'),
  ('ex0001',                                  'e9657a43-6094-4363-b862-d597f51bc291'),
  ('ex0002',                                  '7794cb59-9cc3-4f98-8381-08fc8b79d405'),
  ('ex0003',                                  'dcb249d5-cf69-4ca7-8caa-9913dc36aa97'),
  ('ex0004',                                  'feec3754-47cf-4bee-a662-fc12f8d34046'),
  ('ex0005',                                  '47ac3b5e-af2f-43ec-a35d-5cb09925878f'),
  ('ex0006',                                  'afde0914-51bc-40ed-9a05-ef331625a84a'),
  ('ex0007',                                  '6d55277b-21d9-4828-9f6f-6c09c47fcceb'),
  ('ex0008',                                  'bde0bd9d-9096-4ccd-8fe3-71c9e2ef9121'),
  ('ex0009',                                  '98a28bb5-8c56-490f-90c4-407569c3b5c8'),
  ('passive-great-toe-plantarflexion-stretch', '3672a44b-02eb-41a8-80a2-9e73e8a4f3d4'),
  ('single-knee-to-chest',                    'faf49282-22eb-41dd-878f-80fc8d973be6'),
  ('standing-supported-spinal-flexion',        '2939b338-88ba-4a99-bb96-6507383116cd');

-- Drop all FK constraints referencing exercises(id)
ALTER TABLE exercise_equipment        DROP CONSTRAINT exercise_equipment_exercise_id_fkey;
ALTER TABLE exercise_form_parameters  DROP CONSTRAINT exercise_form_parameters_exercise_id_fkey;
ALTER TABLE exercise_guidance         DROP CONSTRAINT exercise_guidance_exercise_id_fkey;
ALTER TABLE exercise_muscles          DROP CONSTRAINT exercise_muscles_exercise_id_fkey;
ALTER TABLE exercise_pattern_modifiers DROP CONSTRAINT exercise_pattern_modifiers_exercise_id_fkey;
ALTER TABLE exercise_roles            DROP CONSTRAINT exercise_roles_exercise_id_fkey;
ALTER TABLE exercises                  DROP CONSTRAINT exercises_superseded_by_exercise_id_fkey;
ALTER TABLE exercises                  DROP CONSTRAINT exercises_supersedes_exercise_id_fkey;
ALTER TABLE patient_activity_logs     DROP CONSTRAINT patient_activity_logs_exercise_id_fkey;
ALTER TABLE patient_program_history   DROP CONSTRAINT patient_program_history_exercise_id_fkey;
ALTER TABLE patient_programs          DROP CONSTRAINT patient_programs_exercise_id_fkey;

-- Update exercise_id in all child tables
UPDATE exercise_equipment        SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE exercise_form_parameters  SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE exercise_guidance         SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE exercise_muscles          SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE exercise_pattern_modifiers SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE exercise_roles            SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE patient_activity_logs     SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE patient_program_history   SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;
UPDATE patient_programs          SET exercise_id = m.new_id FROM exercise_id_map m WHERE exercise_id = m.old_id;

-- Self-referential columns on exercises
UPDATE exercises SET supersedes_exercise_id    = m.new_id FROM exercise_id_map m WHERE supersedes_exercise_id    = m.old_id;
UPDATE exercises SET superseded_by_exercise_id = m.new_id FROM exercise_id_map m WHERE superseded_by_exercise_id = m.old_id;

-- Update the primary key itself
UPDATE exercises SET id = m.new_id FROM exercise_id_map m WHERE id = m.old_id;

-- Re-add all FK constraints (restoring original ON DELETE behavior)
ALTER TABLE exercise_equipment        ADD CONSTRAINT exercise_equipment_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercise_form_parameters  ADD CONSTRAINT exercise_form_parameters_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercise_guidance         ADD CONSTRAINT exercise_guidance_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercise_muscles          ADD CONSTRAINT exercise_muscles_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercise_pattern_modifiers ADD CONSTRAINT exercise_pattern_modifiers_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercise_roles            ADD CONSTRAINT exercise_roles_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE exercises                  ADD CONSTRAINT exercises_superseded_by_exercise_id_fkey
  FOREIGN KEY (superseded_by_exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
ALTER TABLE exercises                  ADD CONSTRAINT exercises_supersedes_exercise_id_fkey
  FOREIGN KEY (supersedes_exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
ALTER TABLE patient_activity_logs     ADD CONSTRAINT patient_activity_logs_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
ALTER TABLE patient_program_history   ADD CONSTRAINT patient_program_history_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
ALTER TABLE patient_programs          ADD CONSTRAINT patient_programs_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;

COMMIT;
