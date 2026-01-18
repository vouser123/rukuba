# PT Tracker Rebuild Specification (Firestore → SQL)

## 0. Executive Summary
The PT Tracker PWA currently runs as a Firebase-authenticated, Firestore-backed offline-first web app. Its data model is centered on **user sessions**, **exercise library metadata**, **exercise roles/vocabulary**, and **runtime snapshots** (preferences, recovery, and queue state). Firestore collections include `users/{uid}/sessions`, `users/{uid}/pt_runtime/state`, and shared documents under `pt_shared/*` for exercises, roles, vocab, and schemas.【F:pt/docs/DEVELOPMENT.md†L124-L158】 The rebuild should preserve these behaviors while migrating to a normalized SQL schema and a clean API layer that supports offline sync, role-based access, and patient/therapist collaboration.

---

## 1. Data Model Analysis

### 1.1 Firestore Collections & Document Structures (Current)
**User-scoped collections**
- `users/{uid}/sessions`: authoritative session history for authenticated users.【F:pt/docs/DEVELOPMENT.md†L124-L142】
- `users/{uid}/pt_runtime/state`: runtime snapshot that contains exercise library cache, preferences, session recovery, offline queue, and version metadata.【F:pt/docs/DEVELOPMENT.md†L124-L158】【F:pt/pt_tracker.html†L2171-L2244】
- `users/{uid}/notes`: therapist/patient messaging and read-state tracking, created with fields like `text`, `createdBy`, `createdAt`, `authorUid`, `readByPatient`, `readByTherapist`, `archivedByTherapist`, `deleted`, `deletedAt`, `deletedBy`.【F:pt/pt_view.html†L522-L683】

**Shared collections**
- `pt_shared/{docId}`: shared global data documents for library, roles, vocab, and schemas; doc IDs include `exercise_library`, `exercise_roles`, `exercise_roles_vocabulary`, `exercise_library_vocabulary`, `exercise_file_schema`, `exercise_roles_schema`.【F:pt/docs/DEVELOPMENT.md†L124-L136】【F:pt/shared/firestore_shared_data.js†L8-L17】

**User documents**
- `users` collection documents appear to store a `therapistUid` to link a patient to a therapist account; flows query for users where `therapistUid == currentUser.uid` to discover patient accounts.【F:pt/pt_report.html†L918-L952】【F:pt/pt_view.html†L403-L418】

### 1.2 Data Entities (Current)
1. **User / Patient**
   - Firestore doc under `users` with optional `therapistUid` to map patient to therapist account.【F:pt/pt_report.html†L938-L952】
2. **Session** (workout entry)
   - Stored in `users/{uid}/sessions` and built from tracker state: `sessionId`, `exerciseId`, `exerciseName`, `exerciseType`, `date`, `notes`, `exerciseSpec { sets, repsPerSet, secondsPerRep, type }`, and `sets` (logged set data).【F:pt/pt_tracker.html†L5171-L5186】
3. **Set (sessionData)**
   - Each set includes `set`, `reps`, `timestamp`, and possibly `secondsAchieved`, `secondsTarget`, `distanceFeet`, `manualLog`, `partialRep`, `side`, and `formParams` (by side).【F:pt/pt_tracker.html†L4041-L4056】【F:pt/pt_tracker.html†L5139-L5144】
4. **Exercise Library (shared + per-user runtime copy)**
   - Normalized in shared loader with fields such as `id`, `canonical_name`, `pt_category`, `description`, `primary_muscles`, `secondary_muscles`, `pattern`, `pattern_modifiers`, `equipment`, `form_parameters_required`, `tags`, and `guidance` plus lifecycle metadata.【F:pt/shared/firestore_shared_data.js†L75-L140】
5. **Exercise Roles**
   - `exercise_roles` document maps exercise IDs to `roles` entries of `{ region, capacity, focus, contribution }` and a human name for the exercise; schema-driven vocab is derived from `schema/exercise_roles.schema.json` and used for dynamic enums.【F:pt/docs/DEVELOPMENT.md†L181-L209】
6. **Vocabulary**
   - `exercise_roles_vocabulary` and `exercise_library_vocabulary` hold term definitions used for display and editing.【F:pt/shared/firestore_shared_data.js†L10-L17】
7. **PT Modifications** (Therapist edits)
   - `pt_runtime/state` includes `pt_modifications` with keys `newExercises`, `editedExercises`, `archivedExercises`, `newRoles`, `deletedRoles`, `editedRoles`, `dosageChanges`, `updatedVocab` for synchronization to the tracker app.【F:pt/pt_report.html†L1341-L1363】【F:pt/pt_report.html†L1556-L1566】
8. **Runtime Snapshot**
   - `pt_runtime/state` stores `updatedAt`, `sessionHistory` (legacy), `sessionRecovery`, `preferences`, `offlineQueue`, `exerciseLibrary`, `ptDataVersion` to facilitate offline state recovery and sync.【F:pt/pt_tracker.html†L2171-L2190】
9. **PT Payloads (V2 export/import)**
   - V2 payload blocks exist for `PT_DATA` and `PT_MODIFICATIONS`, gzip/base64 encoded with SHA-256 checksums.【F:pt/pt_payload_utils.js†L1-L141】

### 1.3 Relationships (Current)
- **User ↔ Therapist**: Patient user document references `therapistUid`; therapist apps discover associated patients via query on `users` collection.【F:pt/pt_report.html†L938-L952】【F:pt/pt_view.html†L403-L418】
- **User → Sessions**: `users/{uid}/sessions` is authoritative history for each user; sessions include sets and exercise details.【F:pt/pt_tracker.html†L5171-L5198】
- **User → Runtime State**: `users/{uid}/pt_runtime/state` caches library, preferences, queue, and modifications for sync.【F:pt/pt_tracker.html†L2171-L2244】
- **Shared Data → User Runtime**: PT report writes updated library and modifications into runtime; tracker applies modifications and merges shared exercise library as needed.【F:pt/pt_report.html†L1341-L1363】【F:pt/pt_tracker.html†L2251-L2260】
- **User → Notes**: notes are stored per user and shared across therapist/patient with read/archive/delete flags.【F:pt/pt_view.html†L522-L683】

### 1.4 Proposed Normalized SQL Schema (Postgres/Supabase or SQLite)
> **Goals:** normalize shared exercise data, allow per-patient program overrides/dosage, support sessions + sets, and enable patient/therapist messaging.

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

-- Exercise library (shared)
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  pt_category TEXT,
  description TEXT,
  pattern TEXT,
  added_date DATE,
  updated_date DATE,
  lifecycle_status TEXT,
  lifecycle_start DATE,
  lifecycle_end DATE
);

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
  tag_type TEXT CHECK (tag_type IN ('functional', 'format', 'heatmap')) NOT NULL
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
  current_sets INTEGER,
  current_reps INTEGER,
  seconds_per_rep INTEGER,
  distance_target INTEGER,
  notes TEXT,
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
  session_uid TEXT, -- maps to sessionId in tracker
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT,
  exercise_type TEXT,
  performed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  exercise_spec JSONB
);
CREATE INDEX idx_sessions_patient_date ON sessions (patient_id, performed_at);
CREATE INDEX idx_sessions_exercise ON sessions (exercise_id);

CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  seconds_achieved INTEGER,
  seconds_target INTEGER,
  distance_feet INTEGER,
  manual_log BOOLEAN DEFAULT false,
  partial_rep BOOLEAN DEFAULT false,
  side TEXT,
  form_params JSONB,
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
  archived_by_therapist BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);
CREATE INDEX idx_notes_patient ON notes (patient_id, created_at DESC);

-- Runtime / preferences
CREATE TABLE patient_runtime_state (
  patient_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  preferences JSONB,
  session_recovery JSONB,
  offline_queue JSONB,
  pt_data_version TEXT
);
```

---

## 2. Feature Inventory (Current)

### 2.1 `pt_tracker.html` (Patient Tracker)
Core tracker and PWA experience.
- **Authentication & role detection**: Firebase email/password auth; runtime sync only when authenticated; local storage fallback and runtime snapshots sync to `pt_runtime/state`.【F:pt/pt_tracker.html†L2171-L2244】
- **Exercise session tracking**: record exercises with session details, including `sessionId`, `exerciseId`, `exerciseName`, `exerciseType`, timestamps, notes, exercise specs, and sets.【F:pt/pt_tracker.html†L5171-L5186】
- **Set logging**: automatic/timed rep tracking, manual log with set data fields such as `secondsAchieved`, `secondsTarget`, `distanceFeet`, `manualLog`, `side`, `formParams`, `partialRep`.【F:pt/pt_tracker.html†L4041-L4056】【F:pt/pt_tracker.html†L5139-L5144】
- **Session history & real-time sync**: listens to Firestore session history changes with `onSnapshot`, merges with local queue, dedupes, and updates UI/streaks.【F:pt/pt_tracker.html†L2567-L2642】
- **Runtime snapshot sync**: serializes session history, recovery, preferences, and offline queue into runtime state for cross-device continuity.【F:pt/pt_tracker.html†L2171-L2190】
- **Shared exercise library**: loads from `pt_shared` with JSON fallback and local caching (via shared loader).【F:pt/shared/firestore_shared_data.js†L8-L73】
- **Program modifications**: applies therapist modifications (`pt_modifications`) from runtime state to update library, roles, dosage, and vocabulary.【F:pt/pt_tracker.html†L2251-L2260】
- **Export/import**: uses V2 payloads for PT data and modifications (gzip/base64 blocks).【F:pt/pt_payload_utils.js†L1-L141】
- **Session planning & progress views**: session plan list, all-sessions grouping by `sessionId`, charts, weekly stats, streaks, and adherence UI (logic driven by session history data).【F:pt/pt_tracker.html†L5171-L5186】

### 2.2 `pt_report.html` (Therapist Report & Editor)
- **Auth + role detection**: detects therapist vs patient by looking up `users` where `therapistUid == currentUser.uid`; loads patient data accordingly.【F:pt/pt_report.html†L918-L955】
- **Exercise library editor**: edits canonical exercise fields and metadata (category, muscles, equipment, tags, guidance, lifecycle).【F:pt/pt_report.html†L1568-L1604】
- **Program modifications tracking**: accumulates modifications in `pt_modifications` for new exercises, edits, archives, roles, dosage changes, vocabulary updates, etc.【F:pt/pt_report.html†L1556-L1566】
- **Push updates to runtime state**: saves updated exercise library and `pt_modifications` to `users/{uid}/pt_runtime/state` with timestamps/version metadata.【F:pt/pt_report.html†L1341-L1363】
- **Notes workflow**: therapist sends and reviews patient notes, marks read states (patient/therapist).【F:pt/pt_report.html†L1370-L1380】【F:pt/pt_view.html†L522-L683】
- **PT_DATA / PT_MODIFICATIONS export/import**: uses V2 payload format for sending data via email or copy/paste workflows.【F:pt/pt_payload_utils.js†L1-L141】

### 2.3 `rehab_coverage.html` (Coverage Analysis)
- **Auth + role detection**: detects therapist vs patient and routes back button appropriately (report vs tracker).【F:pt/rehab_coverage.html†L1183-L1216】
- **Realtime session subscription**: live `onSnapshot` on patient sessions for coverage calculations and updates.【F:pt/rehab_coverage.html†L1218-L1234】
- **Coverage visualization**: regions/capacities/focus mapped from role definitions and exercise history (accordion UI).【F:pt/docs/DEVELOPMENT.md†L181-L209】

### 2.4 `pt_view.html` (Patient Dashboard)
- **Auth + role detection**: discovers patient account by therapist mapping and loads session history and runtime library.【F:pt/pt_view.html†L394-L458】
- **Dashboard stats**: total sessions, active exercises, week activity, total sets, recent activity, top exercises (computed from sessions).【F:pt/pt_view.html†L438-L458】
- **Notes inbox**: threaded notes with read status, hide/delete/undo actions, last-read tracking, and badges for new notes.【F:pt/pt_view.html†L522-L720】

### 2.5 Other In-Use Pages / Tools
- **`seed_firestore.html`**: admin tool for seeding `pt_shared/*` from bundled JSON and migrating shared dosage into runtime state.【F:pt/seed_firestore.html†L1-L112】
- **`migrate_roles.html`**: admin/debug tool for migrating role updates from runtime modifications into `pt_shared/exercise_roles` (visible in usage flows and debug panel).【F:pt/migrate_roles.html†L1-L120】
- **`sw-pt.js`**: service worker caches key HTML, JSON, and shared modules; network-first HTML/JSON with offline fallbacks and cache-first for assets.【F:pt/sw-pt.js†L1-L108】
- **`manifest-pt.json`**: PWA manifest with standalone display, start URL, theme colors, and maskable icons.【F:pt/manifest-pt.json†L1-L21】

---

## 3. API Requirements

### 3.1 CRUD Operations (by feature)
| Feature | Operations | Notes |
| --- | --- | --- |
| Users & therapist mapping | Create/update user, assign therapist, list patients | supports patient/therapist linking.
| Exercise library (shared) | Read shared exercises, tags, guidance, equipment; admin create/update | shared across all users.
| Patient program | CRUD assignments/dosage/archival for each patient | per-user overrides and dosage tracking.
| Sessions & sets | Create session + sets, list sessions (filter/date), update notes | core tracker flow.
| Notes | Create, list, mark read, archive/delete/undo | therapist/patient messaging.
| Roles & vocab | Read role definitions; admin update roles/vocab | coverage and editor features.
| Runtime state | Store/retrieve preferences, recovery, offline queue | offline sync restoration.
| Imports/exports | Accept PT_DATA/PT_MODIFICATIONS payloads | support V2 blocks.

### 3.2 Proposed API Endpoints (REST or RPC)
```http
# Auth / Users
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
GET    /api/therapists/:id/patients
PATCH  /api/patients/:id/therapist

# Shared Exercise Library
GET    /api/exercises
GET    /api/exercises/:id
POST   /api/exercises           # admin/editor
PATCH  /api/exercises/:id        # admin/editor
GET    /api/exercises/:id/roles

# Patient Program
GET    /api/patients/:id/program
POST   /api/patients/:id/program
PATCH  /api/patients/:id/program/:assignmentId
DELETE /api/patients/:id/program/:assignmentId

# Sessions & Sets
GET    /api/patients/:id/sessions?since=&until=
POST   /api/patients/:id/sessions
PATCH  /api/patients/:id/sessions/:sessionId
DELETE /api/patients/:id/sessions/:sessionId

# Notes
GET    /api/patients/:id/notes
POST   /api/patients/:id/notes
PATCH  /api/patients/:id/notes/:noteId

# Roles & Vocabulary
GET    /api/roles
POST   /api/roles               # admin/editor
GET    /api/vocab?type=roles|library
POST   /api/vocab               # admin/editor

# Runtime
GET    /api/patients/:id/runtime
PUT    /api/patients/:id/runtime

# Import/Export
POST   /api/import/pt-data
POST   /api/import/pt-modifications
GET    /api/export/pt-data
GET    /api/export/pt-modifications
```

### 3.3 Data Flows & Real-Time Sync
- **Sessions real-time updates**: Tracker and coverage view subscribe to session history via Firestore `onSnapshot` (real-time updates). The rebuild should support realtime subscriptions for sessions or use polling + sync tokens for offline mode.【F:pt/pt_tracker.html†L2567-L2642】【F:pt/rehab_coverage.html†L1218-L1234】
- **Runtime state updates**: tracker periodically writes runtime snapshots for offline recovery; an equivalent `runtime` endpoint should support conditional updates (updated_at) and client-merges.【F:pt/pt_tracker.html†L2171-L2244】
- **Notes updates**: therapist/patient notes include read-state updates and “undo send” flows; need immediate updates and read receipts in the UI.【F:pt/pt_view.html†L522-L720】

---

## 4. Technical Architecture

### 4.1 Current Stack
- **Client**: Static PWA with service worker caching HTML/JSON, network-first strategy for HTML/JSON and cache-first for assets.【F:pt/sw-pt.js†L1-L108】
- **Offline**: Firestore IndexedDB persistence + localStorage fallback (`pt_runtime/state` snapshots, queues, etc.).【F:pt/pt_tracker.html†L2171-L2244】
- **Auth**: Firebase email/password; role derived via `users` collection and `therapistUid` mapping.【F:pt/pt_report.html†L918-L952】
- **Data**: Firestore `users/{uid}/sessions`, `users/{uid}/pt_runtime/state`, `pt_shared/*` for shared datasets.【F:pt/docs/DEVELOPMENT.md†L124-L136】

### 4.2 Proposed Stack
1. **Backend API**
   - REST or GraphQL with RPC-style endpoints for sessions, notes, program assignments, and library management.
   - Use **Supabase Postgres** (recommended) or SQLite + API layer (for single-tenant/local deployment).
2. **Auth Strategy**
   - Supabase Auth (JWT) or custom auth with sessions.
   - Patient/therapist roles stored in `users.role`; patient links to therapist via `therapist_id`.
3. **Offline Sync**
   - Replace Firestore offline persistence with:
     - `service worker` caching and a local IndexedDB store (Dexie/SQLite WASM) for session drafts.
     - A sync queue (e.g., background sync or app-level queue) to POST updates when online.
4. **PWA Requirements**
   - Maintain `manifest-pt.json` metadata (start URL, standalone display, icons).【F:pt/manifest-pt.json†L1-L21】
   - Maintain caching of core HTML + JSON data for offline boot and fast start time.【F:pt/sw-pt.js†L1-L108】
   - Install prompt for add-to-home-screen, offline UI messaging, and data conflict UX.

---

## 5. Data Migration Plan (Firebase → SQL)

### 5.1 Mapping: Firestore → SQL
| Firestore path | SQL destination | Notes |
| --- | --- | --- |
| `users/{uid}` | `users` | `therapistUid` → `therapist_id` relationship.
| `users/{uid}/sessions` | `sessions`, `session_sets` | Split session header + sets; map `sessionId` to `session_uid`.
| `users/{uid}/pt_runtime/state.exerciseLibrary` | `patient_exercise_assignments` | Normalize dosage and per-patient overrides.
| `users/{uid}/pt_runtime/state.preferences` | `patient_runtime_state.preferences` | JSON payload.
| `users/{uid}/pt_runtime/state.sessionRecovery` | `patient_runtime_state.session_recovery` | JSON payload.
| `pt_shared/exercise_library` | `exercises` + aux tables | Normalize equipment, tags, guidance, muscles, form params.
| `pt_shared/exercise_roles` | `role_definitions` + `exercise_roles` | Map regions/capacities/focus/contribution.
| `pt_shared/*_vocabulary` | `vocab_terms` | store term definitions.
| `users/{uid}/notes` | `notes` | map read/archive/delete flags.
| PT payloads | Import/export endpoints | decode V2 payloads to same normalized schema.【F:pt/pt_payload_utils.js†L1-L141】

### 5.2 Migration Steps
1. **Extract Firestore data** (admin script):
   - Export `pt_shared/*` documents and user-scoped data (sessions, runtime, notes).
2. **Transform**:
   - Normalize exercise library into multiple tables (equipment/tags/muscles/guidance/form params).
   - Split sessions into `sessions` + `session_sets` rows.
   - Convert runtime library into `patient_exercise_assignments` with dosage fields (sets/reps/time/distance).
   - Build `role_definitions` from role tuples; map `exercise_roles` accordingly.
3. **Load SQL**:
   - Upsert shared data first (exercises, vocab, roles).
   - Insert users + therapist mappings.
   - Insert patient programs and sessions.
4. **Validate**:
   - Compare counts with Firestore (sessions per patient, exercises, role assignments, notes).
   - Verify PT coverage calculations (roles × recent sessions).
5. **Cutover**:
   - Ship API with read-only mode to compare outputs; then enable write operations.

### 5.3 Data Cleanup / Normalization Needs
- Normalize inconsistent exercise IDs or names (Firestore library merges fallback JSON and may include mixed `name`/`canonical_name`).【F:pt/shared/firestore_shared_data.js†L80-L118】
- Resolve sessions without `exerciseId` by matching `exerciseName` to canonical entries (seen in tracker migrations).【F:pt/pt_tracker.html†L3267-L3285】
- Ensure role vocab terms and role schema enums are deduplicated (schema-driven role definitions).【F:pt/docs/DEVELOPMENT.md†L181-L209】

---

## 6. Open Decisions / Risks
1. **Role-based access**: confirm whether therapists can view multiple patients or only one patient per therapist (`therapistUid` appears to map 1:1 today).【F:pt/pt_report.html†L938-L952】
2. **Offline-first behavior**: define how long offline data persists locally, conflict resolution for session edits, and background sync triggers.
3. **PT modifications workflow**: decide whether to keep `pt_modifications` as a batch log or replace with direct CRUD writes + audit history in SQL.

---

## 7. Implementation Checklist (Suggested)
- [ ] Define database migrations for the schema above.
- [ ] Build REST API with auth, sessions, program assignments, notes, and library endpoints.
- [ ] Implement offline queue + sync in the PWA (service worker + IndexedDB).
- [ ] Rebuild PT Tracker UI to use new API and local cache.
- [ ] Rebuild PT Report editor with authenticated patient/therapist role handling.
- [ ] Rebuild coverage view using role definitions + session history.
- [ ] Build migration scripts (Firestore → SQL).

