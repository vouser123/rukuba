-- Migration: fix_rls_auth_uid_initplan
-- Wraps bare auth.uid() calls in (select auth.uid()) so they are evaluated once
-- per query instead of once per row. Pure performance fix, zero behavior change.
-- Affects: patient_activity_logs, patient_activity_sets, patient_activity_set_form_data,
--          vocab_region, vocab_capacity, vocab_contribution, vocab_focus, vocab_pt_category, vocab_pattern
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ============================================================
-- patient_activity_logs
-- ============================================================

DROP POLICY activity_logs_select ON patient_activity_logs;
CREATE POLICY activity_logs_select ON patient_activity_logs
  FOR SELECT TO authenticated
  USING (
    (patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
    OR (patient_id IN (SELECT id FROM users WHERE therapist_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY activity_logs_update_own ON patient_activity_logs;
CREATE POLICY activity_logs_update_own ON patient_activity_logs
  FOR UPDATE TO authenticated
  USING (
    (patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY activity_logs_delete_own ON patient_activity_logs;
CREATE POLICY activity_logs_delete_own ON patient_activity_logs
  FOR DELETE TO authenticated
  USING (
    (patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

-- ============================================================
-- patient_activity_sets
-- ============================================================

DROP POLICY activity_sets_select ON patient_activity_sets;
CREATE POLICY activity_sets_select ON patient_activity_sets
  FOR SELECT TO authenticated
  USING (
    (activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE (patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
         OR (patient_id IN (SELECT id FROM users WHERE therapist_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))))
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY activity_sets_update ON patient_activity_sets;
CREATE POLICY activity_sets_update ON patient_activity_sets
  FOR UPDATE TO authenticated
  USING (
    (activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY activity_sets_delete ON patient_activity_sets;
CREATE POLICY activity_sets_delete ON patient_activity_sets
  FOR DELETE TO authenticated
  USING (
    (activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

-- ============================================================
-- patient_activity_set_form_data
-- ============================================================

DROP POLICY set_form_data_select ON patient_activity_set_form_data;
CREATE POLICY set_form_data_select ON patient_activity_set_form_data
  FOR SELECT TO authenticated
  USING (
    (activity_set_id IN (
      SELECT pas.id
      FROM patient_activity_sets pas
      JOIN patient_activity_logs pal ON pas.activity_log_id = pal.id
      WHERE (pal.patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
         OR (pal.patient_id IN (SELECT id FROM users WHERE therapist_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))))
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY set_form_data_update ON patient_activity_set_form_data;
CREATE POLICY set_form_data_update ON patient_activity_set_form_data
  FOR UPDATE TO authenticated
  USING (
    (activity_set_id IN (
      SELECT patient_activity_sets.id FROM patient_activity_sets
      WHERE activity_log_id IN (
        SELECT id FROM patient_activity_logs
        WHERE patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))
      )
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

DROP POLICY set_form_data_delete ON patient_activity_set_form_data;
CREATE POLICY set_form_data_delete ON patient_activity_set_form_data
  FOR DELETE TO authenticated
  USING (
    (activity_set_id IN (
      SELECT patient_activity_sets.id FROM patient_activity_sets
      WHERE activity_log_id IN (
        SELECT id FROM patient_activity_logs
        WHERE patient_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()))
      )
    ))
    OR (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'))
  );

-- ============================================================
-- vocab tables (region, capacity, contribution, focus, pt_category, pattern)
-- All have the same pattern: _modify policy uses bare auth.uid()
-- ============================================================

DROP POLICY vocab_region_modify ON vocab_region;
CREATE POLICY vocab_region_modify ON vocab_region
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

DROP POLICY vocab_capacity_modify ON vocab_capacity;
CREATE POLICY vocab_capacity_modify ON vocab_capacity
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

DROP POLICY vocab_contribution_modify ON vocab_contribution;
CREATE POLICY vocab_contribution_modify ON vocab_contribution
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

DROP POLICY vocab_focus_modify ON vocab_focus;
CREATE POLICY vocab_focus_modify ON vocab_focus
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

DROP POLICY vocab_pt_category_modify ON vocab_pt_category;
CREATE POLICY vocab_pt_category_modify ON vocab_pt_category
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

DROP POLICY vocab_pattern_modify ON vocab_pattern;
CREATE POLICY vocab_pattern_modify ON vocab_pattern
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = (SELECT auth.uid()) AND role = ANY (ARRAY['therapist','admin'])));

COMMIT;;
