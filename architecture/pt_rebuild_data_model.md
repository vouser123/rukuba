# PT Tracker Rebuild — Data Model & Schema

## 1. Source Inputs (Reference Only)
The following sources describe legacy data structures. They are **not valid inputs** for the rebuild runtime and exist only for migration validation, audit comparison, and export/backups:
- Firestore collections (`users/{uid}/sessions`, `users/{uid}/pt_runtime/state`, `pt_shared/*`).
- Bundled JSONs (`exercise_library.json`, `exercise_roles.json`, vocab JSONs, schema JSONs).
- Seed/migration utilities (`seed_firestore.html`, `migrate_roles.html`).

JSONs and seeding behavior are **reference-only** and must not be used as live inputs for the new system.

---

## 2. Current Data Entities (Observed)
The rebuild schema is derived from current app usage in the HTML/JS code and shared data docs. Entities observed:
- **Users / therapist mapping** (`therapistUid` mapping, role-based views).
- **Sessions**: exercise sessions with `sessionId`, `exerciseId`, `exerciseName`, `exerciseType`, timestamps, notes, and exercise specs (sets/reps/time/distance).
- **Sets**: per-set data with reps/time/distance, `manualLog`, `partialRep`, `side`, and `formParams` plus a per-set timestamp.
- **Exercise library**: canonical exercise metadata with muscles, equipment, tags, guidance, lifecycle, pattern modifiers, and lineage.
- **Roles / coverage mapping**: region/capacity/focus/contribution role tuples assigned per exercise.
- **Vocabulary**: term dictionaries for roles and library semantics.
- **Notes**: therapist/patient messaging with read/archive/delete flags (patient + therapist).
- **Runtime snapshot**: local preferences, session recovery, offline queue, and library cache for offline continuity.
- **PT modifications**: therapist edits and dosage changes batched for client consumption.

---

## 3. Normalized SQL Schema (Updated)
**Notes:**
- This schema removes **heatmap tags** and any heatmap-related structures from the rebuild, per product direction.
- JSON columns are allowed only for data that is **not safe or stable** to fully normalize (e.g., exercise specs or form params). They must be versioned and validated.
- All tables that store mutable clinical data must include audit hooks (see §4).

```sql
-- Users & Roles
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

-- Optional device registry for audit + sync
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_label TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- Exercise library (shared)
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  pt_category TEXT,
  description TEXT,
  pattern TEXT CHECK (pattern IN ('side', 'both')),
  pattern_modifiers TEXT[] DEFAULT '{}',
  lifecycle_status TEXT CHECK (lifecycle_status IN ('active', 'archived', 'deprecated')),
  lifecycle_start DATE,
  lifecycle_end DATE,
  added_date DATE,
  updated_date DATE,
  superseded_by TEXT REFERENCES exercises(id),
  superseded_date DATE
);

CREATE TABLE exercise_supersedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  supersedes_exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uniq_exercise_supersedes ON exercise_supersedes (exercise_id, supersedes_exercise_id);

CREATE TABLE exercise_muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  muscle TEXT NOT NULL,
  role TEXT CHECK (role IN ('primary', 'secondary')) NOT NULL
);
CREATE INDEX idx_exercise_muscles_exercise_id ON exercise_muscles (exercise_id);

CREATE TABLE exercise_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  equipment TEXT NOT NULL,
  requirement TEXT CHECK (requirement IN ('required', 'optional')) NOT NULL
);

CREATE TABLE exercise_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_type TEXT CHECK (tag_type IN ('functional', 'format')) NOT NULL
);

CREATE TABLE exercise_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  guidance_type TEXT CHECK (guidance_type IN ('external_cues', 'motor_cues', 'compensation_warnings', 'safety_flags')) NOT NULL,
  guidance_text TEXT NOT NULL
);

CREATE TABLE exercise_form_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  param_name TEXT NOT NULL
);

-- Roles / coverage
CREATE TABLE role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  capacity TEXT NOT NULL,
  focus TEXT,
  contribution TEXT
);
CREATE UNIQUE INDEX uniq_role_definitions ON role_definitions(region, capacity, focus, contribution);

CREATE TABLE exercise_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  role_id UUID REFERENCES role_definitions(id) ON DELETE CASCADE
);
CREATE INDEX idx_exercise_roles_exercise_id ON exercise_roles (exercise_id);

-- Vocabulary / terminology
CREATE TABLE vocab_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_type TEXT CHECK (vocab_type IN ('roles', 'library')) NOT NULL,
  category TEXT NOT NULL,
  term TEXT NOT NULL,
  definition TEXT,
  UNIQUE (vocab_type, category, term)
);

-- Patient program (per-user overrides & dosage)
CREATE TABLE patient_exercise_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  exercise_type TEXT CHECK (exercise_type IN ('reps', 'timed', 'hold', 'duration', 'amrap', 'distance')),
  current_sets INTEGER CHECK (current_sets >= 0),
  current_reps INTEGER CHECK (current_reps >= 0),
  seconds_per_rep INTEGER CHECK (seconds_per_rep >= 0),
  distance_target INTEGER CHECK (distance_target >= 0),
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_patient_exercise_assignments_patient ON patient_exercise_assignments (patient_id);

CREATE TABLE exercise_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES patient_exercise_assignments(id) ON DELETE CASCADE,
  summary TEXT,
  previous JSONB,
  next JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uid TEXT,
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT,
  exercise_type TEXT,
  performed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  exercise_spec JSONB,
  client_created_at TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sessions_patient_date ON sessions (patient_id, performed_at);
CREATE INDEX idx_sessions_exercise ON sessions (exercise_id);

CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number >= 1),
  reps INTEGER CHECK (reps >= 0),
  seconds_achieved INTEGER CHECK (seconds_achieved >= 0),
  seconds_target INTEGER CHECK (seconds_target >= 0),
  distance_feet INTEGER CHECK (distance_feet >= 0),
  manual_log BOOLEAN DEFAULT false,
  partial_rep BOOLEAN DEFAULT false,
  side TEXT,
  form_params JSONB,
  logged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_session_sets_session_id ON session_sets (session_id);

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

-- Runtime / preferences snapshot (advisory only)
CREATE TABLE patient_runtime_state (
  patient_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  preferences JSONB,
  session_recovery JSONB,
  offline_queue JSONB,
  pt_data_version TEXT,
  last_server_sync_at TIMESTAMPTZ
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
- **Non-negative clinical counts**: reps, sets, seconds, and distances must be ≥ 0.
- **Set cardinality**: session sets require `set_number >= 1` and belong to a valid session.
- **Exercise linkage**: sessions should retain `exercise_name` even if `exercise_id` is unknown, but must not be empty.
- **Role uniqueness**: role definitions are unique across `(region, capacity, focus, contribution)`.
- **Soft deletion only**: sessions and notes are soft-deleted with `deleted_at` and must remain recoverable in audit logs.

---

## 5. Field Mapping Notes (Legacy → SQL)
- **Exercise lineage** (`supersedes`, `superseded_by`, `superseded_date`) must be preserved for audit and conversion integrity.
- **Pattern modifiers** (e.g., duration/hold) must be kept as `pattern_modifiers[]` and used to interpret dosage UI.
- **Heatmap tags are excluded** from the rebuild schema, even if present in legacy JSON.
- **Runtime exercise dosage** (`current`/`history` in legacy runtime library) maps to `patient_exercise_assignments` and `exercise_assignment_history`.
