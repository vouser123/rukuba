# PT Tracker Rebuild - Public Dev Notes

This file is the canonical development history for the Supabase/Vercel PT rebuild.

## Table of Contents
- [How to Use This File](#how-to-use-this-file)
- [Priority Levels](#priority-levels)
- [Risk Levels](#risk-levels)
- [Status Values](#status-values)
- [Tag Vocabulary](#tag-vocabulary)
- [Entry Schema](#entry-schema)
- [Migration Approach](#migration-approach)
- [Activity Log Testing Checklist](#activity-log-testing-checklist)
- [Open Items](#open-items)
- [Dated Entries](#dated-entries)
- [Legacy Entries (Pre-Format)](#legacy-entries-pre-format)

## How to Use This File
- Purpose: operational log for agents and humans maintaining the PT rebuild.
- Keep newest entries first.
- Keep active work only in `Open Items`.
- Close-loop rule: when an item is resolved, remove it from `Open Items` and link the dated entry that resolved it.

## Priority Levels
- `P0`: critical safety/security/data-loss risk, immediate.
- `P1`: high impact, near-term.
- `P2`: medium impact, planned.
- `P3`: low impact, nice-to-have.

## Risk Levels
- `high`: changes likely to cause regressions, data integrity issues, or access-control mistakes without careful validation.
- `medium`: meaningful behavior impact possible; requires focused testing.
- `low`: localized/safe change surface with limited blast radius.

## Status Values
- `open`
- `in_progress`
- `blocked`
- `done`

## Tag Vocabulary
- `ui`: UX and interface behavior.
- `ios`: iOS Safari/PWA specific behavior.
- `pwa`: service worker, installability, and web app shell behavior.
- `offline`: offline loading/storage/sync behavior.
- `supabase`: Supabase client, RLS, and data-access behavior.
- `auth`: authentication/session state.
- `sync`: cross-device or queued synchronization logic.
- `data-model`: schema/field mapping/normalization concerns.
- `api`: endpoint and request/response behavior.
- `performance`: speed, batching, and resource usage.
- `reliability`: correctness and failure handling.
- `security`: access control, secrets, and hardening.
- `migration`: one-time transforms or data movement.
- `docs`: documentation/process-only changes.

## Entry Schema
Use this exact field order for all new dated entries:
- `Problem:`
- `Root cause:`
- `Change made:`
- `Files touched:`
- `Validation:`
- `Follow-ups:`
- `Tags: [...]`

## Migration Approach
- Legacy content is frozen under `Legacy Entries (Pre-Format)`.
- Active TODOs were normalized first in `Open Items`.
- Convert legacy entries to the new schema only when touched.

## Activity Log Testing Checklist

When modifying any part of the activity log flow (`createActivityLog`, `updateActivityLog`, `processActivityLog`, `create_activity_log_atomic`), test all of the following variable combinations. Skipping any of these has caused regressions.

### Exercise type variables
- Exercise **with** form parameters (e.g. Theraband Row — has resistance/color form param)
- Exercise **without** form parameters (e.g. Ankle Inversion — Isometric — form_data is null in payload)
- Exercise with pattern modifier only (duration_seconds or hold_seconds — not form_data)
- Exercise with distance_feet set
- Exercise with reps only (no seconds, no distance)

### Set variables
- Single set
- Multiple sets (3+) — test that form data ends up on the correct set_number, not shifted
- Sets with different form_data per set (e.g. set 1: band=blue, set 2: band=red) — verifies DN-004 fix
- Sets where set_number is not contiguous (e.g. 1, 3, 5 — edit flow)

### Side variables
- `side = null` (exercises that do not track side)
- `side = 'left'`
- `side = 'right'`
- `side = 'both'`

### Log path variables
- Online, direct POST to `/api/logs` (createActivityLog)
- Offline, queued to localStorage then synced via `syncOfflineQueue` → POST to `/api/logs` (same endpoint, different entry point)
- Edit/update via PATCH to `/api/logs/:id` (updateActivityLog)
- Sync path via POST to `/api/sync` (processActivityLog) — reachable endpoint, tests separately

### Idempotency
- POST same `client_mutation_id` twice — must return 409, no duplicate rows
- Confirm exactly one row in `patient_activity_logs` for the mutation ID after double-post

### DB verification query (paste into Supabase SQL editor)
```sql
SELECT
  l.id AS log_id,
  l.exercise_name,
  s.set_number,
  s.reps,
  s.seconds,
  s.distance_feet,
  s.side,
  s.manual_log,
  f.parameter_name,
  f.parameter_value,
  f.parameter_unit
FROM patient_activity_logs l
LEFT JOIN patient_activity_sets s ON s.activity_log_id = l.id
LEFT JOIN patient_activity_set_form_data f ON f.activity_set_id = s.id
WHERE l.patient_id = '35c3ec8d-...'  -- replace with real patient UUID
ORDER BY l.created_at DESC, s.set_number, f.parameter_name;
```

## Open Items
- [x] DN-001 | status:done | priority:P0 | risk:medium | tags:[security,supabase,api,auth] | file:pt-rebuild/api/sync.js | issue:Use auth-context Supabase client (`getSupabaseWithAuth(req.accessToken)`) instead of anon client. | resolved:2026-02-20
- [x] DN-002 | status:done | priority:P0 | risk:medium | tags:[security,api,auth] | file:pt-rebuild/api/logs.js | issue:Add therapist-to-patient authorization check in `createActivityLog()` when `patient_id` differs from caller. | resolved:2026-02-20
- [x] DN-003 | status:done | priority:P1 | risk:high | tags:[data-model,reliability,sync,api] | file:pt-rebuild/api/sync.js,pt-rebuild/api/logs.js | issue:Prevent orphaned logs when sets insert fails (cleanup or transactional behavior). | resolved:2026-02-21
- [x] DN-004 | status:done | priority:P1 | risk:high | tags:[data-model,reliability,api] | file:pt-rebuild/api/logs.js | issue:Form data is matched to sets by array index instead of `set_number` in create/update flows. | resolved:2026-02-21
- [ ] DN-005 | status:open | priority:P2 | risk:low | tags:[performance,api] | file:pt-rebuild/api/users.js | issue:Push role-based filtering to DB query (`.eq()` etc.) instead of fetching all users then filtering in memory.
  - Context: Therapists/patients currently fetch full user sets before reducing in app logic.
  - Constraints/Caveats: Behavior parity (who can see which users) must remain identical after query-level filtering.
- [ ] DN-006 | status:open | priority:P3 | risk:low | tags:[ui,ios,pwa,reliability] | file:pt-rebuild/public/js/hamburger-menu.js | issue:Audit and align hamburger menu consistency across index/pt_view/pt_editor/rehab_coverage.
  - Context: Menu structure and handlers drift across pages despite shared assets.
  - Constraints/Caveats: Must preserve page-specific links/workflows while standardizing interaction model (`data-action` + `pointerup`).
- [ ] DN-007 | status:open | priority:P1 | risk:medium | tags:[performance,ui,ios] | file:pt-rebuild/public/index.html,pt-rebuild/public/rehab_coverage.html | issue:Reduce INP from 800ms mobile average; worst offenders identified from Vercel Speed Insights real-user data.
  - Context: Field data (mobile, 2026-02-18) shows processing duration (not input delay) is the bottleneck — handlers are doing too much synchronous work on tap. Worst offenders by element: `#hamburgerMenu` 3,488ms (2 interactions), `#timerMode` 1,768ms, `#cap-back-tolerance` 1,480ms, `#messagesModal` 1,296ms, `#sessionNotes` 1,368ms, `#cap-ankle-tolerance` 1,192ms, `#logSetModal` 632ms, `body>div.header` 520ms. LCP on index.html is 8.4s (mobile, 12 data points) — LCP element is `#exerciseList>div.exercise-card>div.exercise-name`, caused by serial API waterfall (users → programs → history before first render). Backfill fetch removed 2026-02-18 as first LCP fix.
  - Constraints/Caveats: Handler code for hamburger menu and capacity elements has not yet been read — root cause of synchronous blocking work is unconfirmed. Must not change clinical logging workflows. iOS PWA `pointerup`/`data-action` pattern must be preserved. rehab_coverage.html capacity tap handlers are separate from index.html and need independent investigation.
- [ ] DN-008 | status:open | priority:P2 | risk:low | tags:[data-model,migration] | file:pt-rebuild/supabase/migrations | issue:Delete `20260220000755_remote_schema.sql.bak` once VS Code Supabase extension confirms no more storage trigger errors.
  - Context: Created as a backup before stripping the storage-internal trigger lines from the migrations file. Safe to delete once tooling is confirmed clean.
  - Constraints/Caveats: Verify VS Code extension no longer flags the file before deleting.
- [ ] DN-009 | status:open | priority:P2 | risk:low | tags:[data-model,migration] | file:pt-rebuild/supabase | issue:Drop backup table `exercises_backup_20260221` after confirming exercise ID migration is working correctly in production.
  - Context: Table was created as a safety net during the atomic migration that remapped 13 non-UUID exercise IDs (ex000X and slug IDs) to proper UUIDs. All 34 exercises and 11 FK constraint tables verified correct post-migration. See dated entry 2026-02-20.
  - Constraints/Caveats: Confirm pt_editor loads/saves exercises correctly and no FK errors appear in logs before dropping.
- [ ] DN-010 | status:open | priority:P2 | risk:medium | tags:[performance,supabase,security] | file:pt-rebuild/supabase | issue:Resolve duplicate permissive SELECT policies on patient_activity_logs, patient_activity_sets, patient_activity_set_form_data, and vocab_* tables.
  - Context: Supabase performance advisor flags 9 tables with two SELECT policies for `authenticated` on the same table. Both policies are evaluated per query. The older `_select_own` / `patient_activity_*_select` policies predate the broader `activity_logs_select` / `activity_sets_select` / `set_form_data_select` policies. The broader policies cover all cases the older ones do, plus therapist access. The older narrow ones can likely be dropped — but access behavior must be verified first.
  - Constraints/Caveats: Read both policy bodies carefully before dropping anything. Verify that the broader policy covers every case the narrow one does (patient own access + therapist access + admin access). Do not drop without testing patient and therapist SELECT access in staging.
- [ ] DN-014 | status:open | priority:P2 | risk:low | tags:[ui] | file:pt-rebuild/public/index.html | issue:History tab on index shows all exercises; when navigating from a specific exercise it should pre-filter to that exercise's history only.
  - Context: User taps an exercise card, then taps the History tab — expects to see that exercise's history, not the full log across all exercises.
  - Constraints/Caveats: Needs a way to pass exercise context to the History tab (e.g. in-memory state or scroll-to). Should still allow clearing the filter to see full history.
- [ ] DN-013 | status:open | priority:P2 | risk:low | tags:[ui] | file:pt-rebuild/public/index.html | issue:History view on index does not show notes; pt_view.html shows notes on log entries but index.html does not.
  - Context: Notes are already fetched with the activity log data — just not rendered in the index history UI. pt_view.html is the reference implementation for how notes should appear.
  - Constraints/Caveats: Check pt_view.html notes rendering and replicate the same pattern on index.
- [ ] DN-012 | status:open | priority:P2 | risk:low | tags:[ui] | file:pt-rebuild/public/index.html | issue:No way to reorder exercises on the patient index page — currently sorted by program assignment order from the API.
  - Context: User needs the ability to control the display order of exercises (e.g. by body region, by recency, by custom sort). Currently exercises render in whatever order the server returns them.
  - Constraints/Caveats: Sort preference should persist across sessions (localStorage or user profile). Must not affect the underlying program data, only display order.
- [ ] DN-015 | status:open | priority:P2 | risk:low | tags:[ui,auth,reliability] | file:pt-rebuild/public/index.html,pt-rebuild/public/pt_view.html | issue:Hamburger menu sometimes shows "Signed in as -" (dash) instead of the user's name on page load.
  - Context: User name is populated after the users API call resolves. On slow loads or when the menu is opened before the API response arrives, the name placeholder "-" is visible instead of the real name.
  - Constraints/Caveats: Investigate whether the menu renders before `me` is resolved and whether a re-render or reactive update is needed once the name is available.
- [ ] DN-016 | status:open | priority:P2 | risk:medium | tags:[ui,auth,api] | file:pt-rebuild/api/users.js,pt-rebuild/public | issue:No user profile editor — users cannot change their own name, email, or password from within the app.
  - Context: Currently `PATCH /api/users` only accepts `email_notifications_enabled`. A profile editor would allow users to update `first_name`, `last_name`, email (requires Supabase Auth update), and password (requires Supabase Auth password change flow). Admin may also need ability to edit other users' profiles.
  - Constraints/Caveats: Email/password changes must go through Supabase Auth API (`supabase.auth.updateUser()`), not just the `users` table. Need to consider whether therapist can edit patient profiles or only admins can.
- [ ] DN-018 | status:open | priority:P2 | risk:medium | tags:[offline,api,reliability] | file:pt-rebuild/api/sync.js,pt-rebuild/public/js/offline.js,pt-rebuild/public/index.html | issue:Two competing offline sync systems exist — the active one (localStorage + `/api/logs` per item in index.html) and a dead one (`offline.js` IndexedDB queue + `/api/sync` batch endpoint). `manualSync()` in offline.js is never called; `/api/sync` is reachable but unused by any UI flow.
  - Context: `offline.js` is imported in index.html and used for IndexedDB read-caching only (exercises, programs, logs). Its queue/sync functionality was never wired up. The active offline pattern is entirely in `syncOfflineQueue()` in index.html using localStorage. `/api/sync` takes up one of Vercel's 12-function free-tier slots.
  - Options: (A) Remove `/api/sync` and dead offline.js sync code — cleans up confusion, frees function slot, but requires careful audit of what IndexedDB code is safe to remove. (B) Activate `/api/sync` as a proper batch endpoint replacing per-item `/api/logs` calls — significant redesign. (C) Leave as-is but document clearly.
  - Constraints/Caveats: Do not touch index.html IndexedDB hydration code without fully understanding what it caches and whether anything reads from it. This is a full separate project, not a quick cleanup.
- [ ] DN-019 | status:open | priority:P1 | risk:medium | tags:[security,auth,api,reliability] | file:pt-rebuild/api/logs.js | issue:Clinical message creation (`POST /api/logs?type=messages`) validates recipient existence but does not enforce therapist↔patient relationship constraints.
  - Context: Current logic allows any authenticated caller to target any existing `users.id` as `recipient_id` if RLS permits the insert. The intended messaging model is patient-therapist communication, so relationship checks should mirror assignment rules used elsewhere.
  - Constraints/Caveats: Define and preserve intended matrix explicitly (patient→assigned therapist only; therapist→assigned patient only; admin behavior defined). Verify against current `clinical_messages` RLS policy bodies before tightening endpoint logic.
- [ ] DN-020 | status:open | priority:P2 | risk:low | tags:[api,reliability] | file:pt-rebuild/api/logs.js | issue:Type safety bug in message validation — `recipient_id?.trim()` / `body?.trim()` can throw before try/catch when payload fields are non-strings.
  - Context: Validation currently happens outside the `try` block and assumes string inputs. Malformed JSON payloads (number/object types) can raise a `TypeError` and return an unhandled 500 path instead of a controlled 400 response.
  - Constraints/Caveats: Keep behavior for valid string payloads unchanged; add explicit type checks and ensure error shape remains consistent with existing API contracts.
- [ ] DN-021 | status:open | priority:P2 | risk:medium | tags:[api,reliability,ui] | file:pt-rebuild/api/roles.js,pt-rebuild/public/js/pt_editor.js,pt-rebuild/vercel.json | issue:Potential route mismatch for role deletion — frontend calls `DELETE /api/roles/:id`, while deployment routing may only map file-based `/api/roles`.
  - Context: `pt_editor.js` calls `/api/roles/${roleId}` and `api/roles.js` parses a path suffix from `req.url`, but there is no explicit rewrite for nested `/api/roles/:id` in `vercel.json`.
  - Constraints/Caveats: Confirm behavior in deployed Vercel environment before changing API shape. If needed, support both `DELETE /api/roles?id=...` and path variant to avoid breaking existing clients.
- [ ] DN-022 | status:open | priority:P1 | risk:medium | tags:[offline,auth,security,reliability] | file:pt-rebuild/public/index.html | issue:Offline queue is stored under a global localStorage key (`pt_offline_queue`) and is not cleared/scoped on sign-out, risking cross-user data carryover on shared devices.
  - Context: Queue load/save are key-based only and `signOut()` only ends Supabase auth session. A subsequent user on the same device/browser profile can inherit prior unsynced sessions.
  - Constraints/Caveats: Preserve offline durability for the same user while preventing cross-account leakage (e.g., scope key by user ID and/or clear queue on auth change with migration strategy).
- [ ] DN-017 | status:open | priority:P2 | risk:low | tags:[docs,data-model,supabase] | file:pt-rebuild/db/schema.sql | issue:`schema.sql` drifts out of sync with the live database every time a migration is applied — no automated mechanism keeps it current.
  - Context: `schema.sql` is a manually maintained snapshot. Each migration in `pt-rebuild/db/migrations/` changes the live DB but does not update `schema.sql`. Over time the file becomes unreliable as a reference for the current DB structure.
  - Options: (A) After each migration, regenerate `schema.sql` using `supabase db dump --schema public > pt-rebuild/db/schema.sql` as a manual step. (B) Treat `schema.sql` as deprecated documentation and rely solely on numbered migration files as source of truth. (C) Add a note in CLAUDE.md reminding agents to update `schema.sql` after applying migrations.
  - Constraints/Caveats: `supabase db dump` requires Supabase CLI and project credentials. Option B is safest but means agents must read all migration files to understand current schema. Option A keeps a single readable file but relies on discipline to run it.
- [ ] DN-011 | status:open | priority:P3 | risk:low | tags:[performance,supabase] | file:pt-rebuild/supabase | issue:Evaluate and drop unused indexes once the app has real query traffic.
  - Context: Supabase performance advisor flagged 13 indexes as unused: idx_patient_programs_assigned_at, idx_patient_programs_assigned_by, idx_patient_programs_archived_at, idx_program_history_patient, idx_program_history_changed_at, idx_patient_program_history_changed_by, idx_clinical_messages_patient, idx_clinical_messages_created_at, idx_clinical_messages_deleted_by, idx_offline_mutations_user, idx_offline_mutations_pending, exercise_pattern_modifiers_exercise_id_idx, exercise_form_parameters_exercise_id_idx, idx_exercise_roles_active.
  - Constraints/Caveats: Indexes may not yet be used because patient data volume is low. Re-check after real patient usage before dropping. Some (e.g. exercise child table indexes) may become useful as exercise count grows.

## Dated Entries
Use this section for all new entries in reverse chronological order.

## 2026-02-21

### 2026-02-21 — Regression: exercises without form data failed to log (500) after RPC migration
- Problem: Any exercise without form parameters (e.g. Ankle Inversion — Isometric) returned a 500 error immediately after the DN-003/DN-004 RPC migration. Existing offline queue sessions failed to sync.
- Root cause: The client sends `"form_data": null` in set objects when an exercise has no form parameters. In Postgres JSONB, `v_set->'form_data'` on a JSON null value returns a JSONB null — not a SQL NULL. The RPC's guard `v_set->'form_data' IS NOT NULL` evaluated to `true` for JSON nulls, causing `jsonb_array_length()` to be called on a non-array type, raising an exception and rolling back the transaction with a 500.
- Change made: Replaced `IS NOT NULL` check with `jsonb_typeof(v_set->'form_data') = 'array'`. This correctly handles `null`, missing key, and empty array without error. Fix applied directly in DB via Supabase MCP (`apply_migration`) — no Vercel deployment required.
- Files touched: DB only — migration `014_fix_activity_log_rpc_null_form_data.sql` (new); `pt-rebuild/db/migrations/014_fix_activity_log_rpc_null_form_data.sql` saved to repo.
- Validation: Tested RPC directly with `"form_data": null` payload — returned `log_id`, no error. Confirmed Ankle Inversion — Isometric log from offline queue synced correctly: set_count=1, reps=10, seconds=10, side=right, manual_log=true.
- Follow-ups: None. Should have tested with a no-form-data exercise before shipping DN-003/DN-004.
- Tags: [reliability,api,supabase,migration]

### 2026-02-21 — DN-003 + DN-004: Atomic activity log creation via Postgres RPC
- Problem: (DN-003) When `patient_activity_sets` insert failed after `patient_activity_logs` was already written, the log row was left orphaned with no sets — silent data corruption in clinical records with no error visible to the patient. (DN-004) Form data (e.g. band resistance, weight) was matched to sets by array index position; if Supabase returned inserted rows in a different order than submitted, form parameters would attach to the wrong clinical set with no error raised. Both bugs existed in `createActivityLog` (logs.js) and DN-003 also existed in `processActivityLog` (sync.js).
- Root cause: Three-table insert was done in separate sequential statements with no transaction boundary. Cleanup-on-error was considered but rejected: if the log insert succeeds but the cleanup delete also fails, the `client_mutation_id` unique constraint entry persists — the clinical record becomes permanently unrecoverable on retry. Array-index matching assumed Supabase preserves insert-order in responses, which is not guaranteed.
- Change made: Created Postgres function `create_activity_log_atomic` (`SECURITY INVOKER` — all existing RLS policies remain in full effect, no privilege escalation). Function wraps all three inserts in a single implicit PL/pgSQL transaction; any failure rolls back atomically so no orphaned row is ever written and `client_mutation_id` is only committed on full success. Form data is matched to sets by `set_number` captured from each set's `RETURNING id` clause — not by array index. Replaced three-step inline insert in `createActivityLog` and two-step insert in `processActivityLog` with `supabase.rpc('create_activity_log_atomic', {...})`. Fixed `updateActivityLog` array-index form data matching with a `set_number`-keyed Map lookup. Added `set_number` validation to `createActivityLog` (consistent with `sync.js`). Also: `processActivityLog` in `sync.js` previously never inserted `patient_activity_set_form_data` at all — the RPC now handles all three tables in both code paths.
- Files touched: `pt-rebuild/api/logs.js`, `pt-rebuild/api/sync.js`, `pt-rebuild/db/migrations/013_create_activity_log_rpc.sql` (new)
- Validation: Migration applied via Supabase MCP. Function confirmed in DB (`SECURITY_TYPE: INVOKER`). Deployment `dpl_AhHBKZ9xpiaxfeJG4v9qb3QZoj9b` READY (commit cd566b5). Existing log history loads correctly in app.
- Follow-ups: None.
- Tags: [data-model,reliability,sync,api,supabase,migration]

### 2026-02-21 — Email notifications for clinical messages (Resend integration)
- Problem: The daily cron (`handleNotify` in `logs.js`) used SendGrid (never configured), sent only a count (no message bodies), had no "new since last email" guard (re-sent daily for old unread messages), and had no opt-out support.
- Root cause: Feature was scaffolded but never fully implemented. `SENDGRID_API_KEY` was never set in Vercel.
- Change made: Rewrote `handleNotify` to use Resend API (`RESEND_API_KEY` already configured via Vercel integration). Added `last_notified_at` timestamptz column to track per-user send time. Added `email_notifications_enabled` boolean column (default true) for opt-out. New logic: skip opted-out users, skip if notified within 23 hours, filter to messages newer than `last_notified_at`, skip if no new messages, send HTML email with message bodies + role-based deep link + opt-out footer, update `last_notified_at` on success. Added `PATCH /api/users` handler (own record only, boolean only). Added email notify toggle to messages modal in both `index.html` and `pt_view.html`. Fixed message font sizes (body 14→16px, labels 13→15px, timestamps/buttons 11→13px). Added `font-size: 16px` to compose textarea (prevents iOS auto-zoom).
- Files touched: `pt-rebuild/api/logs.js`, `pt-rebuild/api/users.js`, `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`; Vercel env vars added: `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`; Supabase migrations: `add_last_notified_at_to_users`, `add_email_notifications_opt_out`
- Validation: Triggered cron manually — `{"sent":1,"skipped":0,"total":1}`. DB `last_notified_at` updated for therapist. Re-triggered immediately — `{"sent":0,"skipped":1,"total":1}` (23-hour guard working).
- Follow-ups: Remove `SENDGRID_API_KEY` from Vercel if it exists (was never set, but worth confirming).
- Tags: [notifications,email,api,ui,ios,data-model,migration]

### 2026-02-21 — Admin-role user blocked from patient app (programs, sync)
- Problem: Admin user (who is also the sole patient) could not see their programs in the patient app, and the offline sync queue was rejected entirely with 403.
- Root cause: (1) `patient_programs` and `patient_program_history` SELECT RLS policies had no admin bypass — they only allowed own `patient_id` or therapist relationship. (2) `/api/sync` used `requirePatient` middleware which rejects any non-`patient` role, blocking the admin user even though they are also a patient.
- Change made: (1) Dropped and recreated `patient_programs_select_own` and `patient_program_history_select` RLS policies to add `OR (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'))`. (2) Changed `sync.js` from `requirePatient` → `requireAuth`; updated comment to reflect that RLS on `patient_activity_logs` still enforces own-`patient_id` inserts. All other exercise/role/vocab write endpoints already allowed admin.
- Files touched: DB (migration `fix_admin_patient_rls`), `pt-rebuild/api/sync.js`
- Validation: Migration applied successfully. RLS SELECT policies now include admin bypass. Sync endpoint accepts any authenticated user; RLS still blocks cross-patient inserts.
- Follow-ups: None.
- Tags: [security,auth,supabase,api]

## 2026-02-20

### 2026-02-20 — P0 security: auth client in sync.js + therapist-patient authorization in logs.js
- Problem: (1) `api/sync.js` used the anon Supabase client for patient data inserts, bypassing RLS user context. (2) `createActivityLog()` in `api/logs.js` allowed any authenticated caller to post an activity log to any arbitrary `patient_id` with no relationship check.
- Root cause: (1) `getSupabaseClient()` was used instead of `getSupabaseWithAuth()` — the token was available on `req.accessToken` but not passed to the client. (2) `targetPatientId` was set from the request body `patient_id` without verifying the caller had a therapist relationship to that patient.
- Change made: (1) Swapped `getSupabaseClient()` → `getSupabaseWithAuth(req.accessToken)` in `sync.js`. (2) Added authorization block in `createActivityLog()`: when `patient_id` differs from `req.user.id`, rejects non-therapist/non-admin callers with 403; for therapists, queries `users` table via admin client to confirm `therapist_id` matches, rejects with 403 if not assigned.
- Files touched: `pt-rebuild/api/sync.js`, `pt-rebuild/api/logs.js`
- Validation: Code paths verified by inspection. Regression: patients logging own data unaffected (no `patient_id` body field). Therapists logging for assigned patients pass the relationship check. Unassigned callers receive 403.
- Follow-ups: None. DN-001 and DN-002 closed.
- Tags: [security,api,auth,supabase]

### 2026-02-20 — RLS auth.uid() initialization plan fix (performance)
- Problem: Supabase performance advisor flagged 17 RLS policies across 9 tables for re-evaluating `auth.uid()` once per row instead of once per query.
- Root cause: Policies used bare `auth.uid()` in WHERE conditions. PostgreSQL re-evaluates this for every row scanned. Wrapping in `(select auth.uid())` forces a single evaluation per query.
- Change made: Dropped and recreated 15 affected policies on `patient_activity_logs` (select/update/delete), `patient_activity_sets` (select/update/delete), `patient_activity_set_form_data` (select/update/delete), and all 6 `vocab_*` tables (`_modify` policy on each). Replaced all bare `auth.uid()` with `(SELECT auth.uid())`. Zero behavior change — purely a query planner optimization.
- Files touched: DB only (migration `fix_rls_auth_uid_initplan` applied via Supabase MCP)
- Validation: Migration applied successfully. Re-run performance advisor to confirm warnings cleared.
- Follow-ups: DN-009 — duplicate permissive SELECT policies still present on patient_activity_logs, patient_activity_sets, patient_activity_set_form_data, and vocab_* tables. Requires careful review before fixing (medium risk). DN-010 — 13 unused indexes flagged; defer until real query traffic confirms they're unneeded.
- Tags: [performance,supabase,security]

### 2026-02-20 — Supabase migrations file corrupted by storage-internal trigger lines
- Problem: VS Code Supabase extension reported errors on `20260220000755_remote_schema.sql`. The file is a full `pg_dump`-style schema export that GPT inserted after truncating `supabase_migrations.schema_migrations`. It contained `drop extension if exists "pg_net"` and 5 `CREATE TRIGGER` statements on `storage.objects` / `storage.prefixes` — internal Supabase objects that cannot be created by user migrations.
- Root cause: GPT truncated the migrations table and inserted a single mega-migration row pointing at a full schema dump. The dump included storage-internal triggers at the end that Supabase tooling rejects. The DB itself was unaffected (the migration row was already marked applied), but the local file caused tooling errors.
- Change made: Removed lines 2034–2045 from `pt-rebuild/supabase/migrations/20260220000755_remote_schema.sql` — specifically `drop extension if exists "pg_net"` and the 5 `CREATE TRIGGER` statements on `storage.objects` and `storage.prefixes`. No DB changes were needed.
- Files touched: `pt-rebuild/supabase/migrations/20260220000755_remote_schema.sql`
- Validation: Verified zero `storage.` and `pg_net` matches remain in the file.
- Follow-ups: None — DB was never affected. If the VS Code extension still reports issues, verify the migration row in `supabase_migrations.schema_migrations` is still present and marked applied.
- Tags: [migration,supabase,reliability]

### 2026-02-20 — Exercise IDs: bug fix + data migration to proper UUID format
- Problem: 13 of 34 exercises had non-UUID IDs. 9 had sequential `ex000X` IDs from the original Firebase migration (Jan 18). 4 had slug IDs like `passive-great-toe-plantarflexion-stretch` added Jan 28 – Feb 3 via `pt_editor`. All 13 had linked records across 11 child tables that had to be preserved.
- Root cause: `generateExerciseId(name)` in `pt_editor.js` slugified the canonical name instead of generating a UUID. The 9 `ex000X` IDs were grandfathered from Firebase. The 4 slug IDs were created when exercises were manually added through the editor after the Firebase migration.
- Change made:
  1. **Bug fix** — Replaced `generateExerciseId(name)` body to use `crypto.randomUUID()` (native browser API, no vendor dependency). Removed the vendored `ulid.js` library that was briefly added.
  2. **Display field** — Added a read-only Exercise ID display field in `pt_editor.html` above the Canonical Name field (both add and edit modes). Pre-generates a UUID when adding; shows existing ID when editing. Field is monospace, readonly, not user-editable.
  3. **JS wiring** — `loadExerciseForEdit()` populates `exerciseIdDisplay` from `exercise.id`. `clearForm()` pre-generates a fresh UUID into `exerciseIdDisplay`. `collectFormData()` reads from `exerciseIdDisplay` instead of calling `generateExerciseId(canonicalName)`.
  4. **Data migration** — Applied atomic migration `20260221000001_fix_exercise_ids.sql` via Supabase MCP: dropped all 11 FK constraints, updated all 13 bad IDs in `exercises` and all child tables (using a temp mapping table), re-added FK constraints with original ON DELETE behavior. Backup table `exercises_backup_20260221` preserved.
- Files touched: `pt-rebuild/public/js/pt_editor.js`, `pt-rebuild/public/pt_editor.html`, `pt-rebuild/supabase/migrations/20260221000001_fix_exercise_ids.sql`, `pt-rebuild/db/migrations/012_fix_exercise_ids.sql`
- Validation: 34 exercises total (unchanged). 0 old IDs remaining in `exercises`. All 11 FK constraints restored. Backup table `exercises_backup_20260221` contains 34 rows.
- Follow-ups: Drop `exercises_backup_20260221` after confirming app behavior is correct in production.
- Tags: [data-model,migration,reliability,ui]

## 2026-02-19

### 2026-02-19 — pt_editor date fields blank when editing existing exercises
- Problem: `added_date` and `updated_date` fields were blank when opening an exercise for editing, even when values existed in the database.
- Root cause: Values are stored as full ISO 8601 timestamps (e.g. `2026-02-20T00:00:00.000Z`) but `<input type="date">` requires `YYYY-MM-DD` format. Browser silently rejected the value, leaving fields blank.
- Change made: Added `toDateInput()` helper that converts any valid date value to `YYYY-MM-DD` using `new Date().toISOString().split('T')[0]`. Applied to both `addedDate` and `updatedDate` fields in `loadExerciseForEdit()`.
- Files touched: `pt-rebuild/public/js/pt_editor.js`
- Validation: Cherry-picked from branch `claude/review-public-directory-I9eT4` (commit 37c15d1). Date fields now populate correctly when editing.
- Follow-ups: None.
- Tags: [ui,data-model]

### 2026-02-19 — PT Editor archived exercise visibility toggles for Edit/Roles/Dosage selectors
- Problem: Archived exercises were always shown in PT Editor selection dropdowns, making active workflows noisier and increasing risk of picking archived items unintentionally.
- Root cause: Dropdown population/filtering logic used `allExercises` directly without lifecycle-based filtering or any user-controlled archived visibility toggle.
- Change made: Added a `Show Archived` checkbox to the exercise edit selector panel and refactored dropdown filtering/population for all three selectors (Edit, Roles, Dosage) to hide archived by default, include archived only when requested, and show archived items in a separate `Archived Exercises` section below active items. Implemented live re-render on search and toggle changes without page reload.
- Files touched: `pt-rebuild/public/pt_editor.html`, `pt-rebuild/public/js/pt_editor.js`
- Validation: Verified filtering flow in code paths for `loadExercises()`, `filterExercises()`, roles/dosage search handlers, and shared dropdown render helper now consistently applies lifecycle filtering and immediate re-render behavior.
- Follow-ups: If therapists want independent archived visibility controls per section later, split the single toggle into scoped controls while preserving current default-hidden safety behavior.
- Tags: [ui,reliability]

## 2026-02-18

### 2026-02-18 — Removed redundant client-side form parameter backfill from index.html
- Problem: `loadData()` in `index.html` made a second serial fetch to `/api/exercises` whenever any exercise in the program had an empty `form_parameters_required` array, blocking LCP and contributing to 8.4s LCP on mobile.
- Root cause: The backfill (commit `a7efd59`, 2026-01-30) was added as a workaround for RLS silently blocking patients from reading `exercise_form_parameters` via nested Supabase joins. A server-side fix (commit `4fc6973`, 78 minutes earlier) using an admin-client fetch in `programs.js` already resolved the same issue authoritatively. The client-side backfill was never removed after the server fix was confirmed working.
- Change made: Removed the `missingFormParams` block (28 lines) from `loadData()` in `index.html`. The programs API already returns correct `form_parameters_required` for all exercises via the admin client fetch in `lib/handlers/programs.js` (lines 219-235). Verified live: 12 of 33 exercises return form parameters correctly, band resistance defaults to last used value, logging modal renders all required fields.
- Files touched: `pt-rebuild/public/index.html`
- Validation: Confirmed `/api/programs` response contains correct `form_parameters_required` for all exercises with parameters. Opened Log Set modal for Ankle Inversion (TheraBand) — band_resistance field present, populated from history, defaulting to last used value ("black"). No regressions.
- Tags: [performance,lcp,cleanup]

### 2026-02-18 — Timer audio cues aligned for duration/hold and >10s start/pause voice
- Problem: `duration_seconds` timer flow diverged from `hold_seconds` behavior by announcing "Time" at completion, and long timers lacked explicit start/pause voice cues.
- Root cause: Duration completion branch in `startTimer()` had a duration-specific speech fallback, and timer controls had no threshold-gated voice announcements for start/pause actions.
- Change made: Updated duration completion speech to use `Set complete` so duration/hold share the same near-zero cue flow (countdown beeps at `3/2/1` and completion triple-beep at `0`). Added voice announcements for `Start` and `Pause` when `timerState.targetSeconds > 10`. Added `pauseTimer(announce = true)` parameter so auto-pause at completion and reset call `pauseTimer(false)` and do not produce extra pause announcements.
- Files touched: `pt-rebuild/public/index.html`
- Validation: Verified timer logic in `startTimer()`/`pauseTimer()`/`resetTimer()` now includes `speakText('Start')` and `speakText('Pause')` only for targets over 10s, keeps auto-complete and reset silent for pause voice, and retains existing countdown/completion beep behavior.
- Follow-ups: Optional UX decision: keep `Set complete` spoken for duration completion, or switch completion to sound-only for both duration and hold for strict audio parity.
- Tags: [ui,reliability]


### 2026-02-18 — DEV_NOTES converted to AI-optimized ops format
- Problem: Active TODOs, risk context, and workflow guidance were split across legacy sections, making agent handoff and consistent triage harder.
- Root cause: Historical notes evolved with mixed styles (`Remaining Work`, freeform notes, and legacy prose) and no single machine-stable open-work section.
- Change made: Added canonical top-of-file ops sections (`How to Use`, priority/risk/status enums, tag vocabulary, entry schema, migration approach), moved active outstanding work into `Open Items` (`DN-001` to `DN-006`), removed duplicated legacy `Remaining Work` block, and preserved historical entries under `Legacy Entries (Pre-Format)`. Added prose `Context` and `Constraints/Caveats` per open item for cross-agent compatibility (including Claude Code). Aligned guidance docs to the new behavior (`AGENTS.md`, `CLAUDE.md`, `DEV_PRACTICES.md`).
- Files touched: `pt-rebuild/docs/DEV_NOTES.md`, `pt-rebuild/docs/DEV_PRACTICES.md`, `pt-rebuild/AGENTS.md`, `pt-rebuild/CLAUDE.md`
- Validation: Verified `Open Items` now contains the previously active unresolved items with preserved priority and explicit risk; verified guidance references now point to `Open Items` + schema-based dated entries; confirmed legacy historical content remains intact.
- Follow-ups: Keep future updates schema-compliant and close-loop `Open Items` whenever tracked work is completed.
- Tags: [docs,reliability,migration]

### 2026-02-18 — API docs aligned to post-consolidation route model
- Problem: API documentation still mixed pre-consolidation assumptions (12-slot snapshot and debug endpoint presence) with post-change behavior, creating ambiguity for future edits and endpoint work.
- Root cause: Wrapper consolidation and `api/debug.js` removal were implemented after the original slot strategy memo and guide were written, but docs were not fully synchronized in one pass.
- Change made: Updated API strategy memo to add an implementation status section, revise inventory to 9 current API files, mark wrapper consolidation/debug removal as completed, and note query/body id routing for programs/exercises updates. Updated development guide API surface text to reflect current methods and query/body id usage, and removed stale script reference.
- Files touched: `pt-rebuild/docs/API_SLOT_STRATEGY_2026-02-17.md`, `pt-rebuild/docs/DEVELOPMENT.md`
- Validation: Re-ran `rg` checks for `/api/programs/`, `/api/exercises/`, and `/api/debug` app callsites (none remaining in `pt-rebuild/public`); verified docs now state 9-file inventory and no debug route listing.
- Follow-ups: If a dedicated messages endpoint is introduced later, update both docs in the same change set and add migration notes for callsite contract changes.
- Tags: [docs,api,reliability]

## Legacy Entries (Pre-Format)

## 2026-01-19

- **2026-01-19** — **Progress:** Implemented core tracker features in rebuilt index.html. **What was done:** (1) Added timer mode with countdown display, beeps at 5 seconds and completion, and voice announcements ("5 seconds left", "4", "3", "2", "1", "Time"). Timer counts up to show elapsed time and auto-pauses at target but allows continuing beyond. (2) Created big tappable circle for reps counting (320px diameter, iOS-optimized with scale feedback on tap). Removed +/- buttons in favor of single tap-to-increment interface with undo button. (3) Added voice countdown for reps mode - announces "5 reps left", "4 reps left", etc. when approaching target. (4) Implemented pattern modifier detection to show timer mode for `duration_seconds` and `hold_seconds` exercises, counter mode for standard reps. (5) Created `formatDosage()` function to display exercise prescriptions as "3 × 10 reps", "3 × 30 sec", "20 feet", or "3 × 10 reps (5 sec hold)" based on patient_programs data. (6) Used CSS variables (--counter-color, --counter-bg, --timer-color) for future dark mode support. (7) All interactions use data-action with pointerup events per iOS PWA requirements (no onclick handlers). **Files:** `pt-rebuild/public/index.html`. **Notes:** Timer uses Web Audio API for beeps and Web Speech API for voice - both require user interaction on iOS to initialize. Set data is saved with either reps or seconds based on mode.

- **2026-01-19** — **CRITICAL FIX: Form parameters now use normalized SQL structure.** **Problem:** Initial implementation treated form_params like Firebase JSONB object. Supabase uses normalized table `patient_activity_set_form_data` with one row per parameter (activity_set_id + parameter_name + parameter_value + parameter_unit). **What I did:** (1) Updated API `/api/logs` GET to JOIN form_data table and return `form_data: [{parameter_name, parameter_value, parameter_unit}]` array per set. (2) Updated API POST to INSERT form parameters as separate rows in `patient_activity_set_form_data` table. (3) Fixed frontend `getHistoricalParamValues()` and `getLastUsedParamValue()` to read from `set.form_data` array instead of `set.form_params` object. (4) Fixed frontend `saveLoggedSet()` to send `form_data` as normalized array instead of object. Weight/distance split into value + unit fields. **Files:** `pt-rebuild/api/logs.js`, `pt-rebuild/public/index.html`. **Why critical:** This is the correct normalized SQL approach - "one row one thing" - not like Firebase where everything was nested objects. User was right to be concerned about Firebase-like structure being unsafe in SQL.

- **2026-01-19** — **Remaining work:** (1) Exercise detail/history view - modal showing all activity logs for a specific exercise with set-by-set details. (2) Warning indicators - show "⚠️ X days ago" for exercises not done recently. (3) Terminology fixes - change "Session" to "Activity Log" throughout UI. (4) Test all features on deployed Vercel site - verify form parameters save correctly to normalized tables. **Priority:** Test on deployed site to confirm form parameters actually save/load correctly.

- **2026-01-19** — **Architecture decisions:** (1) No Firebase or JSON fallbacks in rebuild - all data comes from Supabase API endpoints. (2) Server-authoritative - Supabase PostgreSQL is source of truth, client is advisory. (3) CSS prepared for dark mode with variables but implementation deferred. (4) Following iOS PWA patterns from original (data-action, pointerup, no onclick). (5) Pattern modifiers determine UI mode: duration_seconds/hold_seconds show timer, standard exercises show counter. **Constraints:** User has autism and requires "same same same" - app must work identically to original Firebase version. No changes to clinical workflows allowed.

## 2026-01-28

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-28

- Established rebuild-specific documentation set in `/pt-rebuild/docs` covering architecture, practices, and vocabularies.

### Notes & Messages Implementation

- Added session notes modal to index.html (shows after exercise completion)
  - "Cancel" button with confirmation to discard
  - "Save & Finish" button allows saving with or without notes
  - Toast shows "Saved (with notes)" or "Saved (no notes)"
- Added clinical messages API endpoints to logs.js (merged to avoid Vercel function limit)
  - GET /api/logs?type=messages - list messages
  - POST /api/logs?type=messages - create message
  - PATCH /api/logs?type=messages&id=X - mark read/archive
  - DELETE /api/logs?type=messages&id=X - soft delete (1-hour undo window)
- Added messages modal to index.html and pt_view.html
  - Unread badge indicator
  - Time-ago formatting
  - Hide and Undo Send actions
- Enhanced pt_view.html:
  - Top Exercises section (top 10 by frequency)
  - Exercise History modal with search
  - Hamburger menu with navigation links
  - User info display (signed in as email)
  - Dark mode CSS support
  - iOS touch-action compatibility


- **2026-01-28** — **Maintenance:** Moved shared exercises/programs handlers into `pt-rebuild/lib/handlers` and updated API route wrappers to point at the shared modules to reduce serverless function duplication. **Docs:** Mirrored `/pt/docs` into `pt-rebuild/docs` for rebuild parity and added `pt-rebuild/agent.md` to summarize rebuild-specific guidance.

## 2026-01-28

- **2026-01-28** — **Docs:** Rewrote the public rebuild docs in `pt-rebuild/docs` to reflect Supabase/Vercel architecture instead of copying legacy Firebase documentation.

## 2026-01-30

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-30

### Exercise Logging Enhancements (index.html)

- **My Exercises List Improvements**
  - Added adherence display: "X days ago · Y sessions total"
  - Color-coded indicators: green (≤3 days), orange (4-7 days + ⚠️), red (8+ days + ❗)
  - Category tags displayed as pills

- **Sets Tracking Display**
  - Shows sets progress for all exercises
  - Non-sided (both): "0/3 sets"
  - Sided exercises: "Left: 0/1 · Right: 0/1" with per-side tracking
  - Target dose display

- **Control Buttons (Always Visible)**
  - Previous - undo last logged set
  - Log Set - manual entry modal (for exercises done without counter/timer)
  - Next Set - confirmation modal (user taps when done with counter/timer)

- **Next Set Modal**
  - Shows what will be logged: "X reps (target Y)"
  - Displays form parameters that will be logged
  - Buttons: Cancel / Edit / Log & Next
  - Voice comparison: "X more/less reps than last time"

- **Log Set Modal Improvements**
  - Prefills with target dose (not counter value)
  - Prefills form parameters from last-used values in exercise_logs
  - Side selector for sided exercises with progress display

- **History Editing**
  - Click history items to open Edit Session modal
  - Editable date/time picker
  - Editable sets (reps, side, form parameters)
  - Add/delete individual sets
  - Delete Session button with confirmation
  - Save Changes commits to API via PATCH /api/logs/:id

- **Bug Fixes**
  - Added touch-action: manipulation to counter display (prevents iOS double-tap zoom)
  - Added setInterval for periodic message polling (30 seconds)
  - Added UUID validation to messages API functions
  - Fixed exercise list showing "Never done" for all exercises (loadHistory now runs before renderExerciseList)

### Rehab Coverage Improvements (rehab_coverage.html)

- **Dark Mode Support**
  - Added CSS custom properties for theming
  - Added `prefers-color-scheme: dark` media query
  - Styled cards, headers, and text for dark backgrounds

- **Visual Improvements**
  - Modernized card layout with shadow and rounded corners
  - Better typography hierarchy
  - Responsive grid layout for exercise cards
  - Meaningful coverage progress bar showing actual percentage (not always full)

- **Data Display Fixes**
  - Fixed null values showing as "null" - now defaults to descriptive text
  - Shows exercise canonical names instead of IDs
  - Grouped exercises by region → capacity → focus hierarchy



- **2026-01-30** — **API:** Added exercise form parameter names to the programs payload by joining exercise form parameters and normalizing them into `form_parameters_required`, keeping the patient tracker data consistent with exercise metadata. **Files:** `pt-rebuild/lib/handlers/programs.js`.
- **2026-01-30** — **Messages:** Fixed message labeling/undo visibility by aligning client-side comparisons with `users.id` instead of auth IDs, and clarified sender/recipient labels in both patient (`index.html`) and therapist (`pt_view.html`) messaging UIs. **Also:** Ensured hidden messages are actually filtered per-user by excluding `archived_by_sender`/`archived_by_recipient` in the messages API response. **Files:** `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`, `pt-rebuild/api/logs.js`.

## 2026-01-31

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-31 (Audit Fixes)

### Deep Dive Audit - Critical Bug Fixes

Ran comprehensive audit using 3 parallel agents. Fixed critical issues:

1. **IndexedDB Transaction Bug** (`public/js/offline.js`)
   - **Problem:** `await tx.complete` doesn't exist - IndexedDB transactions use `.done` not `.complete`
   - **Fix:** Changed to `await tx.done` for proper transaction completion

2. **CSS File Reference Wrong** (`index.html`, `pt_view.html`, `rehab_coverage.html`)
   - **Problem:** Pages linked to `main.css` (16-line reset only) instead of `css/main.css` (526-line full stylesheet)
   - **Fix:** Updated all references to `/css/main.css`

3. **Missing PWA Meta Tags** (`pt_editor.html`, `pt_view.html`, `rehab_coverage.html`)
   - **Problem:** Pages missing manifest, favicon, apple-touch-icon, iOS web app meta tags
   - **Fix:** Added full PWA meta tag set to all pages

4. **requireTherapist() Missing accessToken** (`lib/auth.js`)
   - **Problem:** Unlike `requireAuth()` and `requirePatient()`, the `requireTherapist()` middleware didn't extract and attach `req.accessToken` for RLS context
   - **Fix:** Added accessToken extraction matching other middleware patterns

5. **Unhandled Async Errors** (`public/js/tracker.js`, `public/js/report.js`)
   - **Problem:** Event handlers with async operations had no try/catch - errors silently failed
   - **Fix:** Wrapped switch statements in try/catch with user-facing error messages

### New PT² Icon

- Created `public/icons/icon.svg` - Dark grey background (#333333) with white "PT" and powder blue superscript "2"
- Updated `manifest.json` to use SVG icon
- Added PWA meta tags to `index.html` with new icon

---


#### Source: ## 2026-01-31

### Simplified Lifecycle UI and Fixed Data Consistency (pt_editor.html)

- **Problem:** pt_editor had both a checkbox AND a dropdown for archived status, plus "deprecated" option nobody understood. Database had inconsistent data (some exercises had `lifecycle_status: null`, one had `archived: false` but `lifecycle_status: 'archived'`).
- **What I did:**
  - **Database fix:** Updated all exercises to have consistent `lifecycle_status` ('active' or 'archived') matching `archived` boolean
  - **UI simplification:** Removed redundant checkbox, removed "deprecated" option, kept only Active/Archived dropdown
  - **Code fix:** `lifecycle_status` now always defaults to 'active', never null
  - Added helper text explaining archived exercises are hidden from trackers and coverage

### Archived Exercises Showing in Rehab Coverage (rehab_coverage.html)

- **Problem:** Archived exercises (like "Wipers") were still appearing in the rehab coverage page.
- **What I did:** Updated `/api/roles` to filter out archived exercises.
  - Added `!inner` join to exercises table to enable filtering
  - Added `.eq('exercises.archived', false)` filter to the query
  - Now only active (non-archived) exercises appear in coverage analysis

### Sign Out Error "Auth Session missing" (pt_editor.html)

- **Problem:** After signing out from pt_editor.html hamburger menu on iOS, page reload showed "Token sign-in failed: Auth Session missing!" error.
- **What I did:** Fixed `signOut()` in `public/js/pt_editor.js` to clear stored auth tokens BEFORE calling `supabaseClient.auth.signOut()`.
  - Root cause: `index.html` stores auth tokens in `pt_editor_auth` localStorage key when navigating to pt_editor
  - On reload after sign out, `init()` found stale tokens and tried to use them with `setSession()`
  - Supabase returned "Auth Session missing" because the session was already invalidated
  - Fix: Call `clearStoredAuth()` before `signOut()` to remove stale tokens

### Form Parameters Not Showing in Log Set Modal (index.html)

- **Problem:** When logging sets, the fields for required form parameters (weight, band resistance, etc.) were not appearing.
- **What I did:** Fixed the priority order in `normalizeProgramPatternModifiers()` in `lib/handlers/programs.js`.
  - Root cause: RLS policies may block patients from reading `exercise_form_parameters` via nested Supabase joins
  - The nested query silently returns `[]`, but code was preferring it over the admin-fetched fallback
  - Changed logic to always prefer admin-fetched form params (RLS-safe) over nested query result
  - Added logging to help diagnose if form params are missing from database

### Rehab-Focused pt_view.html Overhaul

- **Problem:** pt_view.html was using gym-style metrics (Total Sessions, Total Sets, Top Exercises) inappropriate for physical therapy rehab tracking. Session notes from patients were buried and hard to find.
- **What I did:** Complete overhaul to make the page rehab-focused.
  - **Patient Notes Section:** Added prominent alert-styled section at TOP of page
    - Yellow/orange border-left styling to grab attention
    - Shows sessions with notes from past 7 days
    - Concerning words (pain, sharp, couldn't, etc.) are highlighted in red
    - Each note shows date, exercise name, and note text in quotes
  - **Rehab Metrics:** Replaced gym metrics with rehab-appropriate ones
    - "Days Active" (X/7) - emphasizes consistency over volume
    - "Exercises Covered" (X/Y) - breadth over depth
    - "Needs Attention" count - shows overdue exercises
  - **Needs Attention Section:** Replaced "Top Exercises" with exercises not done in 7+ days
    - Color-coded urgency: orange (7-10 days), red (11+ days)
    - Shows days since last done
    - Prioritizes HIGH contribution exercises

### PT Tracker Link in Hamburger Menu (pt_editor.html)

- **Problem:** Admin/therapist users who also have exercises assigned couldn't see the PT Tracker link in the hamburger menu.
- **What I did:** Updated HamburgerMenu module and pt_editor.js to check if user has programs assigned.
  - Added `showTrackerLink` option to HamburgerMenu.init() for explicit control
  - pt_editor.js now fetches user's programs and shows PT Tracker link if any exist
  - This allows therapists/admins who are also patients to access their tracker

### Coverage Legend & Metrics Display (rehab_coverage.html)

- **Problem:** Users couldn't understand what the bar colors, widths, and opacities meant.
- **What I did:** Added explanatory elements throughout the page.
  - Collapsible legend card explaining the THREE SIGNALS (width=7d density, color=recency, opacity=21d trend)
  - Exercise cards now show "7d: X · 21d: Y" session counts
  - Capacity bars show subtitle: "X% weekly • recency text • Y% trend"
  - Fixed 21-day trend summary to use average opacity (was incorrectly using binary "done once" count)

### Hamburger Menu for pt_editor.html

- **Problem:** pt_editor.html had no hamburger menu for navigation, unlike other pages.
- **What I did:** Added consistent hamburger menu with navigation links.
  - Created shared module `/js/hamburger-menu.js` for reusable menu functionality
  - Created shared styles `/css/hamburger-menu.css` for consistent appearance
  - Menu includes: PT Tracker (if patient), View History, Coverage Analysis, Reload, Sign Out
  - Displays signed-in user email
  - Uses `data-action` pattern for iOS Safari/PWA compatibility
  - HamburgerMenu.init() accepts config for currentUser, signOutFn, and custom action handlers

### Exercise Details Modal (index.html)

- **Problem:** Patients had no way to view exercise guidance, target muscles, or equipment info from the tracker.
- **What I did:** Added ℹ️ info button to each exercise card that opens a details modal.
  - Button positioned top-right of card with `data-stop-propagation` to prevent triggering exercise selection
  - Modal displays: description, pattern (sided/bilateral), primary/secondary muscles, equipment, and guidance sections (external cues, motor cues, compensation warnings, safety flags)
  - Uses `data-require-self` pattern for backdrop click-to-close
  - Follows pt_tracker.html detail display pattern for consistency
  - Added CSS for `.details-btn`, `.pill`, `.detail-section` classes



- **2026-01-31** — **Deep dive audit and critical fixes.** **Problems found:** (1) IndexedDB transaction bug - `await tx.complete` doesn't exist, transactions use `.done`. (2) Unsafe destructuring of API responses could crash on undefined. (3) All 13 inline onclick handlers in pt_editor.html unreliable on iOS Safari/PWA. (4) Missing PWA meta tags on pt_editor, pt_view, rehab_coverage. (5) `requireTherapist()` in auth.js missing accessToken attachment. (6) Supabase SDK loaded from CDN caused tracking prevention warnings. **What I did:** (1) Fixed IndexedDB bug in offline.js line 132. (2) Added fallback patterns (`|| []`) to all unsafe destructuring in offline.js, report.js, index.html. (3) Converted all onclick/oninput/onchange handlers to data-action + pointerup pattern with bindPointerHandlers() and bindInputHandlers(). (4) Added PWA meta tags including new `mobile-web-app-capable` standard. (5) Fixed requireTherapist() and added requireTherapistOrAdmin() as separate function. (6) Self-hosted Supabase SDK to `/js/vendor/supabase.min.js` and created GitHub Action `.github/workflows/update-supabase-sdk.yml` to auto-update monthly. **Files:** `offline.js`, `report.js`, `index.html`, `pt_editor.html`, `pt_view.html`, `rehab_coverage.html`, `sw.js`, `lib/auth.js`.

- **2026-01-31** — **Voice announcements and UI improvements.** **What I did:** Added "Working left side" / "Working right side" voice announcement when selecting side for bilateral exercises. Added "All sets complete" announcement when finishing all sets (with flag to prevent repeat announcements). Fixed exercise list to show "Done today" immediately after logging by adding to allHistory array and re-rendering. **Files:** `pt-rebuild/public/index.html`.

- **2026-01-31** — **Cleanup:** Deleted unused files `tracker.html` and `pt_tracker.html` (legacy Firebase version still exists in `/pt`). Updated `sw.js` cache to v6 with correct asset list including self-hosted Supabase SDK.

- **2026-01-31** — **New icon:** Created PT² icon variant (dark grey background #333, white "PT", powder blue superscript "2") to distinguish rebuild from original `/pt` app on iOS home screen. **Files:** `icons/icon.svg`, `manifest.json`.

## 2026-02-01

- **2026-02-01** — **Problem:** Duration timer exercises logged 0 seconds instead of actual elapsed time when timer reached 0. **What I did:** When duration timer hits 0, the code was resetting `timerState.elapsedMs = 0`, so `confirmNextSet()` captured 0 instead of actual time. Fixed by setting `timerState.elapsedMs = timerState.targetSeconds * 1000` when duration completes, preserving the actual elapsed time for logging. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-01** — **Problem:** Form parameters (band_resistance, weight, etc.) and pattern modifiers (hold_seconds, duration_seconds, distance_feet) not displayed in history views. **What I did:** (1) Updated `renderHistory()` in index.html to show sets summary with reps/seconds/distance (e.g., "3 sets: 10r, 10r × 30s") and form params from first set. (2) Updated pt_view.html compact summary to show combined reps×seconds format and form params. (3) Updated pt_view.html expanded set details to include form_data with format "parameter_name: value unit". **Files:** `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** rehab_coverage.html calling non-existent `/api/users/me` endpoint causing 404 error. **What I did:** Instead of creating new API endpoint (Vercel function limit), added `user_role` field to existing `/api/roles` GET response since auth middleware already loads user role. Updated rehab_coverage.html to extract role from roles response in `loadData()` instead of separate API call. **Files:** `pt-rebuild/api/roles.js`, `pt-rebuild/public/rehab_coverage.html`.

- **2026-02-01** — **Problem:** pt_view.html showing incorrect "Exercises" count (16/16 instead of X/30) and "All exercises up to date" when exercises were overdue. Root cause: (1) `/api/programs` requires `patient_id` but pt_view wasn't passing it. (2) For therapists, `/api/logs` without `patient_id` defaults to therapist's own ID (no logs). **What I did:** (1) Added `viewingPatientId` variable set in `loadCurrentUserProfile()` - for therapists, finds their patient from users list; for patients, uses own ID. (2) Modified `loadData()` to pass `patient_id` to both `/api/logs` and `/api/programs`. (3) Fixed `calculateNeedsAttention()` to get exercise names from `program.exercises?.canonical_name` (nested API structure). **Files:** `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** Therapists and admins could only see their own user record due to restrictive RLS policy `users_select_own`. `/api/users` was returning only 1 user, so therapists couldn't find their assigned patients. **What I did:** (1) Updated `/api/users.js` to use admin Supabase client (bypasses RLS) with application-level filtering: admins see all users, therapists see themselves + patients where `therapist_id` matches their ID, patients see only themselves. (2) Created RLS migration `005_users_rls_policy_update.sql` with new policy `users_select_by_role` that allows therapists to see patients assigned to them and admins to see all users. **Files:** `pt-rebuild/api/users.js`, `pt-rebuild/db/migrations/005_users_rls_policy_update.sql`.

- **2026-02-01** — **Problem:** Archived exercises still appearing in exercise lists across all views. **What I did:** Added filter `.filter(p => !p.exercises?.archived)` when loading programs in pt_view.html. **Files:** `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** rehab_coverage.html showing checkmarks for exercises done >7 days ago instead of warning icons. **What I did:** Updated status icon logic to show ⚠ warning symbol (orange) for exercises either never done or done 7+ days ago, checkmark (green) only for exercises done within 7 days. **Files:** `pt-rebuild/public/rehab_coverage.html`.

## 2026-02-04

- **2026-02-04** — **Problem:** Editing or deleting logged exercises returned 404 errors. The frontend was calling `/api/logs/${id}` with PATCH/DELETE methods, but the API only supported these methods for messages (`type=messages`), not for activity logs. **What I did:** (1) Added `updateActivityLog()` and `deleteActivityLog()` handlers to `/api/logs.js` that handle PATCH and DELETE requests when `id` query parameter is provided. (2) Updated frontend `saveEditSession()` and `deleteSession()` functions to use `/api/logs?id=X` query parameter format instead of path-based `/api/logs/${id}`. The update handler replaces all sets (deletes existing sets and form_data, then inserts new ones). **Files:** `pt-rebuild/api/logs.js`, `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** LOG SET for exercises with `hold_seconds` pattern modifier logged a single REP instead of a complete SET. The modal only asked for reps count, not hold time. **What I did:** (1) Added a second input field (`logSetTimeInput`) to the Log Set modal for entering seconds per rep. (2) Updated `showLogSetModal()` to show the time input and prefill it with target hold time when exercise has `hold_seconds`. (3) Updated `saveLoggedSet()` to detect manual hold entry (when time input is visible) and create a complete SET with both reps and seconds, bypassing the rep-by-rep timer flow. Manual entries are marked with `manual_log: true`. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** Edit Session modal didn't show seconds/time or distance fields for exercises with those pattern modifiers (`hold_seconds`, `duration_seconds`, `distance_feet`). Only showed reps and side. **What I did:** (1) Updated `renderEditSessionSets()` to detect exercise type and show appropriate fields: seconds input for hold/duration exercises, distance input for distance exercises. Labels adapt to context ("Seconds/rep" for hold, "Seconds" for duration). (2) Updated `saveEditSession()` to collect values from `.edit-set-seconds` and `.edit-set-distance` inputs. (3) Updated `addEditSessionSet()` to pre-fill default seconds/distance values based on exercise prescription. (4) Fixed history display format to always show reps/seconds/distance when present using compact format: "10r × 5s", "30s", "20ft". **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** Exercise details modal only showed description and pattern, not equipment, muscles, or guidance/cues. Root cause: The `/api/programs` endpoint was trying to select `equipment`, `primary_muscles`, `secondary_muscles`, `guidance` as columns from the `exercises` table, but these don't exist as columns - they're stored in separate related tables (`exercise_equipment`, `exercise_muscles`, `exercise_guidance`). **What I did:** (1) Updated `/api/programs` query to use nested selects for the related tables: `exercise_equipment(equipment_name, is_required)`, `exercise_muscles(muscle_name, is_primary)`, `exercise_guidance(section, content, sort_order)`. (2) Updated `normalizeProgramPatternModifiers()` to transform these nested arrays into the format the frontend expects: `equipment: {required: [...], optional: [...]}`, `primary_muscles: [...]`, `secondary_muscles: [...]`, `guidance: {motor_cues: [...], compensation_warnings: [...], safety_flags: [...], external_cues: [...]}`. **Files:** `pt-rebuild/lib/handlers/programs.js`.

- **2026-02-04** — **Problem:** History display didn't show side information for sided exercises, and side selector wasn't shown if exercise wasn't found in allExercises. **What I did:** (1) Updated history `setsSummary` to append "(L)" or "(R)" for sets with side data. (2) Updated `openEditSessionModal()` to detect `isSided` from either exercise pattern OR presence of side data in existing sets, ensuring side selector appears even if exercise lookup fails. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **PWA Offline Support Implementation.** **Problem:** App was intended to work offline as a PWA, but data didn't persist to IndexedDB. The `OfflineManager` class existed in `/js/offline.js` but wasn't wired up to `index.html`. **What I did:** (1) Fixed `offline.js` to use proper native IndexedDB patterns (added `_waitForTransaction()` helper, fixed transaction completion handling). (2) Wired up `OfflineManager` in `index.html`: imports module, initializes on app start, sets up online/offline event listeners. (3) Implemented offline-only cache: when offline, loads from IndexedDB; when online, fetches from API directly (no stale-then-refresh pattern which would cause jarring re-renders and scroll position loss). (4) Added auto-sync on reconnection: when coming back online, syncs pending queue items and refreshes cache. (5) Added `updateSyncStatusUI()` function showing sync badge states: red for pending items, gray for offline. (6) Updated `/api/sync.js` to write to `offline_mutations` table for server-side audit. (7) Cache hydration happens in background after successful API load. **Architecture:** Online: API fetch → render once → hydrate cache in background. Offline: IndexedDB cache → render once. Auto-sync: online event → sync pending queue → hydrate cache. **Files:** `pt-rebuild/public/js/offline.js`, `pt-rebuild/public/index.html`, `pt-rebuild/api/sync.js`.

## 2026-02-16

### Security Hardening (Low-Risk Only)

All changes are low-risk, non-breaking hardening. Medium/high-risk items deferred (see Remaining Work below).

- **2026-02-16** — **Removed hardcoded Supabase fallback credentials from `pt_editor.js`.** The client-side editor had `FALLBACK_SUPABASE_URL` and `FALLBACK_SUPABASE_ANON_KEY` constants used when `/api/env` failed. Removed these and replaced with an explicit `throw new Error(...)` so a config failure is visible rather than silently using stale credentials. **Files:** `pt-rebuild/public/js/pt_editor.js`.

- **2026-02-16** — **Restricted `/api/debug` endpoint to admin role only.** Previously any authenticated user could call `GET /api/debug` and see their full user context object. Now returns 403 for non-admins. **Files:** `pt-rebuild/api/debug.js`.

- **2026-02-16** — **Cached admin Supabase client as singleton in `db.js`.** The anon client was already cached, but `getSupabaseAdmin()` created a new `createClient()` instance on every call. Now uses `supabaseAdminClient` singleton matching the anon client pattern. **Files:** `pt-rebuild/lib/db.js`.

- **2026-02-16** — **Added error checks on delete operations in `logs.js` update path.** The `updateActivityLog()` PATCH handler deleted existing sets and form_data before inserting replacements, but never checked the delete results. If deletes failed silently, subsequent inserts would create duplicate sets. Now checks `formDeleteError` and `setsDeleteError` and throws on failure. **Files:** `pt-rebuild/api/logs.js` (lines 357-371).

- **2026-02-16** — **Stripped `error.message` from all 500 responses in production.** 25 instances across 8 API files were leaking internal error details (stack traces, DB error messages) to clients. Changed all to `details: process.env.NODE_ENV === 'development' ? error.message : undefined` so details only appear in dev mode. **Files:** `api/logs.js`, `api/vocab.js`, `api/roles.js`, `api/reference-data.js`, `api/users.js`, `lib/handlers/exercises.js`, `lib/handlers/programs.js`.

- **2026-02-16** — **Deleted dead code files `tracker.js` and `report.js`.** Verified zero HTML references and zero `import` statements across the entire `public/` directory. Removed from `sw.js` STATIC_ASSETS list and bumped service worker cache to v7 to force clients to drop the stale cached copies. **Files:** deleted `public/js/tracker.js`, deleted `public/js/report.js`, `public/sw.js`.

### Read Receipts Feature

- **2026-02-16** — **Added `read_at` timestamp column to `clinical_messages`.** Created migration `011_add_message_read_at.sql` (idempotent with `IF NOT EXISTS`). Column was also added directly to live Supabase DB by user, so migration is documentation/safety net only. Updated `schema.sql` to match live DB (also added `sent_at` column that existed in live DB but was missing from repo schema). **Files:** `db/migrations/011_add_message_read_at.sql`, `db/schema.sql`.

- **2026-02-16** — **Added `supabase_schema.sql` to repo.** User exported live Supabase schema and committed to main. Merged into feature branch. This file is the authoritative reference for live DB state. **Files:** `db/supabase_schema.sql` (from main).

- **2026-02-16** — **Wired up server-side read tracking in `logs.js` `updateMessage()`.** When `PATCH` is called with `{ read: true }`, the handler now also sets `read_at` to the current timestamp — but only on first read (never overwritten, never cleared). The existing `read_by_recipient` boolean still gets set/unset normally. **Files:** `api/logs.js` (lines 661-667).

- **2026-02-16** — **Wired up read receipts in both frontend views.** (1) **Mark as read server-side:** When messages modal opens, `markReceivedMessagesAsRead()` fetches all messages, finds unread ones where current user is the recipient, and fires PATCH `{ read: true }` for each (fire-and-forget, non-blocking). (2) **Display read status on sent messages:** Each sent message now shows "Read [local datetime]" in green (using existing `formatMessageDateTime()` which uses local timezone) or "Delivered" in grey if unread. Read receipt appears bottom-right of the message card. **Files:** `public/index.html`, `public/pt_view.html`.

---


### Reference: Live DB vs Repo Schema

The file `db/supabase_schema.sql` is the authoritative live DB export. The file `db/schema.sql` is the repo's CREATE TABLE script (used for documentation and fresh deploys). These should be kept in sync. As of 2026-02-16 they match, including the `read_at` and `sent_at` columns on `clinical_messages`.

- **2026-02-17** — **Documentation:** Added `docs/API_SLOT_STRATEGY_2026-02-17.md` to preserve a risk-weighted API slot allocation analysis (current endpoint usage, callsite mapping, and cost-vs-benefit recommendations for merges/splits under Vercel free-tier limits) so future local Codex runs can reuse findings without repeating discovery.
- **2026-02-17** — **API slot consolidation + debug removal.** Consolidated route wrappers by removing `api/programs/[id].js` and `api/exercises/[id].js`, keeping `api/programs/index.js` and `api/exercises/index.js` as single entry points backed by shared handlers. Updated frontend update callsites to use query-param IDs (`/api/programs?id=...`, `/api/exercises?id=...`) so PUT/DELETE continue to resolve through handler ID fallback (`req.query.id` / body `id`). Removed `api/debug.js` to reclaim another function slot. **Validation:** confirmed no remaining `/api/programs/` or `/api/exercises/` path-param callsites in `public/`, and no `/api/debug` app callsites. **Files:** `pt-rebuild/public/js/pt_editor.js`, `pt-rebuild/api/programs/[id].js` (deleted), `pt-rebuild/api/exercises/[id].js` (deleted), `pt-rebuild/api/debug.js` (deleted), `pt-rebuild/docs/DEVELOPMENT.md`.



- **2026-02-17** — **Offline queue write integrity fix.** `addToQueue()` now resolves on IndexedDB transaction completion and only reports success after commit. **Files:** `pt-rebuild/public/js/offline.js`.
