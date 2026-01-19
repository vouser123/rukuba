-- ============================================================================
-- VOCABULARY TABLES - Definitions for controlled vocabularies
-- ============================================================================
-- These replace CHECK constraints with editable vocabulary tables
-- Frontend can read definitions and therapists can edit them
-- ============================================================================

-- Region vocabulary (anatomical regions)
CREATE TABLE vocab_region (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_region IS 'Anatomical regions for exercise roles';

INSERT INTO vocab_region (code, definition, sort_order) VALUES
  ('core', 'Trunk region; deficits present as trunk force, control, or endurance limits.', 1),
  ('back', 'Posterior trunk region; deficits present as spinal extensor force, control, or tolerance limits.', 2),
  ('hip', 'Hip region; deficits present as hip force production or femoral control limits.', 3),
  ('knee', 'Knee region; deficits present as knee force control or tolerance limits.', 4),
  ('ankle', 'Ankle region; deficits present as distal control, force, or balance limits.', 5),
  ('foot', 'Foot region; deficits present as intrinsic or toe-related control or force limits.', 6),
  ('shoulder', 'Shoulder girdle; deficits present as scapular or glenohumeral control or force limits.', 7),
  ('vestibular', 'Vestibular system contribution; deficits present as impaired gaze stability, balance integration, or motion tolerance.', 8);

-- ============================================================================

-- Capacity vocabulary (functional capacities)
CREATE TABLE vocab_capacity (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_capacity IS 'Functional capacities addressed by exercises';

INSERT INTO vocab_capacity (code, definition, sort_order) VALUES
  ('strength', 'Ability to generate force. Failure looks like inability to hold, lift, or resist load.', 1),
  ('control', 'Ability to maintain alignment while joints move. Failure looks like loss of alignment, sequencing, or timing.', 2),
  ('stability', 'Ability to maintain position under asymmetry, perturbation, or unstable support. Failure looks like wobble, loss of balance, or giving way.', 3),
  ('tolerance', 'Ability to sustain effort or posture over time. Failure looks like fatigue or symptom onset before form loss.', 4),
  ('mobility', 'Ability to access and control available range of motion.', 5);

-- ============================================================================

-- Contribution vocabulary (exercise contribution level)
CREATE TABLE vocab_contribution (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_contribution IS 'Exercise contribution levels for roles';

INSERT INTO vocab_contribution (code, definition, sort_order) VALUES
  ('high', 'This exercise independently builds this capacity.', 3),
  ('medium', 'This exercise meaningfully contributes but is not sufficient alone.', 2),
  ('low', 'This exercise supports or touches this capacity.', 1);

-- ============================================================================

-- Focus vocabulary (specific focuses within capacities)
CREATE TABLE vocab_focus (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_focus IS 'Specific focuses within capacity categories';

INSERT INTO vocab_focus (code, definition, sort_order) VALUES
  ('sagittal', 'Front/back spinal alignment (anti-extension / anti-flexion).', 1),
  ('lateral', 'Side-to-side control.', 2),
  ('anti_rotation', 'Resisting twist.', 3),
  ('dynamic', 'Capacity expressed while limbs move.', 4),
  ('static', 'Capacity expressed while holding still.', 5),
  ('eccentric', 'Controlled lowering.', 6),
  ('great_toe', 'Big toe specifically.', 7),
  ('intrinsics', 'Foot intrinsic muscles.', 8);

-- ============================================================================

-- PT Category vocabulary
CREATE TABLE vocab_pt_category (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_pt_category IS 'PT categories for exercise classification';

INSERT INTO vocab_pt_category (code, definition, sort_order) VALUES
  ('back_sij', 'Lumbar spine, pelvis, or SIJ-focused exercises.', 1),
  ('hip', 'Hip-focused strength/control/stability exercises.', 2),
  ('knee', 'Knee-focused strength/control/tolerance exercises.', 3),
  ('ankle', 'Ankle-focused strength/control/mobility/tolerance exercises.', 4),
  ('foot', 'Foot-focused intrinsic strength/control/tolerance exercises.', 5),
  ('shoulder', 'Shoulder-focused strength/control/stability exercises.', 6),
  ('vestibular', 'Balance/vestibular system emphasis (gaze stabilization, habituation, sensory integration).', 7),
  ('other', 'Does not fit a single primary category.', 8);

-- ============================================================================

-- Pattern vocabulary
CREATE TABLE vocab_pattern (
  code TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  dosage_semantics TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vocab_pattern IS 'Exercise execution patterns (side vs both)';

INSERT INTO vocab_pattern (code, definition, dosage_semantics, sort_order) VALUES
  ('side', 'Unilateral dosage. Sets and reps are prescribed per side.', 'NxM means N sets of M repetitions on EACH side (left and right).', 1),
  ('both', 'Bilateral dosage. Sets and reps are performed with both sides simultaneously.', 'NxM means N sets of M repetitions total, not per side.', 2);

-- ============================================================================

-- Create /api/vocab endpoint to serve all vocabularies
COMMENT ON TABLE vocab_region IS 'Vocabularies are mutable. Frontend fetches from /api/vocab';
COMMENT ON TABLE vocab_capacity IS 'Therapist can edit definitions via vocab editor';
COMMENT ON TABLE vocab_contribution IS 'Original from exercise_roles_vocabulary.json';
COMMENT ON TABLE vocab_focus IS 'Focus values can be added/edited by therapist';
