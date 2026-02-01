-- Migration: Fix RLS policies to allow therapists to see their patients' activity data
-- Problem: Therapists could see activity logs but not the sets within them

-- Drop existing policies
DROP POLICY IF EXISTS activity_sets_select ON patient_activity_sets;
DROP POLICY IF EXISTS set_form_data_select ON patient_activity_set_form_data;
DROP POLICY IF EXISTS activity_logs_select ON patient_activity_logs;

-- Recreate activity_logs_select with therapist access
CREATE POLICY activity_logs_select ON patient_activity_logs FOR SELECT TO authenticated
  USING (
    -- Patient can see own logs
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    -- Therapist can see logs for patients assigned to them
    patient_id IN (
      SELECT id FROM users
      WHERE therapist_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR
    -- Admin can see all
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Recreate activity_sets_select with therapist access
CREATE POLICY activity_sets_select ON patient_activity_sets FOR SELECT TO authenticated
  USING (
    activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE
        -- Patient can see own
        patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR
        -- Therapist can see for their patients
        patient_id IN (
          SELECT id FROM users
          WHERE therapist_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Recreate set_form_data_select with therapist access
CREATE POLICY set_form_data_select ON patient_activity_set_form_data FOR SELECT TO authenticated
  USING (
    activity_set_id IN (
      SELECT pas.id FROM patient_activity_sets pas
      JOIN patient_activity_logs pal ON pas.activity_log_id = pal.id
      WHERE
        -- Patient can see own
        pal.patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR
        -- Therapist can see for their patients
        pal.patient_id IN (
          SELECT id FROM users
          WHERE therapist_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );
