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

### 2.6 Page-Level UX & Required Functionality (Rebuild Scope)
> The following details capture the user-facing UX and the data that must be captured/displayed per page. This is the authoritative list for rebuilding the UI.

#### 2.6.1 Patient Tracker (`pt_tracker.html`)
- **Auth gating + header/navigation**
  - Output: auth guard overlay (sign-in required) plus dedicated sign-in modal with remember-me and password reset affordance.【F:pt/pt_tracker.html†L783-L1055】
  - Output: header with streak display, quick exercise switcher trigger, notes indicator badge, and shortcut icons to weekly stats, exercise details, and hamburger menu.【F:pt/pt_tracker.html†L789-L806】
  - Output/Input: hamburger menu for auth status (sign in/out), notes, settings, export/import, library diagnostics, and reload actions.【F:pt/pt_tracker.html†L811-L869】
- **Exercise selection & plan view**
  - Input: select an exercise + exercise type (reps/timed/hold/duration/AMRAP/distance) plus initial sets/reps/target fields via exercise picker modal.【F:pt/pt_tracker.html†L960-L978】
  - Output/Input: “My Exercises” modal includes search, tag filters, recent exercises, and actions for planning sessions, browsing the library, viewing archived items, notes, and data backup.【F:pt/pt_tracker.html†L986-L1014】
  - Input: plan-session modal to pick today’s exercise list and start the planned session; session plan container displays the plan and allows ending the session early.【F:pt/pt_tracker.html†L887-L894】【F:pt/pt_tracker.html†L1616-L1629】
  - Input: per-exercise dosage fields (sets, reps per set, seconds per rep for timer exercises, distance for distance exercises). These map to `exerciseSpec` in session payloads.【F:pt/pt_tracker.html†L5171-L5186】
  - Input: dosage prompt/edit modals capture per-exercise dosage updates for sets/reps/seconds/distance and persist to program state.【F:pt/pt_tracker.html†L1543-L1613】
- **Session logging**
  - Output: counter mode and timer mode views with progress bars and target labels; main controls for previous/log/next set actions.【F:pt/pt_tracker.html†L907-L951】
  - Input: log set modal captures reps, distance, seconds, side selector, and dynamic form parameters; form parameters modal captures additional metadata after a session.【F:pt/pt_tracker.html†L1018-L1115】
  - Input: session notes modal collects free-text notes at end of session (stored with session).【F:pt/pt_tracker.html†L1058-L1068】
  - Input/Output: next-set confirmation modal summarizes logging with options to edit or confirm next set (ensures explicit confirmation).【F:pt/pt_tracker.html†L1118-L1131】
  - Input: edit session modal allows changing session date/time, editing sets, updating notes, and deleting a session.【F:pt/pt_tracker.html†L1220-L1259】
- **Timers & timers-based logging**
  - Output: timer display for duration or timed reps (rep counter, target seconds, countdown, progress bar, warnings at low time).【F:pt/pt_tracker.html†L928-L941】【F:pt/pt_tracker.html†L4171-L4194】
  - Input: timer start/pause/reset, and “log this time” controls that record `secondsAchieved`/`secondsTarget` when stopping early.【F:pt/pt_tracker.html†L936-L943】【F:pt/pt_tracker.html†L4304-L4314】
  - Output: rest timer modal countdown between sets, with skip/continue actions and progress bar.【F:pt/pt_tracker.html†L1166-L1181】
- **History, stats, and progress**
  - Output: history modal shows exercise revisions + recent sessions and provides quick export buttons (7-day summary, full report) plus reload action.【F:pt/pt_tracker.html†L1197-L1215】
  - Output: weekly stats modal with overview, volume chart, exercise breakdown, adherence view, and “view all sessions” navigation; all-sessions modal groups exercises by session ID.【F:pt/pt_tracker.html†L1297-L1329】
  - Output: exercise progress modal with summary, chart, and session list for a specific exercise.【F:pt/pt_tracker.html†L1332-L1345】
  - Output: session history grouped by `sessionId`, weekly stats, charts, adherence summaries, and streaks (fed by session history and runtime state).【F:pt/pt_tracker.html†L2567-L2642】【F:pt/pt_tracker.html†L5171-L5186】
- **Exercise details & library**
  - Output: exercise details modal surfaces professional guidance, plus hidden personal notes/rest fields to preserve data schema (even if not visible).【F:pt/pt_tracker.html†L1135-L1159】
  - Output/Input: exercise library browser modal with “show only new” toggle, search, selectable exercises, and bulk import; detail modal shows full exercise info and allows import to “My Exercises.”【F:pt/pt_tracker.html†L1348-L1385】
  - Output: library debug modal surfaces local/shared library snapshot for diagnostics.【F:pt/pt_tracker.html†L872-L883】
- **Export/import & data management**
  - Output/Input: export for PT modal collects optional email + note and can copy payload or open email client.【F:pt/pt_tracker.html†L1642-L1658】
  - Input: import PT modifications modal accepts pasted email payload and processes it into runtime state.【F:pt/pt_tracker.html†L1662-L1687】
  - Output/Input: data/backup modal and settings UI provide export (all data, library only, history only) and import (file restore) plus a link to the exercise editor.【F:pt/pt_tracker.html†L1388-L1414】【F:pt/pt_tracker.html†L1425-L1475】
- **Preferences & app management**
  - Input: settings toggles for haptics and voice announcements, with app version and reload controls; “about” section clarifies local-only storage message shown today.【F:pt/pt_tracker.html†L1479-L1533】
  - Output: Firestore write guard modal warns before saving if cloud data not loaded (preventing accidental overwrites).【F:pt/pt_tracker.html†L1691-L1703】
  - Output: app load warning overlay prompts reload if scripts fail to initialize.【F:pt/pt_tracker.html†L896-L904】
- **Offline behavior**
  - Output: sync indicators and offline mode status (driven by runtime snapshots).
  - Input: offline queue persists locally and syncs on reconnect; runtime state is serialized for recovery across devices.【F:pt/pt_tracker.html†L2171-L2190】

#### 2.6.2 Therapist Report & Editor (`pt_report.html`)
- **Auth + patient selection**
  - Output/Input: auth guard overlay and sign-in modal with remember-me and password reset affordances, tailored for therapist access.【F:pt/pt_report.html†L355-L380】
  - Output: report header shows patient ID, logged-in email, and navigation to PT View/Report plus logout control.【F:pt/pt_report.html†L385-L394】
  - Input: therapist selects patient by `therapistUid == currentUser.uid`; loads patient session history, runtime state, and notes for the selected patient.【F:pt/pt_report.html†L918-L955】
- **Report view (read-only patient summary)**
  - Output: overall progress metrics, coverage summary, recent activity (last 7 days), and exercise history list with per-exercise details.【F:pt/pt_report.html†L403-L421】
  - Output: patient note section shows the most recent patient-entered note when available.【F:pt/pt_report.html†L398-L401】
  - Output/Input: action buttons for toggling editor mode, printing, and navigation back to tracker/coverage/dashboard views.【F:pt/pt_report.html†L445-L453】
- **PT Editor Mode (full-screen)**
  - Output: dedicated editor overlay with shortcut buttons for view, notes, change history, undo-all, and close; keyboard shortcut hints for power users.【F:pt/pt_report.html†L455-L472】
  - Output/Input: reference guide for vocabulary + pattern modifiers used in exercise metadata (populated dynamically from vocab).【F:pt/pt_report.html†L474-L479】
  - Input: exercise editor includes search + select existing exercise, plus add-new flow with canonical name, category (including custom entry), and description fields; subsequent sections cover muscles, equipment, tags, guidance, and lifecycle metadata (see editor form structure).【F:pt/pt_report.html†L482-L516】
  - Output: updated library data is saved to the patient runtime state and logged in `pt_modifications`.【F:pt/pt_report.html†L1341-L1363】【F:pt/pt_report.html†L1556-L1566】
- **Program dosage & roles**
  - Input: assign or adjust per-patient dosage (sets/reps/time/distance), add/archived exercises, and update exercise roles/vocab.
  - Output: modifications accumulated in `pt_modifications` for tracker consumption (new exercises, edits, archived items, dosage changes, vocab updates).【F:pt/pt_report.html†L1556-L1566】
- **Therapist notes**
  - Input: send new notes to the patient; mark notes read, archived, or deleted.
  - Output: read state tracked for therapist and patient; notes flow shared with patient view.【F:pt/pt_view.html†L522-L683】
- **Import/export**
  - Output/Input: import screen offers entry to PT Editor Mode (without patient data) and links to patient view; PT Editor Mode can export PT modifications for sharing.【F:pt/pt_report.html†L423-L442】
  - Input: import PT_DATA / PT_MODIFICATIONS payloads (V2 gzip/base64).
  - Output: export payloads for sharing via email or copy/paste workflows.【F:pt/pt_payload_utils.js†L1-L141】

#### 2.6.3 Patient Dashboard (`pt_view.html`)
- **Auth gating + header**
  - Output/Input: dedicated auth screen with sign-in button; modal sign-in flow when using the dashboard (email/password, reset, cancel).【F:pt/pt_view.html†L226-L369】
  - Output: header shows read-only badge, logged-in email, notes badge, and navigation back to PT report plus logout control.【F:pt/pt_view.html†L233-L256】
- **Overview stats**
  - Output: total sessions, active exercises, week activity, total sets, recent activity, and top exercises computed from session history.【F:pt/pt_view.html†L264-L298】
  - Input: refresh data button and coverage analysis CTA to open the coverage page.【F:pt/pt_view.html†L300-L312】
- **Notes inbox**
  - Output: modal with notes list, unread badge, and filter toggle for showing all vs unread notes.
  - Input: patient can send notes from the modal (textarea + send button).【F:pt/pt_view.html†L315-L331】
- **Exercise history drill-down**
  - Output: exercise history modal shows session list for a selected exercise with a search field that filters by date or notes.【F:pt/pt_view.html†L335-L350】

#### 2.6.4 Coverage Analysis (`rehab_coverage.html`)
- **Auth + navigation**
  - Output/Input: auth guard overlay and sign-in modal with remember-me + reset; header with menu button and slide-out menu for navigation/actions.【F:pt/rehab_coverage.html†L655-L751】
- **Coverage matrix**
  - Output: accordion-style region/capacity/focus coverage summary derived from exercise roles and session history.
  - Input: date range or patient selection (therapist vs patient routing).【F:pt/rehab_coverage.html†L1183-L1234】
- **Menu actions & utilities**
  - Output/Input: slide-out menu includes debug panel, vocabulary browser, roles editor, export for PT, PT editor navigation, import PT modifications, export/import data, and back-to-tracker navigation.【F:pt/rehab_coverage.html†L689-L755】
  - Output: debug panel (toggle) surfaces coverage computations and matching diagnostics for sessions/roles.【F:pt/rehab_coverage.html†L771-L777】
- **Roles & vocabulary modals**
  - Output/Input: roles editor modal for editing roles per exercise (region/capacity/focus/contribution); vocabulary modal with term list and term definition modal for detailed descriptions.【F:pt/rehab_coverage.html†L758-L798】
- **Import/export**
  - Output/Input: export for PT modal (optional email + note) and import PT modifications modal (paste payload, verify, import).【F:pt/rehab_coverage.html†L800-L860】

#### 2.6.5 Admin & Utility Pages
- **`seed_firestore.html`**
  - Input: seed shared exercise library, roles, and vocab data into `pt_shared/*`; migrate runtime dosage fields.
  - Output: logs seed status and counts for verification.【F:pt/seed_firestore.html†L1-L112】
- **`migrate_roles.html`**
  - Input: migrate/merge role updates from `pt_modifications` into shared role definitions.
  - Output: admin/debug status display for migration results.【F:pt/migrate_roles.html†L1-L120】

### 2.7 JSON Storage Artifacts (Structure Must Persist)
> These JSON files are shipping artifacts today. Even if the rebuild does not use them directly, their structure must be preserved to support backward compatibility, exports, and tooling.

#### 2.7.1 `pt/exercise_library.json` (Shared Exercise Library)
- **Top-level**
  - `exercises`: array of exercise definitions.【F:pt/exercise_library.json†L1-L33】
- **Exercise record fields (per entry)**
  - Identity + taxonomy: `id`, `canonical_name`, `pt_category`, `description`.【F:pt/exercise_library.json†L1-L33】【F:pt/exercise_library.json†L1280-L1284】
  - Muscles: `primary_muscles[]`, `secondary_muscles[]`.【F:pt/exercise_library.json†L7-L19】
  - Pattern + modifiers: `pattern` (`side` or `both`) and `pattern_modifiers[]` which may include values like `hold_seconds` or `duration_seconds` (must preserve both fields even if not used).【F:pt/exercise_library.json†L20-L22】【F:pt/exercise_library.json†L84-L87】【F:pt/exercise_library.json†L337-L340】
  - Equipment: `equipment.required[]`, `equipment.optional[]`.【F:pt/exercise_library.json†L22-L27】
  - Form parameters: `form_parameters_required[]` (schema-driven required inputs).【F:pt/exercise_library.json†L28-L29】【F:pt/exercise_library.json†L94-L96】
  - Tags: `tags.functional[]`, `tags.format[]`, `tags.heatmap[]`.【F:pt/exercise_library.json†L29-L33】【F:pt/exercise_library.json†L342-L349】
  - Guidance: `guidance.external_cues[]`, `guidance.motor_cues[]`, `guidance.compensation_warnings[]`, `guidance.safety_flags[]`.【F:pt/exercise_library.json†L34-L39】【F:pt/exercise_library.json†L351-L359】
  - Lifecycle + lineage: `lifecycle.status`, `lifecycle.effective_start_date`, `lifecycle.effective_end_date`, `added_date`, `updated_date`, `supersedes[]`, `superseded_by`, `superseded_date`.【F:pt/exercise_library.json†L1273-L1282】

#### 2.7.2 `pt/exercise_roles.json` (Roles Mapping)
- **Top-level**
  - `schema_version`: version string for the roles schema.【F:pt/exercise_roles.json†L1-L3】
  - `exercise_roles`: map of exercise ID → role assignments (each entry has `name` + `roles[]`).【F:pt/exercise_roles.json†L3-L33】
- **Role entry (per exercise)**
  - Each role includes `region`, `capacity`, optional `focus`, and `contribution`. These are used in coverage reporting and editor tooling.【F:pt/exercise_roles.json†L7-L28】

#### 2.7.3 `pt/exercise_roles_vocabulary.json` (Roles Vocabulary)
- **Top-level**
  - `vocabulary_version`, `schema_ref` (points at `exercise_roles.schema.json`).【F:pt/exercise_roles_vocabulary.json†L1-L6】
- **Vocab dictionaries**
  - `region`, `capacity`, `contribution`, `focus` dictionaries map vocab keys to human-readable definitions used in UI and reports.【F:pt/exercise_roles_vocabulary.json†L7-L38】

#### 2.7.4 `pt/exercise_library_vocabulary.json` (Library Vocabulary + Semantics)
- **Top-level**
  - `vocabulary_version`, `vocabulary_mode`, `authority`, and `schema_ref` metadata for schema alignment notes.【F:pt/exercise_library_vocabulary.json†L1-L7】
- **Lifecycle vocab**
  - `lifecycle` definitions describe allowed statuses and date semantics; used to interpret lifecycle fields in the library data.【F:pt/exercise_library_vocabulary.json†L9-L25】
- **Tags vocab**
  - `tags.functional`, `tags.format`, `tags.heatmap` provide guidance (including deprecated sections) for tag values even though tags are schema-free strings.【F:pt/exercise_library_vocabulary.json†L27-L69】
- **Category and pattern semantics**
  - `pt_category` provides definitions for category enums; `pattern` explains dosage semantics for `side` vs `both` patterns.【F:pt/exercise_library_vocabulary.json†L72-L105】
- **Pattern modifiers (must preserve keys even if unused)**
  - `pattern_modifiers` defines dosage semantics for modifiers such as `duration_seconds`, `hold_seconds`, `AMRAP`, `distance_feet`, etc. The rebuild must retain these keys/meaning to keep the data schema intact, especially for differences like `hold_seconds` vs `duration_seconds`.【F:pt/exercise_library_vocabulary.json†L108-L138】

#### 2.7.5 `pt/manifest-pt.json` (PWA Manifest)
- **Top-level**
  - `name`, `short_name`, `description`, `start_url`, `display`, `background_color`, `theme_color`, `orientation`, and `icons[]` (maskable SVG).【F:pt/manifest-pt.json†L1-L24】

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
