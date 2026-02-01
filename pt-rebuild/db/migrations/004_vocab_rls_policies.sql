-- ============================================================================
-- Vocabulary Tables RLS Policies
-- ============================================================================
-- All authenticated users can read vocabularies
-- Only therapists/admins can modify vocabularies
-- ============================================================================

-- Enable RLS on all vocab tables
ALTER TABLE vocab_region ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_pt_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_pattern ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Read policies - all authenticated users can read
-- ============================================================================

CREATE POLICY vocab_region_select ON vocab_region FOR SELECT TO authenticated USING (true);
CREATE POLICY vocab_capacity_select ON vocab_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY vocab_contribution_select ON vocab_contribution FOR SELECT TO authenticated USING (true);
CREATE POLICY vocab_focus_select ON vocab_focus FOR SELECT TO authenticated USING (true);
CREATE POLICY vocab_pt_category_select ON vocab_pt_category FOR SELECT TO authenticated USING (true);
CREATE POLICY vocab_pattern_select ON vocab_pattern FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Modify policies - only therapists and admins can insert/update/delete
-- ============================================================================

CREATE POLICY vocab_region_modify ON vocab_region FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

CREATE POLICY vocab_capacity_modify ON vocab_capacity FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

CREATE POLICY vocab_contribution_modify ON vocab_contribution FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

CREATE POLICY vocab_focus_modify ON vocab_focus FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

CREATE POLICY vocab_pt_category_modify ON vocab_pt_category FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

CREATE POLICY vocab_pattern_modify ON vocab_pattern FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('therapist', 'admin'))
  );

-- ============================================================================
-- Note: Run this migration in Supabase SQL Editor
-- ============================================================================
