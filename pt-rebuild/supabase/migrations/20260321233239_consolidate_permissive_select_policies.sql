-- Fix multiple_permissive_policies warnings (pt-zdk.12)
-- Each affected table had two permissive SELECT policies evaluated per query.

-- ============================================================
-- patient_activity_logs: drop narrower policy
-- activity_logs_select covers patient|therapist's-patient|admin
-- patient_activity_logs_select_own covers patient|therapist's-patient only (subset)
-- ============================================================
DROP POLICY IF EXISTS patient_activity_logs_select_own ON public.patient_activity_logs;

-- ============================================================
-- patient_activity_sets: drop narrower policy
-- activity_sets_select covers patient|therapist's-patient|admin
-- patient_activity_sets_select covers patient only (subset)
-- ============================================================
DROP POLICY IF EXISTS patient_activity_sets_select ON public.patient_activity_sets;

-- ============================================================
-- patient_activity_set_form_data: drop narrower policy
-- set_form_data_select covers patient|therapist's-patient|admin
-- patient_activity_set_form_data_select covers patient only (subset)
-- ============================================================
DROP POLICY IF EXISTS patient_activity_set_form_data_select ON public.patient_activity_set_form_data;

-- ============================================================
-- Vocab tables: _modify used FOR ALL (includes SELECT) alongside _select
-- Replace each _modify ALL policy with explicit INSERT/UPDATE/DELETE policies
-- so only the _select policy covers SELECT.
-- ============================================================

-- vocab_capacity
DROP POLICY IF EXISTS vocab_capacity_modify ON public.vocab_capacity;
CREATE POLICY vocab_capacity_insert ON public.vocab_capacity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_capacity_update ON public.vocab_capacity FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_capacity_delete ON public.vocab_capacity FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));

-- vocab_contribution
DROP POLICY IF EXISTS vocab_contribution_modify ON public.vocab_contribution;
CREATE POLICY vocab_contribution_insert ON public.vocab_contribution FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_contribution_update ON public.vocab_contribution FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_contribution_delete ON public.vocab_contribution FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));

-- vocab_focus
DROP POLICY IF EXISTS vocab_focus_modify ON public.vocab_focus;
CREATE POLICY vocab_focus_insert ON public.vocab_focus FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_focus_update ON public.vocab_focus FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_focus_delete ON public.vocab_focus FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));

-- vocab_pattern
DROP POLICY IF EXISTS vocab_pattern_modify ON public.vocab_pattern;
CREATE POLICY vocab_pattern_insert ON public.vocab_pattern FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_pattern_update ON public.vocab_pattern FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_pattern_delete ON public.vocab_pattern FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));

-- vocab_pt_category
DROP POLICY IF EXISTS vocab_pt_category_modify ON public.vocab_pt_category;
CREATE POLICY vocab_pt_category_insert ON public.vocab_pt_category FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_pt_category_update ON public.vocab_pt_category FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_pt_category_delete ON public.vocab_pt_category FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));

-- vocab_region
DROP POLICY IF EXISTS vocab_region_modify ON public.vocab_region;
CREATE POLICY vocab_region_insert ON public.vocab_region FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_region_update ON public.vocab_region FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));
CREATE POLICY vocab_region_delete ON public.vocab_region FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = (SELECT auth.uid()) AND role = ANY(ARRAY['therapist','admin'])));;
