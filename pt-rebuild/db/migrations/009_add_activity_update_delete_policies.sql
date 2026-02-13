-- Migration 009: Add missing UPDATE and DELETE RLS policies for activity data
--
-- Bug: Editing date/time (or any field) on history sessions silently failed.
-- Root cause: RLS was enabled on patient_activity_logs, patient_activity_sets,
-- and patient_activity_set_form_data but only SELECT and INSERT policies existed.
-- UPDATE and DELETE operations were blocked by RLS with no error, so the API
-- returned success but zero rows were actually modified.

-- Activity Logs: Patients can update their own logs
CREATE POLICY activity_logs_update_own ON patient_activity_logs FOR UPDATE TO authenticated
  USING (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Logs: Patients can delete their own logs
CREATE POLICY activity_logs_delete_own ON patient_activity_logs FOR DELETE TO authenticated
  USING (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Sets: Patients can update sets on their own logs
CREATE POLICY activity_sets_update ON patient_activity_sets FOR UPDATE TO authenticated
  USING (
    activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Sets: Patients can delete sets on their own logs
CREATE POLICY activity_sets_delete ON patient_activity_sets FOR DELETE TO authenticated
  USING (
    activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Set Form Data: Patients can update form data on their own sets
CREATE POLICY set_form_data_update ON patient_activity_set_form_data FOR UPDATE TO authenticated
  USING (
    activity_set_id IN (
      SELECT id FROM patient_activity_sets
      WHERE activity_log_id IN (
        SELECT id FROM patient_activity_logs
        WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Set Form Data: Patients can delete form data on their own sets
CREATE POLICY set_form_data_delete ON patient_activity_set_form_data FOR DELETE TO authenticated
  USING (
    activity_set_id IN (
      SELECT id FROM patient_activity_sets
      WHERE activity_log_id IN (
        SELECT id FROM patient_activity_logs
        WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );
