
-- Fix admin access to patient-facing tables.
-- Admin user is also a patient; RLS SELECT policies on patient_programs and
-- patient_program_history did not include an admin bypass, causing the patient
-- app to return empty programs/history for an admin-role user.

-- patient_programs: add admin bypass to SELECT policy
DROP POLICY IF EXISTS patient_programs_select_own ON patient_programs;
CREATE POLICY patient_programs_select_own ON patient_programs
  FOR SELECT TO authenticated
  USING (
    (patient_id IN (
      SELECT users.id FROM users WHERE users.auth_id = (SELECT auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = (SELECT auth.uid())
        AND u.role = 'therapist'
        AND patient_programs.patient_id IN (
          SELECT users.id FROM users WHERE users.therapist_id = u.id
        )
    ))
    OR (EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = (SELECT auth.uid()) AND users.role = 'admin'
    ))
  );

-- patient_program_history: add admin bypass to SELECT policy
DROP POLICY IF EXISTS patient_program_history_select ON patient_program_history;
CREATE POLICY patient_program_history_select ON patient_program_history
  FOR SELECT TO authenticated
  USING (
    (patient_id IN (
      SELECT users.id FROM users WHERE users.auth_id = (SELECT auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = (SELECT auth.uid())
        AND u.role = 'therapist'
        AND patient_program_history.patient_id IN (
          SELECT users.id FROM users WHERE users.therapist_id = u.id
        )
    ))
    OR (EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = (SELECT auth.uid()) AND users.role = 'admin'
    ))
  );
;
