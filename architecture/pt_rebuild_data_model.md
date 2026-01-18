# PT Tracker Rebuild — Data Model & Schema

## 1. Source Inputs (Reference Only)
The following sources describe legacy data structures. They are **not valid inputs** for the rebuild runtime and exist only for migration validation, audit comparison, and export/backups:
- Firestore collections (`users/{uid}/activity_logs`, `users/{uid}/pt_runtime/state`, `pt_shared/*`).
- Bundled JSONs (`exercise_library.json`, `exercise_roles.json`, vocab JSONs, schema JSONs).
- Seed/migration utilities (`seed_firestore.html`, `migrate_roles.html`).

JSONs and seeding behavior are **reference-only** and must not be used as live inputs for the new system.

---

## 2. Current Data Entities (Observed)
The rebuild schema is derived from legacy behavior and reference-only artifacts (not runtime inputs). Entities observed:
- **Users / therapist mapping** (`therapistUid` mapping, role-based views).
- **Performed exercise logs**: timestamped exercise entries with exercise identity, performed dosage, notes, and partial completion flags.
- **Performed set entries**: per-set data with reps/time/distance, `manualLog`, `partialRep`, `side`, and `formParams` plus a per-set timestamp.
- **Exercise library**: canonical exercise metadata with muscles, equipment, tags, guidance, lifecycle, pattern modifiers, and lineage.
- **Roles / coverage mapping**: region/capacity/focus/contribution role tuples assigned per exercise.
- **Vocabulary**: term dictionaries for roles and library semantics.
- **Notes**: therapist/patient messaging with read/archive/delete flags (patient + therapist).
- **Runtime snapshot**: local preferences, offline queue, and library cache for offline continuity.
- **PT modifications**: therapist edits and dosage changes batched for client consumption.

---

## 3. Normalized SQL Schema (Rewritten: No Grouping Entities)
**Notes:**
- This schema removes **heatmap tags** and any heatmap-related structures from the rebuild, per product direction.
- JSON columns are allowed only for data that is **not safe or stable** to fully normalize (e.g., form parameters). They must be versioned and validated.
- All time-varying domains are modeled via **version rows with effective timestamps**.
- No grouping entities exist; performed records are timestamped and queried by time windows only.

```sql
-- Users & therapist mapping
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  role TEXT CHECK (role IN ('patient', 'therapist', 'admin')) NOT NULL,
  therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_therapist_id ON users (therapist_id);

-- Device registry for audit + sync
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_label TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- Controlled vocabularies (versionable)
CREATE TABLE vocabularies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_type TEXT CHECK (vocab_type IN ('roles', 'library', 'tags')) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uniq_vocabularies ON vocabularies (vocab_type, name);

CREATE TABLE vocab_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  UNIQUE (vocabulary_id, term, effective_from)
);

-- Exercise library (stable ID + versioned definitions)
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ,
  superseded_by TEXT REFERENCES exercises(id),
  superseded_at TIMESTAMPTZ
);

CREATE TABLE exercise_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  description TEXT,
  cues TEXT,
  pattern TEXT CHECK (pattern IN ('left', 'right', 'bilateral', 'both')) NOT NULL,
  pattern_modifiers TEXT[] DEFAULT '{}',
  lifecycle_status TEXT CHECK (lifecycle_status IN ('active', 'archived', 'deprecated')) NOT NULL,
  lifecycle_note TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (exercise_id, effective_from)
);
CREATE INDEX idx_exercise_definitions_exercise_id ON exercise_definitions (exercise_id);

CREATE TABLE exercise_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source TEXT,
  UNIQUE (exercise_id, alias)
);

CREATE TABLE exercise_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  equipment TEXT NOT NULL,
  requirement TEXT CHECK (requirement IN ('required', 'optional')) NOT NULL
);

CREATE TABLE exercise_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE RESTRICT,
  term TEXT NOT NULL,
  tag_type TEXT CHECK (tag_type IN ('functional', 'format', 'custom')) NOT NULL,
  UNIQUE (exercise_id, vocabulary_id, term)
);

CREATE TABLE exercise_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  guidance_type TEXT CHECK (guidance_type IN ('external_cues', 'motor_cues', 'compensation_warnings', 'safety_flags')) NOT NULL,
  guidance_text TEXT NOT NULL
);

CREATE TABLE exercise_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'gif', 'audio', 'pdf')) NOT NULL,
  uri TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exercise_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  supersedes_exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  reason TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ
);
CREATE UNIQUE INDEX uniq_exercise_lineage ON exercise_lineage (exercise_id, supersedes_exercise_id, effective_from);

-- Roles / coverage vocabulary (versionable)
CREATE TABLE role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  capacity TEXT NOT NULL,
  focus TEXT,
  contribution_level TEXT CHECK (contribution_level IN ('high', 'medium', 'low')) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uniq_role_definitions ON role_definitions(region, capacity, focus, contribution_level, effective_from);

CREATE TABLE exercise_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  role_definition_id UUID REFERENCES role_definitions(id) ON DELETE CASCADE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (exercise_id, role_definition_id, effective_from)
);
CREATE INDEX idx_exercise_role_mappings_exercise_id ON exercise_role_mappings (exercise_id);

-- Prescribed dosage (plan) with explicit effectivity
CREATE TABLE dosage_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'archived')) NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uniq_dosage_plans ON dosage_plans (patient_id, exercise_id);

CREATE TABLE dosage_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES dosage_plans(id) ON DELETE CASCADE,
  exercise_type TEXT CHECK (exercise_type IN ('reps', 'timed', 'hold', 'duration', 'amrap', 'distance')) NOT NULL,
  target_sets INTEGER CHECK (target_sets >= 0),
  target_reps INTEGER CHECK (target_reps >= 0),
  target_duration_seconds INTEGER CHECK (target_duration_seconds >= 0),
  target_hold_seconds INTEGER CHECK (target_hold_seconds >= 0),
  target_distance INTEGER CHECK (target_distance >= 0),
  target_load DECIMAL(8,2) CHECK (target_load >= 0),
  notes TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (plan_id, effective_from)
);
CREATE INDEX idx_dosage_plan_versions_plan ON dosage_plan_versions (plan_id);

-- Performed exercise log (timestamped, no grouping entity)
CREATE TABLE performed_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  exercise_name TEXT NOT NULL CHECK (length(trim(exercise_name)) > 0),
  exercise_type TEXT CHECK (exercise_type IN ('reps', 'timed', 'hold', 'duration', 'amrap', 'distance')) NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL,
  partial_completion BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_performed_exercises_patient_date ON performed_exercises (patient_id, performed_at);
CREATE INDEX idx_performed_exercises_exercise ON performed_exercises (exercise_id);

CREATE TABLE performed_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_exercise_id UUID REFERENCES performed_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number >= 1),
  reps INTEGER CHECK (reps >= 0),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  hold_seconds INTEGER CHECK (hold_seconds >= 0),
  distance_feet INTEGER CHECK (distance_feet >= 0),
  load DECIMAL(8,2) CHECK (load >= 0),
  manual_log BOOLEAN DEFAULT false,
  partial_rep BOOLEAN DEFAULT false,
  side TEXT CHECK (side IN ('left', 'right', 'bilateral', 'both')),
  form_params JSONB,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_performed_sets_performed_exercise_id ON performed_sets (performed_exercise_id);

-- Notes / messaging
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT CHECK (created_by IN ('patient', 'therapist')) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_by_patient BOOLEAN DEFAULT false,
  read_by_therapist BOOLEAN DEFAULT false,
  archived_by_patient BOOLEAN DEFAULT false,
  archived_by_therapist BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT CHECK (deleted_by IN ('patient', 'therapist'))
);
CREATE INDEX idx_notes_patient ON notes (patient_id, created_at DESC);

-- Mutation receipts (idempotency ledger)
CREATE TABLE mutation_receipts (
  mutation_id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'rejected', 'conflict')),
  received_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log (required for clinical traceability)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Schema-Level Invariants (Must Enforce)
- **Non-negative clinical counts**: reps, sets, duration seconds, hold seconds, distances, and load must be ≥ 0.
- **Set cardinality**: performed set entries require `set_number >= 1` and belong to a valid performed exercise record.
- **Exercise linkage**: performed records must retain `exercise_name` and a valid `exercise_id` (archived/superseded if retired).
- **Exercise type validity**: `exercise_type` must be in the canonical set (`reps`, `timed`, `hold`, `duration`, `amrap`, `distance`).
- **Role uniqueness**: role definitions are unique per taxonomy and effective time window.
- **Dosage plan uniqueness**: a patient must not have multiple active plans for the same exercise.
- **Dosage version replacement**: when a new dosage plan version is created, the prior version must be closed by setting `effective_to` (no overlapping effective ranges).
- **Soft deletion only**: performed records and notes are soft-deleted with `deleted_at` and remain recoverable in audit logs.
- **Mutation idempotency**: mutation receipts are persisted and keyed by `mutation_id` (UUID) with device/user references.

---

## 5. Field Mapping Notes (Legacy → SQL)
- **Exercise lineage** (`supersedes`, `superseded_by`, `superseded_date`) maps to `exercise_lineage` with effective timestamps, and the current exercise row is archived via `archived_at` with `superseded_by` when applicable.
- **Pattern modifiers** (e.g., duration/hold) remain `pattern_modifiers[]` in `exercise_definitions`.
- **Heatmap tags are excluded** from the rebuild schema, even if present in legacy JSON.
- **Legacy runtime dosage** maps to `dosage_plans` + `dosage_plan_versions` using effective ranges.

---

## 6. Core Queries This Schema Supports
1. **What exercises did I do on date D?** Filter `performed_exercises` by `performed_at` within date D’s time window for the patient.
2. **What was the prescribed dosage on date D for exercise X?** Join `dosage_plans` and `dosage_plan_versions` where `effective_from <= D < effective_to` for patient + exercise.
3. **What did I actually do vs prescribed on date D?** Compare `performed_exercises` + `performed_sets` within date D to the matching `dosage_plan_versions`.
4. **When did roles mapping for exercise X change?** Query `exercise_role_mappings` for the exercise ordered by `effective_from` and `effective_to`.
