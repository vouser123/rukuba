-- ============================================================================
-- PT Tracker Rebuild - Normalized Database Schema
-- ============================================================================
-- Design Principles:
-- 1. Clinical PT terminology (not Firebase legacy names)
-- 2. Fully normalized - ZERO JSONB
-- 3. Server-authoritative with foreign key constraints
-- 4. Deduplication via client_mutation_id
-- ============================================================================

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'therapist', 'admin')),
  therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_therapist ON users(therapist_id);

COMMENT ON TABLE users IS 'User accounts linked to Supabase Auth';
COMMENT ON COLUMN users.auth_id IS 'References auth.users - Supabase Auth integration';
COMMENT ON COLUMN users.therapist_id IS 'For patients only - their assigned therapist';

-- ============================================================================
-- EXERCISE LIBRARY (Shared Canonical Definitions)
-- ============================================================================

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  description TEXT NOT NULL,
  pt_category TEXT NOT NULL CHECK (pt_category IN ('back_sij', 'knee', 'ankle', 'hip', 'vestibular', 'foot', 'shoulder', 'other')),
  pattern TEXT NOT NULL CHECK (pattern IN ('side', 'both')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  lifecycle_status TEXT CHECK (lifecycle_status IN ('active', 'archived', 'deprecated')),
  lifecycle_effective_start_date DATE,
  lifecycle_effective_end_date DATE,
  supersedes_exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  superseded_by_exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  superseded_date TIMESTAMPTZ,
  added_date DATE,
  updated_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_canonical_name ON exercises(canonical_name);
CREATE INDEX idx_exercises_archived ON exercises(archived);
CREATE INDEX idx_exercises_category ON exercises(pt_category);

COMMENT ON TABLE exercises IS 'Shared exercise library - canonical exercise definitions';
COMMENT ON COLUMN exercises.pattern IS 'side = per-side execution (e.g., 10 reps left + 10 reps right), both = bilateral simultaneous';
COMMENT ON COLUMN exercises.pt_category IS 'High-level PT category for scheduling and grouping';

-- ============================================================================
-- EXERCISE ATTRIBUTES (Normalized from nested JSON)
-- ============================================================================

CREATE TABLE exercise_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_equipment_exercise ON exercise_equipment(exercise_id);
CREATE UNIQUE INDEX idx_exercise_equipment_unique ON exercise_equipment(exercise_id, equipment_name, is_required);

COMMENT ON TABLE exercise_equipment IS 'Equipment per exercise (required or optional)';
COMMENT ON COLUMN exercise_equipment.is_required IS 'true = intrinsic to exercise, false = comfort/modification';

-- ============================================================================

CREATE TABLE exercise_muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_muscles_exercise ON exercise_muscles(exercise_id);
CREATE UNIQUE INDEX idx_exercise_muscles_unique ON exercise_muscles(exercise_id, muscle_name, is_primary);

COMMENT ON TABLE exercise_muscles IS 'Muscles targeted per exercise';
COMMENT ON COLUMN exercise_muscles.is_primary IS 'true = primary mover, false = stabilizer/synergist';

-- ============================================================================

CREATE TABLE exercise_pattern_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  modifier TEXT NOT NULL CHECK (modifier IN ('duration_seconds', 'hold_seconds', 'distance_feet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pattern_modifiers_exercise ON exercise_pattern_modifiers(exercise_id);
CREATE UNIQUE INDEX idx_pattern_modifiers_unique ON exercise_pattern_modifiers(exercise_id, modifier);

COMMENT ON TABLE exercise_pattern_modifiers IS 'Pattern-level dosage modifiers';
COMMENT ON COLUMN exercise_pattern_modifiers.modifier IS 'duration_seconds = REPLACES reps with time, hold_seconds = MODIFIES reps to add isometric hold, distance_feet = REPLACES reps with distance. Can combine: hold_seconds + distance_feet';

-- ============================================================================

CREATE TABLE exercise_form_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_parameters_exercise ON exercise_form_parameters(exercise_id);
CREATE UNIQUE INDEX idx_form_parameters_unique ON exercise_form_parameters(exercise_id, parameter_name);

COMMENT ON TABLE exercise_form_parameters IS 'Variable configuration parameters required for this exercise (e.g., band_resistance, surface, eyes, distance). Values are logged per-set in patient_activity_set_form_data.';
COMMENT ON COLUMN exercise_form_parameters.parameter_name IS 'Parameter name - fully mutable, no enum constraint. Common values: distance, band_resistance, band_location, band_position, eyes, surface, weight, strap_position, slope';

-- ============================================================================

CREATE TABLE exercise_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('motor_cues', 'compensation_warnings', 'safety_flags', 'external_cues')),
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_guidance_exercise ON exercise_guidance(exercise_id, section);

COMMENT ON TABLE exercise_guidance IS 'Exercise performance guidance organized by section';
COMMENT ON COLUMN exercise_guidance.section IS 'motor_cues = how to move, compensation_warnings = common mistakes to avoid, safety_flags = stop/modify conditions, external_cues = visual/tactile cues';

-- ============================================================================
-- EXERCISE ROLES (Coverage/Rehab Analysis)
-- ============================================================================

CREATE TABLE exercise_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  region TEXT NOT NULL CHECK (region IN ('core', 'back', 'hip', 'knee', 'ankle', 'foot', 'vestibular')),
  capacity TEXT NOT NULL CHECK (capacity IN ('strength', 'control', 'stability', 'tolerance', 'mobility')),
  focus TEXT,
  contribution TEXT NOT NULL CHECK (contribution IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_roles_exercise ON exercise_roles(exercise_id);
CREATE INDEX idx_exercise_roles_region ON exercise_roles(region);
CREATE INDEX idx_exercise_roles_capacity ON exercise_roles(capacity);
CREATE INDEX idx_exercise_roles_contribution ON exercise_roles(contribution);

COMMENT ON TABLE exercise_roles IS 'Rehab coverage roles assigned to exercises (region × capacity × focus × contribution)';
COMMENT ON COLUMN exercise_roles.region IS 'Anatomical region targeted';
COMMENT ON COLUMN exercise_roles.capacity IS 'Functional capacity addressed';
COMMENT ON COLUMN exercise_roles.focus IS 'Optional specific focus within capacity (e.g., anti_rotation for back stability)';
COMMENT ON COLUMN exercise_roles.contribution IS 'Relative contribution of this exercise to the role (low/medium/high)';

-- ============================================================================
-- PATIENT PROGRAM (Therapist-Assigned Dosages)
-- ============================================================================

CREATE TABLE patient_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  -- Dosage prescription (replaces Firebase "current" field)
  dosage_type TEXT NOT NULL CHECK (dosage_type IN ('reps', 'hold', 'duration', 'distance')),
  sets INT CHECK (sets > 0),
  reps_per_set INT CHECK (reps_per_set > 0),
  seconds_per_rep INT CHECK (seconds_per_rep >= 0),
  seconds_per_set INT CHECK (seconds_per_set >= 0),
  distance_feet INT CHECK (distance_feet > 0),

  -- Metadata
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(patient_id, exercise_id)
);

CREATE INDEX idx_patient_programs_patient ON patient_programs(patient_id);
CREATE INDEX idx_patient_programs_exercise ON patient_programs(exercise_id);
CREATE INDEX idx_patient_programs_assigned_at ON patient_programs(assigned_at DESC);

COMMENT ON TABLE patient_programs IS 'Therapist-prescribed exercise dosages per patient (replaces Firebase "current" field)';
COMMENT ON COLUMN patient_programs.dosage_type IS 'Determines which fields are used: reps = sets×reps, hold = sets×reps×seconds_per_rep, duration = sets×seconds_per_set, distance = sets×distance_feet';
COMMENT ON COLUMN patient_programs.sets IS 'Number of sets prescribed';
COMMENT ON COLUMN patient_programs.reps_per_set IS 'Repetitions per set (for reps/hold dosage types)';
COMMENT ON COLUMN patient_programs.seconds_per_rep IS 'Hold duration per rep (for hold dosage type)';
COMMENT ON COLUMN patient_programs.seconds_per_set IS 'Total duration per set (for duration dosage type)';
COMMENT ON COLUMN patient_programs.distance_feet IS 'Distance per set in feet (for distance dosage type)';

-- ============================================================================

CREATE TABLE patient_program_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  -- Snapshot of dosage change
  dosage_type TEXT NOT NULL,
  sets INT,
  reps_per_set INT,
  seconds_per_rep INT,
  seconds_per_set INT,
  distance_feet INT,

  -- Metadata
  changed_by_therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  change_summary TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_history_patient ON patient_program_history(patient_id);
CREATE INDEX idx_program_history_exercise ON patient_program_history(exercise_id);
CREATE INDEX idx_program_history_changed_at ON patient_program_history(changed_at DESC);

COMMENT ON TABLE patient_program_history IS 'Audit trail of dosage changes (replaces Firebase "history" array)';

-- ============================================================================
-- PATIENT ACTIVITY (Exercise Performance Logs)
-- ============================================================================

CREATE TABLE patient_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Exercise reference
  exercise_id TEXT REFERENCES exercises(id) ON DELETE RESTRICT,
  exercise_name TEXT NOT NULL,

  -- Deduplication (prevents duplicate submissions from offline queue)
  client_mutation_id TEXT NOT NULL,

  -- Activity metadata
  activity_type TEXT NOT NULL CHECK (activity_type IN ('reps', 'hold', 'duration', 'distance')),
  notes TEXT,
  performed_at TIMESTAMPTZ NOT NULL,

  -- Client timestamps (for offline queue reconciliation)
  client_created_at TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(patient_id, client_mutation_id)
);

CREATE INDEX idx_activity_logs_patient ON patient_activity_logs(patient_id);
CREATE INDEX idx_activity_logs_exercise ON patient_activity_logs(exercise_id);
CREATE INDEX idx_activity_logs_performed_at ON patient_activity_logs(performed_at DESC);
CREATE INDEX idx_activity_logs_created_at ON patient_activity_logs(created_at DESC);

COMMENT ON TABLE patient_activity_logs IS 'Patient exercise performance logs (replaces Firebase "sessions" collection)';
COMMENT ON COLUMN patient_activity_logs.client_mutation_id IS 'Client-generated UUID for deduplication. Prevents duplicate logs when offline queue retries submission.';
COMMENT ON COLUMN patient_activity_logs.exercise_name IS 'Denormalized for display reliability (exercise may be archived/deleted)';
COMMENT ON COLUMN patient_activity_logs.activity_type IS 'Type of activity logged (matches dosage_type from patient_programs)';
COMMENT ON COLUMN patient_activity_logs.performed_at IS 'When the patient performed the exercise (user-supplied timestamp)';
COMMENT ON COLUMN patient_activity_logs.client_created_at IS 'Client timestamp when log was created (for offline reconciliation)';

-- ============================================================================

CREATE TABLE patient_activity_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id UUID NOT NULL REFERENCES patient_activity_logs(id) ON DELETE CASCADE,
  set_number INT NOT NULL CHECK (set_number > 0),

  -- Performance data (which fields are populated depends on pattern_modifiers)
  -- reps: populated for reps/hold activity types
  -- seconds: populated for hold/duration activity types
  -- distance_feet: populated for distance activity type
  reps INT CHECK (reps >= 0),
  seconds INT CHECK (seconds >= 0),
  distance_feet INT CHECK (distance_feet >= 0),

  -- Side tracking
  side TEXT CHECK (side IN ('left', 'right', 'both')),

  -- Metadata
  manual_log BOOLEAN NOT NULL DEFAULT FALSE,
  partial_rep BOOLEAN NOT NULL DEFAULT FALSE,

  performed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_sets_log ON patient_activity_sets(activity_log_id);
CREATE INDEX idx_activity_sets_set_number ON patient_activity_sets(activity_log_id, set_number);

COMMENT ON TABLE patient_activity_sets IS 'Individual sets within a patient activity log';
COMMENT ON COLUMN patient_activity_sets.reps IS 'Actual reps achieved (NULL if activity_type is duration or distance)';
COMMENT ON COLUMN patient_activity_sets.seconds IS 'Actual seconds achieved (NULL unless activity_type is hold or duration)';
COMMENT ON COLUMN patient_activity_sets.distance_feet IS 'Actual distance achieved in feet (NULL unless activity_type is distance)';
COMMENT ON COLUMN patient_activity_sets.side IS 'Which side performed (for pattern=side exercises)';
COMMENT ON COLUMN patient_activity_sets.manual_log IS 'true = user manually entered value, false = counted by app';
COMMENT ON COLUMN patient_activity_sets.partial_rep IS 'true = incomplete rep logged (for tracking partial ROM)';

-- ============================================================================

CREATE TABLE patient_activity_set_form_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_set_id UUID NOT NULL REFERENCES patient_activity_sets(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  parameter_value TEXT NOT NULL,
  parameter_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_set_form_data_set ON patient_activity_set_form_data(activity_set_id);

COMMENT ON TABLE patient_activity_set_form_data IS 'Variable form parameter values logged per set (e.g., band_resistance=blue, distance=8 inch, eyes=closed)';
COMMENT ON COLUMN patient_activity_set_form_data.parameter_unit IS 'Unit for distance-type parameters (ft, inch, cm, degree). NULL for non-distance parameters.';

-- ============================================================================
-- CLINICAL MESSAGING
-- ============================================================================

CREATE TABLE clinical_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content
  subject TEXT,
  body TEXT NOT NULL,

  -- Read/archive status (per role)
  read_by_recipient BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  archived_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
  archived_by_recipient BOOLEAN NOT NULL DEFAULT FALSE,

  -- Soft delete (1-hour undo window)
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,

  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_messages_patient ON clinical_messages(patient_id);
CREATE INDEX idx_clinical_messages_sender ON clinical_messages(sender_id);
CREATE INDEX idx_clinical_messages_recipient ON clinical_messages(recipient_id);
CREATE INDEX idx_clinical_messages_created_at ON clinical_messages(created_at DESC);

COMMENT ON TABLE clinical_messages IS 'Bidirectional patient-therapist messaging';
COMMENT ON COLUMN clinical_messages.deleted_at IS 'Soft delete timestamp - allows 1-hour undo window';

-- ============================================================================
-- OFFLINE QUEUE (Server-Side Audit)
-- ============================================================================

CREATE TABLE offline_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Mutation metadata
  mutation_type TEXT NOT NULL CHECK (mutation_type IN ('create_activity_log', 'update_program', 'create_message')),
  mutation_payload JSONB NOT NULL,

  -- Processing status
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX idx_offline_mutations_user ON offline_mutations(user_id);
CREATE INDEX idx_offline_mutations_pending ON offline_mutations(processed_at) WHERE processed_at IS NULL;

COMMENT ON TABLE offline_mutations IS 'Server-side record of offline queue submissions (for debugging/audit only)';
COMMENT ON COLUMN offline_mutations.mutation_type IS 'Type of mutation submitted from offline queue';
COMMENT ON COLUMN offline_mutations.mutation_payload IS 'JSONB payload (minimal use - only for queue reconciliation)';

-- ============================================================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_pattern_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_form_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_guidance ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_program_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_activity_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_activity_set_form_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_mutations ENABLE ROW LEVEL SECURITY;

-- Users: Can only read their own record
CREATE POLICY users_select_own ON users FOR SELECT
  USING (auth_id = auth.uid());

-- Exercises: Public read, admin/therapist write
CREATE POLICY exercises_select_all ON exercises FOR SELECT TO authenticated
  USING (true);

CREATE POLICY exercises_modify_admin ON exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')
  ));

-- Exercise attributes: Public read, admin/therapist write
CREATE POLICY exercise_equipment_select ON exercise_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY exercise_equipment_modify ON exercise_equipment FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')));

CREATE POLICY exercise_muscles_select ON exercise_muscles FOR SELECT TO authenticated USING (true);
CREATE POLICY exercise_muscles_modify ON exercise_muscles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')));

CREATE POLICY exercise_pattern_modifiers_select ON exercise_pattern_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY exercise_pattern_modifiers_modify ON exercise_pattern_modifiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')));

CREATE POLICY exercise_form_parameters_select ON exercise_form_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY exercise_form_parameters_modify ON exercise_form_parameters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')));

CREATE POLICY exercise_guidance_select ON exercise_guidance FOR SELECT TO authenticated USING (true);
CREATE POLICY exercise_guidance_modify ON exercise_guidance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')));

-- Exercise Roles: Public read, admin/therapist write
CREATE POLICY exercise_roles_select_all ON exercise_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY exercise_roles_modify_admin ON exercise_roles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'therapist')
  ));

-- Patient Programs: Patients see own, therapists see their patients'
CREATE POLICY programs_select_own ON patient_programs FOR SELECT TO authenticated
  USING (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'therapist'
        AND patient_programs.patient_id IN (
          SELECT id FROM users WHERE therapist_id = u.id
        )
    )
  );

CREATE POLICY programs_modify_own ON patient_programs FOR ALL TO authenticated
  USING (
    -- Patients can modify their own programs
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Therapists can modify their patients' programs
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'therapist'
        AND patient_programs.patient_id IN (
          SELECT id FROM users WHERE therapist_id = u.id
        )
    )
    -- Admins can modify all programs
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- Program History: Same as programs
CREATE POLICY program_history_select ON patient_program_history FOR SELECT TO authenticated
  USING (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'therapist'
        AND patient_program_history.patient_id IN (
          SELECT id FROM users WHERE therapist_id = u.id
        )
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- Activity Logs: Patients CRUD own, therapists SELECT their patients', admins full access
CREATE POLICY activity_logs_select_own ON patient_activity_logs FOR SELECT TO authenticated
  USING (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'therapist'
        AND patient_activity_logs.patient_id IN (
          SELECT id FROM users WHERE therapist_id = u.id
        )
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY activity_logs_insert_own ON patient_activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Sets: Cascade from activity logs
CREATE POLICY activity_sets_select ON patient_activity_sets FOR SELECT TO authenticated
  USING (
    activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY activity_sets_insert ON patient_activity_sets FOR INSERT TO authenticated
  WITH CHECK (
    activity_log_id IN (
      SELECT id FROM patient_activity_logs
      WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Activity Set Form Data: Cascade from activity sets
CREATE POLICY set_form_data_select ON patient_activity_set_form_data FOR SELECT TO authenticated
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

CREATE POLICY set_form_data_insert ON patient_activity_set_form_data FOR INSERT TO authenticated
  WITH CHECK (
    activity_set_id IN (
      SELECT id FROM patient_activity_sets
      WHERE activity_log_id IN (
        SELECT id FROM patient_activity_logs
        WHERE patient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Clinical Messages: Sender and recipient can read, admins see all
CREATE POLICY messages_select ON clinical_messages FOR SELECT TO authenticated
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY messages_insert ON clinical_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Clinical Messages: Sender and recipient can update their own flags (archive, read)
CREATE POLICY messages_update ON clinical_messages FOR UPDATE TO authenticated
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Clinical Messages: Sender can soft-delete within time window
CREATE POLICY messages_delete ON clinical_messages FOR DELETE TO authenticated
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Offline Mutations: Users manage their own queue, admins see all
CREATE POLICY mutations_own ON offline_mutations FOR ALL TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- VOCABULARY TABLES RLS (see vocab_schema.sql for table definitions)
-- ============================================================================
-- All authenticated users can read vocabularies.
-- Only therapists and admins can modify (insert/update/delete).
-- Policies applied via migration 004_vocab_rls_policies.sql:
--   vocab_region, vocab_capacity, vocab_contribution, vocab_focus,
--   vocab_pt_category, vocab_pattern

-- ============================================================================
-- SOFT DELETE PATTERNS
-- ============================================================================
-- The following tables use soft-delete to preserve data:
--   - exercises: archived=true
--   - exercise_roles: active=false (added via migration)
--   - vocab_*: active=false
--   - clinical_messages: deleted_at, deleted_by columns
-- Hard deletes should be avoided; UI always asks for confirmation.
