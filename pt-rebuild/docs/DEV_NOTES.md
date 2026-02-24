# PT Tracker Rebuild - Public Dev Notes

This file is generated from `docs/dev_notes.json`. Do not hand-edit this Markdown.

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
- [Closed Items](#closed-items)

## How to Use This File
- Canonical source of truth: `docs/dev_notes.json`.
- Run `npm run dev-notes:build` after JSON updates.
- `open_items`: active work queue — statuses `open`, `in_progress`, `blocked` only.
- `closed_items`: completed items — status `done` only.
- `in_progress`: item is actively being worked on this session.
- `blocked`: cannot proceed; must include a `constraints_caveats` note explaining the blocker.
- Close-loop rule: when an item is resolved, move it from `open_items` to `closed_items` (set status to `done`, add `resolved` date) and fill all six narrative fields on the closed item: `problem`, `root_cause`, `change_made`, `files_touched`, `validation`, and `follow_ups`.

## Priority Levels
- `P0`: Critical: production-breaking or patient-safety/security risk; address immediately.
- `P1`: High: major functionality degraded or high regression risk; schedule next.
- `P2`: Normal: meaningful improvement or bugfix; prioritize with roadmap context.
- `P3`: Low: polish, cleanup, or non-urgent enhancement.

## Risk Levels
- `high`: Likely to cause data loss, auth bypass, or severe workflow failure if wrong.
- `medium`: Could disrupt workflows or require manual recovery; moderate blast radius.
- `low`: Limited impact; straightforward rollback/recovery expected.

## Status Values
- `open`: Tracked and ready for intake/execution.
- `in_progress`: Actively being implemented or investigated.
- `blocked`: Cannot proceed pending dependency/decision/access.
- `done`: Completed and close-looped with dated entry.

## Tag Vocabulary
- `ui`: Interface/UX behavior and rendering.
- `ios`: Apple device or Safari-specific behavior.
- `pwa`: Progressive web app install/offline shell concerns.
- `offline`: Offline queueing/sync and local persistence paths.
- `supabase`: Supabase platform, SQL, RLS, or client usage.
- `auth`: Authentication/authorization concerns.
- `sync`: Sync pipeline and idempotent mutation handling.
- `data-model`: Schema, relationships, or record-shape correctness.
- `api`: Serverless endpoint logic and request/response behavior.
- `performance`: Latency, throughput, or resource-usage optimization.
- `reliability`: Fault tolerance, retries, and consistency guarantees.
- `security`: Access control, privacy, and exploit prevention.
- `migration`: Database/data migration planning and execution.
- `docs`: Documentation or workflow process updates.
- `cleanup`: Refactors, debt paydown, and housekeeping.
- `email`: Notification or email delivery behavior.
- `lcp`: Largest Contentful Paint and first-render metrics.
- `notifications`: In-app or push notification behavior.

## Entry Schema
Closed items must include all six narrative fields:
- `problem`
- `root_cause`
- `change_made`
- `files_touched`
- `validation`
- `follow_ups`

## Migration Approach
- Active TODOs are tracked in `open_items`. Completed items live in `closed_items`.
- Legacy pre-structured notes are archived in `docs/HISTORY.md` and are not machine-processed.

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
- [ ] DN-012 | status:open | priority:P2 | risk:low | tags:[ui] | file:pt-rebuild/public/index.html | issue:No way to reorder exercises on the patient index page — currently sorted by program assignment order from the API.
  - Context: User needs the ability to control the display order of exercises (e.g. by body region, by recency, by custom sort). Currently exercises render in whatever order the server returns them.
  - Constraints/Caveats: Sort preference should persist across sessions (localStorage or user profile). Must not affect the underlying program data, only display order.
- [ ] DN-015 | status:open | priority:P2 | risk:low | tags:[ui,auth,reliability] | file:pt-rebuild/public/index.html,pt-rebuild/public/pt_view.html | issue:Hamburger menu sometimes shows "Signed in as -" (dash) instead of the user's name on page load.
  - Context: User name is populated after the users API call resolves. On slow loads or when the menu is opened before the API response arrives, the name placeholder "-" is visible instead of the real name.
  - Constraints/Caveats: Investigate whether the menu renders before `me` is resolved and whether a re-render or reactive update is needed once the name is available.
- [ ] DN-016 | status:open | priority:P2 | risk:medium | tags:[ui,auth,api] | file:pt-rebuild/api/users.js,pt-rebuild/public | issue:No user profile editor — users cannot change their own name, email, or password from within the app.
  - Context: Currently `PATCH /api/users` only accepts `email_notifications_enabled`. A profile editor would allow users to update `first_name`, `last_name`, email (requires Supabase Auth update), and password (requires Supabase Auth password change flow). Admin may also need ability to edit other users' profiles.
  - Constraints/Caveats: Email/password changes must go through Supabase Auth API (`supabase.auth.updateUser()`), not just the `users` table. Need to consider whether therapist can edit patient profiles or only admins can.
- [ ] DN-019 | status:open | priority:P1 | risk:medium | tags:[security,auth,api,reliability] | file:pt-rebuild/api/logs.js | issue:Clinical message creation (`POST /api/logs?type=messages`) validates recipient existence but does not enforce therapist↔patient relationship constraints.
  - Context: Current logic allows any authenticated caller to target any existing `users.id` as `recipient_id` if RLS permits the insert. The intended messaging model is patient-therapist communication, so relationship checks should mirror assignment rules used elsewhere.
  - Constraints/Caveats: Define and preserve intended matrix explicitly (patient→assigned therapist only; therapist→assigned patient only; admin behavior defined). Verify against current `clinical_messages` RLS policy bodies before tightening endpoint logic.
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

## Closed Items
- [x] DN-013 | status:done | priority:P2 | risk:low | tags:[ui] | file:pt-rebuild/public/index.html | issue:History view on index does not show notes; pt_view.html shows notes on log entries but index.html does not. | resolved:2026-02-23
  - Problem: The patient index history list did not show session notes even though notes were fetched with activity log records. `pt_view.html` already displayed inline notes, but `index.html` omitted them.
  - Root cause: `renderHistory()` in `index.html` rendered date, exercise, set summary, and optional form parameters, but never appended `log.notes` to the history card template.
  - Change made: Updated `renderHistory()` in `index.html` to render notes inline when present, using the same quoted-note pattern as `pt_view.html` and `escapeHtml(log.notes)` for safe output. No API, auth, recipient, or interaction flow changes were made.
  - Files touched: pt-rebuild/public/index.html, pt-rebuild/docs/dev_notes.json, pt-rebuild/docs/DEV_NOTES.md
  - Validation: Verified updated history template now includes conditional notes markup (`notesInlineHtml`) and appends it to each session card. Confirmed existing set summary/form parameter rendering remains unchanged. Ran `npm run dev-notes:build` and `npm run dev-notes:check` successfully.
  - Follow-ups: None.
- [x] DN-018 | status:done | priority:P2 | risk:medium | tags:[offline,api,reliability] | file:pt-rebuild/api/sync.js,pt-rebuild/public/js/offline.js,pt-rebuild/public/index.html | issue:Two competing offline sync systems exist — the active one (localStorage + `/api/logs` per item in index.html) and a dead one (`offline.js` IndexedDB queue + `/api/sync` batch endpoint). `manualSync()` in offline.js is never called; `/api/sync` is reachable but unused by any UI flow. | resolved:2026-02-23
  - Problem: Two competing offline sync systems existed: the active one (localStorage queue + syncOfflineQueue() → POST /api/logs per item in index.html) and a dead one (IndexedDB queue + manualSync() in offline.js → POST /api/sync). manualSync() was never called from any UI flow. /api/sync was reachable but unused, occupying one of 12 Vercel free-tier function slots. The IndexedDB parts of offline.js were legitimately used for read caching (exercises, programs, logs).
  - Root cause: The IndexedDB-based sync system was built but never wired into the UI. The localStorage-based system in index.html became the de-facto implementation. Both systems coexisted, creating confusion for agents and risk of accidental reactivation of the dead path.
  - Change made: Chose Option A: removed the dead queue/sync code. Deleted api/sync.js entirely (frees one Vercel function slot). Stripped addToQueue, getQueueItems, createAutoExport, manualSync, getQueueCount, getSyncMetadata, setSyncMetadata from offline.js. Removed offline_queue, auto_exports, sync_metadata IndexedDB stores from onupgradeneeded — bumped DB_VERSION from 1 to 2 so the upgrade handler drops those stores from existing browsers. Kept all read-caching code (hydrateCache, getCachedExercises, getCachedPrograms, getCachedLogs) unchanged. Updated file header comment to accurately describe offline.js as a read cache only.
  - Files touched: pt-rebuild/api/sync.js (deleted), pt-rebuild/public/js/offline.js (dead queue/sync methods removed, DB_VERSION bumped to 2), pt-rebuild/public/index.html (removed stale getSyncMetadata call in initOfflineManager that caused console error on load)
  - Validation: Verified all callers of removed methods — none exist in index.html or any other file. Active sync path (syncOfflineQueue in index.html) untouched. Caching methods (getCachedExercises etc.) still present and unchanged. Preview deployment tested: exercises load, Log Set modal works, history loads, Sync Now shows 'Nothing to sync', unsynced badge shows/clears correctly, zero /api/sync calls in network traffic. PR #315 merged to main.
  - Follow-ups: None.
- [x] DN-020 | status:done | priority:P2 | risk:low | tags:[api,reliability] | file:pt-rebuild/api/logs.js | issue:Type safety bug in message validation — `recipient_id?.trim()` / `body?.trim()` can throw before try/catch when payload fields are non-strings. | resolved:2026-02-23
  - Problem: `POST /api/logs?type=messages` validated required fields with `recipient_id?.trim()` and `body?.trim()` before entering `try/catch`. Non-string payloads (number/object/null) could throw `TypeError`, resulting in an unhandled 500 path instead of a controlled 400 validation response.
  - Root cause: Validation assumed string types and relied on optional chaining with `.trim()`, which does not protect against non-string truthy values (for example objects) that do not implement `trim`.
  - Change made: Updated `createMessage()` in `api/logs.js` to use strict type-safe required-field guards: `typeof recipient_id === 'string' && recipient_id.trim().length > 0` and `typeof body === 'string' && body.trim().length > 0`. Kept the existing 400 error shape/message (`Missing required fields: recipient_id, body`), preserved UUID validation and insert/auth logic, and made no frontend/UI changes to recipient selection flows.
  - Files touched: pt-rebuild/api/logs.js, pt-rebuild/docs/dev_notes.json, pt-rebuild/docs/DEV_NOTES.md
  - Validation: Confirmed new guards exist in `createMessage()` and preserve existing error text; verified syntax with `node --check api/logs.js`; ran `npm run dev-notes:build` and `npm run dev-notes:check` successfully.
  - Follow-ups: DN-019 remains deferred by deployment scope decision (two-user deployment).
- [x] DN-021 | status:done | priority:P2 | risk:medium | tags:[api,reliability,ui] | file:pt-rebuild/api/roles.js,pt-rebuild/public/js/pt_editor.js,pt-rebuild/vercel.json | issue:Potential route mismatch for role deletion — frontend calls `DELETE /api/roles/:id`, while deployment routing may only map file-based `/api/roles`. | resolved:2026-02-23
  - Problem: Dev note flagged that `DELETE /api/roles/:id` might fail in Vercel because there is no explicit rewrite for the nested path in vercel.json — only file-based routing for `/api/roles`.
  - Root cause: Investigation revealed this is not a bug. Vercel's file-based routing passes the full request URL to the handler, so `req.url` inside `roles.js` is `/api/roles/<uuid>`. The handler already splits on `/` and takes the last segment, with an explicit guard `roleId !== 'roles'` confirming the author accounted for this. No rewrite is needed.
  - Change made: No code change. Closed DN-021 as confirmed-working after code review of `roles.js` handler, `pt_editor.js` call site, and `vercel.json`.
  - Files touched: None.
  - Validation: Code path traced: `req.url.split('?')[0].split('/')` on `/api/roles/abc-123` yields `['', 'api', 'roles', 'abc-123']`; last element is the UUID. Guard `roleId !== 'roles'` correctly rejects bare `/api/roles` DELETE attempts.
  - Follow-ups: None.
- [x] DN-025 | status:done | priority:P1 | risk:low | tags:[auth,supabase,ui] | file:pt-rebuild/public/reset-password.html | issue:Password reset link always shows 'Invalid or Expired Link' — Supabase client clears the URL hash on createClient(), so the type=recovery check always finds an empty hash. | resolved:2026-02-23
  - Problem: Clicking a valid, freshly-issued password reset link on pttracker.app immediately showed 'Invalid or Expired Link'. The Supabase verify endpoint redirected correctly to /reset-password.html, but the page rejected every token.
  - Root cause: The Supabase JS client (implicit flow) calls history.replaceState to strip the hash tokens from the URL the moment createClient() is called. The old code read window.location.hash after createClient(), so it always found an empty hash (#) and the type !== 'recovery' guard triggered showInvalid() on every valid link. This was a latent bug present before the pttracker.app domain move — it never worked.
  - Change made: Moved the window.location.hash capture to the very top of init(), before fetch('/api/env') and createClient(). The hash is intact at that point; after createClient() processes it, the captured value is still used for the type check.
  - Files touched: pt-rebuild/public/reset-password.html
  - Validation: Code path reviewed: hash is read synchronously before any async calls or client initialization. getSession() after createClient() still returns the recovery session established from the hash tokens.
  - Follow-ups: None.
- [x] DN-026 | status:done | priority:P1 | risk:low | tags:[security,supabase,api] | file:pt-rebuild/db/migrations/015_fix_activity_log_rpc_search_path.sql | issue:Function public.create_activity_log_atomic has a mutable search_path — Supabase security advisor flag. | resolved:2026-02-23
  - Problem: Supabase security advisor flagged `public.create_activity_log_atomic` for having a mutable search_path. Without an explicit SET search_path, a malicious actor who can create objects in a schema earlier in the default search path could potentially redirect function calls to shadow objects.
  - Root cause: The function was created without `SET search_path = public, pg_temp` or explicit `SECURITY INVOKER` declaration, leaving search path resolution at runtime rather than function-definition time.
  - Change made: Replaced the function with `CREATE OR REPLACE` adding `SECURITY INVOKER` and `SET search_path = public, pg_temp`. No logic changes — identical behavior, locked search path.
  - Files touched: pt-rebuild/db/migrations/015_fix_activity_log_rpc_search_path.sql (new). Applied directly to DB via Supabase MCP.
  - Validation: Migration applied successfully. Function signature and behavior unchanged — existing callers in logs.js and sync.js unaffected.
  - Follow-ups: None.
- [x] DN-027 | status:done | priority:P3 | risk:low | tags:[docs,cleanup] | file:pt-rebuild/docs/dev_notes.json,pt-rebuild/scripts/generate-dev-notes.mjs | issue:Remove redundant  field from dev_notes.json — it duplicates  and is drift-prone. | resolved:2026-02-23
  - Problem: All open_items in dev_notes.json carried a 'checkbox' field ('open'/'done') that duplicated the 'status' field. The generator already derived checkbox state from 'status' and 'resolved', making the field pure noise. It was also drift-prone — proven when DN-018 had mismatched checkbox/status values after a partial update.
  - Root cause: The field was originally added as a user-facing display marker before the JSON schema matured. Once 'status' became the canonical source of truth, 'checkbox' became redundant but was never cleaned.
  - Change made: Removed 'checkbox' from all 26 items in open_items. Updated generate-dev-notes.mjs to derive checked state from 'status === done || Boolean(resolved)' only. Bumped schema_version to 1.4.0.
  - Files touched: pt-rebuild/docs/dev_notes.json (26 items updated, schema 1.3.0 → 1.4.0), pt-rebuild/scripts/generate-dev-notes.mjs (checkbox fallback removed from renderOpenItem)
  - Validation: Ran dev-notes:build — output identical structure, all checkboxes render correctly from status/resolved alone.
  - Follow-ups: None.
- [x] DN-028 | status:done | priority:P3 | risk:low | tags:[docs,cleanup] | file:pt-rebuild/docs/dev_notes.json,pt-rebuild/scripts/generate-dev-notes.mjs,pt-rebuild/AGENTS.md | issue:Separate open_items into open_items (active work queue) and closed_items (done) to reduce agent token cost and eliminate noise. | resolved:2026-02-23
  - Problem: open_items mixed active (open/in_progress/blocked) and done items in one array. At schema 1.4.0, 13 of 27 items were done — 50% noise for agents loading the work queue. Ratio worsens over time.
  - Root cause: Original schema had no closed_items array. Done items accumulated in open_items with no mechanism to move them out.
  - Change made: Script split open_items by status: open/in_progress/blocked stay in open_items; done moves to new closed_items array. Generator updated to validate and render both sections separately. AGENTS.md updated with lifecycle rules for all status values. Schema bumped to 1.5.0.
  - Files touched: pt-rebuild/docs/dev_notes.json (split into open_items + closed_items, schema 1.4.0 -> 1.5.0), pt-rebuild/scripts/generate-dev-notes.mjs (validate + render closed_items), pt-rebuild/AGENTS.md (lifecycle rules updated)
  - Validation: dev-notes:build and dev-notes:check both pass. open_items contains only actionable statuses. closed_items contains all done items.
  - Follow-ups: None.
- [x] DN-029 | status:done | priority:P3 | risk:low | tags:[docs,cleanup] | file:pt-rebuild/docs/dev_notes.json | issue:Eliminate dated_entries array; consolidate close-loop narratives inline on closed items; convert pre-DN entries to LE-### format; archive legacy_entries to HISTORY.md. | resolved:2026-02-23
  - Problem: `dated_entries` array was a second place to store close-loop narratives, separate from the closed items they described. `legacy_entries` was a raw markdown blob in the JSON that was not machine-processable. Both added schema complexity and split narrative context from the items it referenced.
  - Root cause: `dated_entries` were introduced before narrative fields existed on closed items. Once closed items had narrative fields (DN-023/DN-024), `dated_entries` became redundant. `legacy_entries` was a transitional holdover from the pre-DN note format.
  - Change made: Eliminated `dated_entries` array: DN-linked entries merged as narrative fields directly onto their closed items; non-DN entries converted to LE-### closed items with full narrative fields. Extracted `legacy_entries` to `pt-rebuild/docs/HISTORY.md` archive (read-only, not machine-processed). Updated generator to validate and render LE items; removed all `dated_entries` and `legacy_entries` logic. Updated `AGENTS.md` close-loop instructions to write narratives directly onto closed items. Bumped schema to 1.6.0.
  - Files touched: `pt-rebuild/docs/dev_notes.json`, `pt-rebuild/scripts/generate-dev-notes.mjs`, `pt-rebuild/AGENTS.md`, `pt-rebuild/docs/HISTORY.md` (new), `pt-rebuild/docs/dev_notes.schema.json`
  - Validation: `npm run dev-notes:build` passes with no warnings. All 13 LE items present with full narrative fields. All DN closed items have non-empty narrative fields.
  - Follow-ups: None.
- [x] DN-023 | status:done | priority:P2 | risk:low | tags:[docs,reliability] | file:pt-rebuild/docs/dev_notes.json,pt-rebuild/docs/DEV_NOTES.md,pt-rebuild/AGENTS.md,pt-rebuild/CLAUDE.md,pt-rebuild/docs/AI_WORKFLOW.md | issue:Follow-up review requested explicit intake→execute→close-loop proof for the JSON-canonical dev-notes migration; create and close a tracked item documenting the completion. | resolved:2026-02-22
  - Problem: Review follow-up asked whether the migration work actually followed the required lifecycle and requested explicit create/close tracking in dev notes.
  - Root cause: The prior change migrated formats and guidance but did not include a dedicated DN issue closure entry proving the lifecycle was executed for the migration request itself.
  - Change made: Added DN-023 as a tracked and resolved issue in canonical JSON and added this dated entry to close the loop, then regenerated DEV_NOTES.md via the generator.
  - Files touched: pt-rebuild/docs/dev_notes.json, pt-rebuild/docs/DEV_NOTES.md
  - Validation: Ran `npm run dev-notes:build` and `npm run dev-notes:check` successfully; markdown is synchronized with canonical JSON.
  - Follow-ups: None.
- [x] DN-024 | status:done | priority:P3 | risk:low | tags:[docs] | file:pt-rebuild/docs/dev_notes.json,pt-rebuild/docs/DEV_NOTES.md | issue:Confirm follow-up dev-tracking for JSON-canonical migration review and record validation commands run. | resolved:2026-02-22
  - Problem: Review follow-up asked for explicit confirmation that dev-tracking was updated and required commands were executed.
  - Root cause: Previous change set did not include a dedicated dated entry explicitly documenting this follow-up verification step.
  - Change made: Added DN-024 in `open_items` as resolved and added this dated entry to close-loop the follow-up request while preserving existing DN sequence and history.
  - Files touched: `pt-rebuild/docs/dev_notes.json`, `pt-rebuild/docs/DEV_NOTES.md`
  - Validation: Ran `npm run dev-notes:build` and `npm run dev-notes:check` successfully after updating canonical JSON.
  - Follow-ups: None.
- [x] DN-003 | status:done | priority:P1 | risk:high | tags:[data-model,reliability,sync,api] | file:pt-rebuild/api/sync.js,pt-rebuild/api/logs.js | issue:Prevent orphaned logs when sets insert fails (cleanup or transactional behavior). | resolved:2026-02-21
  - Problem: When `patient_activity_sets` insert failed after `patient_activity_logs` was already written, the log row was left orphaned with no sets — silent data corruption in clinical records with no error visible to the patient. The same issue existed in both `createActivityLog` (logs.js) and `processActivityLog` (sync.js).
  - Root cause: Three-table insert was done in separate sequential statements with no transaction boundary. Cleanup-on-error was considered but rejected: if the log insert succeeds but the cleanup delete also fails, the `client_mutation_id` unique constraint entry persists — the clinical record becomes permanently unrecoverable on retry.
  - Change made: Created Postgres function `create_activity_log_atomic` (`SECURITY INVOKER` — all existing RLS policies remain in full effect, no privilege escalation). Function wraps all three inserts in a single implicit PL/pgSQL transaction; any failure rolls back atomically so no orphaned row is ever written and `client_mutation_id` is only committed on full success. Replaced three-step inline insert in `createActivityLog` and two-step insert in `processActivityLog` with `supabase.rpc('create_activity_log_atomic', {...})`. Also: `processActivityLog` in `sync.js` previously never inserted `patient_activity_set_form_data` at all — the RPC now handles all three tables in both code paths.
  - Files touched: `pt-rebuild/api/logs.js`, `pt-rebuild/api/sync.js`, `pt-rebuild/db/migrations/013_create_activity_log_rpc.sql` (new)
  - Validation: Migration applied via Supabase MCP. Function confirmed in DB (`SECURITY_TYPE: INVOKER`). Deployment `dpl_AhHBKZ9xpiaxfeJG4v9qb3QZoj9b` READY (commit cd566b5). Existing log history loads correctly in app.
  - Follow-ups: None.
- [x] DN-004 | status:done | priority:P1 | risk:high | tags:[data-model,reliability,api] | file:pt-rebuild/api/logs.js | issue:Form data is matched to sets by array index instead of `set_number` in create/update flows. | resolved:2026-02-21
  - Problem: Form data (e.g. band resistance, weight) was matched to sets by array index position; if Supabase returned inserted rows in a different order than submitted, form parameters would attach to the wrong clinical set with no error raised.
  - Root cause: Array-index matching assumed Supabase preserves insert-order in responses, which is not guaranteed.
  - Change made: Form data is now matched to sets by `set_number` captured from each set's `RETURNING id` clause — not by array index. Fixed `updateActivityLog` array-index form data matching with a `set_number`-keyed Map lookup. Added `set_number` validation to `createActivityLog` (consistent with `sync.js`).
  - Files touched: `pt-rebuild/api/logs.js`, `pt-rebuild/api/sync.js`
  - Validation: Covered by DN-003 validation (same migration and deployment). Existing log history loads correctly with correct set-to-form-data associations.
  - Follow-ups: None.
- [x] LE-011 | status:done | priority:P1 | risk:medium | tags:[auth,api] | file:pt-rebuild/api/users.js | issue:Admin-role user blocked from patient app (programs, sync) | resolved:2026-02-21
  - Problem: Admin user (who is also the sole patient) could not see their programs in the patient app, and the offline sync queue was rejected entirely with 403.
  - Root cause: (1) `patient_programs` and `patient_program_history` SELECT RLS policies had no admin bypass — they only allowed own `patient_id` or therapist relationship. (2) `/api/sync` used `requirePatient` middleware which rejects any non-`patient` role, blocking the admin user even though they are also a patient.
  - Change made: (1) Dropped and recreated `patient_programs_select_own` and `patient_program_history_select` RLS policies to add `OR (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'))`. (2) Changed `sync.js` from `requirePatient` → `requireAuth`; updated comment to reflect that RLS on `patient_activity_logs` still enforces own-`patient_id` inserts. All other exercise/role/vocab write endpoints already allowed admin.
  - Files touched: DB (migration `fix_admin_patient_rls`), `pt-rebuild/api/sync.js`
  - Validation: Migration applied successfully. RLS SELECT policies now include admin bypass. Sync endpoint accepts any authenticated user; RLS still blocks cross-patient inserts.
  - Follow-ups: None.
- [x] LE-012 | status:done | priority:P2 | risk:medium | tags:[email,notifications] | file:pt-rebuild/api/messages.js | issue:Email notifications for clinical messages (Resend integration) | resolved:2026-02-21
  - Problem: The daily cron (`handleNotify` in `logs.js`) used SendGrid (never configured), sent only a count (no message bodies), had no "new since last email" guard (re-sent daily for old unread messages), and had no opt-out support.
  - Root cause: Feature was scaffolded but never fully implemented. `SENDGRID_API_KEY` was never set in Vercel.
  - Change made: Rewrote `handleNotify` to use Resend API (`RESEND_API_KEY` already configured via Vercel integration). Added `last_notified_at` timestamptz column to track per-user send time. Added `email_notifications_enabled` boolean column (default true) for opt-out. New logic: skip opted-out users, skip if notified within 23 hours, filter to messages newer than `last_notified_at`, skip if no new messages, send HTML email with message bodies + role-based deep link + opt-out footer, update `last_notified_at` on success. Added `PATCH /api/users` handler (own record only, boolean only). Added email notify toggle to messages modal in both `index.html` and `pt_view.html`. Fixed message font sizes (body 14→16px, labels 13→15px, timestamps/buttons 11→13px). Added `font-size: 16px` to compose textarea (prevents iOS auto-zoom).
  - Files touched: `pt-rebuild/api/logs.js`, `pt-rebuild/api/users.js`, `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`; Vercel env vars added: `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`; Supabase migrations: `add_last_notified_at_to_users`, `add_email_notifications_opt_out`
  - Validation: Triggered cron manually — `{"sent":1,"skipped":0,"total":1}`. DB `last_notified_at` updated for therapist. Re-triggered immediately — `{"sent":0,"skipped":1,"total":1}` (23-hour guard working).
  - Follow-ups: Remove `SENDGRID_API_KEY` from Vercel if it exists (was never set, but worth confirming).
- [x] LE-013 | status:done | priority:P1 | risk:high | tags:[reliability,api] | file:pt-rebuild/db/migrations/014_fix_activity_log_rpc_null_form_data.sql | issue:Regression: exercises without form data failed to log (500) after RPC migration | resolved:2026-02-21
  - Problem: Any exercise without form parameters (e.g. Ankle Inversion — Isometric) returned a 500 error immediately after the DN-003/DN-004 RPC migration. Existing offline queue sessions failed to sync.
  - Root cause: The client sends `"form_data": null` in set objects when an exercise has no form parameters. In Postgres JSONB, `v_set->'form_data'` on a JSON null value returns a JSONB null — not a SQL NULL. The RPC's guard `v_set->'form_data' IS NOT NULL` evaluated to `true` for JSON nulls, causing `jsonb_array_length()` to be called on a non-array type, raising an exception and rolling back the transaction with a 500.
  - Change made: Replaced `IS NOT NULL` check with `jsonb_typeof(v_set->'form_data') = 'array'`. This correctly handles `null`, missing key, and empty array without error. Fix applied directly in DB via Supabase MCP (`apply_migration`) — no Vercel deployment required.
  - Files touched: DB only — migration `014_fix_activity_log_rpc_null_form_data.sql` (new); `pt-rebuild/db/migrations/014_fix_activity_log_rpc_null_form_data.sql` saved to repo.
  - Validation: Tested RPC directly with `"form_data": null` payload — returned `log_id`, no error. Confirmed Ankle Inversion — Isometric log from offline queue synced correctly: set_count=1, reps=10, seconds=10, side=right, manual_log=true.
  - Follow-ups: None. Should have tested with a no-form-data exercise before shipping DN-003/DN-004.
- [x] DN-001 | status:done | priority:P0 | risk:medium | tags:[security,supabase,api,auth] | file:pt-rebuild/api/sync.js | issue:Use auth-context Supabase client (`getSupabaseWithAuth(req.accessToken)`) instead of anon client. | resolved:2026-02-20
  - Problem: `api/sync.js` used the anon Supabase client for patient data inserts, bypassing RLS user context.
  - Root cause: `getSupabaseClient()` was used instead of `getSupabaseWithAuth()` — the token was available on `req.accessToken` but not passed to the client.
  - Change made: Swapped `getSupabaseClient()` → `getSupabaseWithAuth(req.accessToken)` in `sync.js`.
  - Files touched: `pt-rebuild/api/sync.js`
  - Validation: Code paths verified by inspection. Regression: patients logging own data unaffected (no `patient_id` body field).
  - Follow-ups: None. DN-001 and DN-002 closed.
- [x] DN-002 | status:done | priority:P0 | risk:medium | tags:[security,api,auth] | file:pt-rebuild/api/logs.js | issue:Add therapist-to-patient authorization check in `createActivityLog()` when `patient_id` differs from caller. | resolved:2026-02-20
  - Problem: `createActivityLog()` in `api/logs.js` allowed any authenticated caller to post an activity log to any arbitrary `patient_id` with no relationship check.
  - Root cause: `targetPatientId` was set from the request body `patient_id` without verifying the caller had a therapist relationship to that patient.
  - Change made: Added authorization block in `createActivityLog()`: when `patient_id` differs from `req.user.id`, rejects non-therapist/non-admin callers with 403; for therapists, queries `users` table via admin client to confirm `therapist_id` matches, rejects with 403 if not assigned.
  - Files touched: `pt-rebuild/api/logs.js`
  - Validation: Code paths verified by inspection. Therapists logging for assigned patients pass the relationship check. Unassigned callers receive 403.
  - Follow-ups: None. DN-001 and DN-002 closed.
- [x] LE-007 | status:done | priority:P1 | risk:high | tags:[data-model,migration] | file:pt-rebuild/db/migrations/ | issue:Exercise IDs: bug fix + data migration to proper UUID format | resolved:2026-02-20
  - Problem: 13 of 34 exercises had non-UUID IDs. 9 had sequential `ex000X` IDs from the original Firebase migration (Jan 18). 4 had slug IDs like `passive-great-toe-plantarflexion-stretch` added Jan 28 – Feb 3 via `pt_editor`. All 13 had linked records across 11 child tables that had to be preserved.
  - Root cause: `generateExerciseId(name)` in `pt_editor.js` slugified the canonical name instead of generating a UUID. The 9 `ex000X` IDs were grandfathered from Firebase. The 4 slug IDs were created when exercises were manually added through the editor after the Firebase migration.
  - Change made: 1. **Bug fix** — Replaced `generateExerciseId(name)` body to use `crypto.randomUUID()` (native browser API, no vendor dependency). Removed the vendored `ulid.js` library that was briefly added.
  2. **Display field** — Added a read-only Exercise ID display field in `pt_editor.html` above the Canonical Name field (both add and edit modes). Pre-generates a UUID when adding; shows existing ID when editing. Field is monospace, readonly, not user-editable.
  3. **JS wiring** — `loadExerciseForEdit()` populates `exerciseIdDisplay` from `exercise.id`. `clearForm()` pre-generates a fresh UUID into `exerciseIdDisplay`. `collectFormData()` reads from `exerciseIdDisplay` instead of calling `generateExerciseId(canonicalName)`.
  4. **Data migration** — Applied atomic migration `20260221000001_fix_exercise_ids.sql` via Supabase MCP: dropped all 11 FK constraints, updated all 13 bad IDs in `exercises` and all child tables (using a temp mapping table), re-added FK constraints with original ON DELETE behavior. Backup table `exercises_backup_20260221` preserved.
  - Files touched: `pt-rebuild/public/js/pt_editor.js`, `pt-rebuild/public/pt_editor.html`, `pt-rebuild/supabase/migrations/20260221000001_fix_exercise_ids.sql`, `pt-rebuild/db/migrations/012_fix_exercise_ids.sql`
  - Validation: 34 exercises total (unchanged). 0 old IDs remaining in `exercises`. All 11 FK constraints restored. Backup table `exercises_backup_20260221` contains 34 rows.
  - Follow-ups: Drop `exercises_backup_20260221` after confirming app behavior is correct in production.
- [x] LE-008 | status:done | priority:P0 | risk:medium | tags:[security,api,auth] | file:pt-rebuild/api/sync.js,pt-rebuild/api/logs.js | issue:P0 security: auth client in sync.js + therapist-patient authorization in logs.js | resolved:2026-02-20
  - Problem: (1) `api/sync.js` used the anon Supabase client for patient data inserts, bypassing RLS user context. (2) `createActivityLog()` in `api/logs.js` allowed any authenticated caller to post an activity log to any arbitrary `patient_id` with no relationship check.
  - Root cause: (1) `getSupabaseClient()` was used instead of `getSupabaseWithAuth()` — the token was available on `req.accessToken` but not passed to the client. (2) `targetPatientId` was set from the request body `patient_id` without verifying the caller had a therapist relationship to that patient.
  - Change made: (1) Swapped `getSupabaseClient()` → `getSupabaseWithAuth(req.accessToken)` in `sync.js`. (2) Added authorization block in `createActivityLog()`: when `patient_id` differs from `req.user.id`, rejects non-therapist/non-admin callers with 403; for therapists, queries `users` table via admin client to confirm `therapist_id` matches, rejects with 403 if not assigned.
  - Files touched: `pt-rebuild/api/sync.js`, `pt-rebuild/api/logs.js`
  - Validation: Code paths verified by inspection. Regression: patients logging own data unaffected (no `patient_id` body field). Therapists logging for assigned patients pass the relationship check. Unassigned callers receive 403.
  - Follow-ups: None. DN-001 and DN-002 closed.
- [x] LE-009 | status:done | priority:P2 | risk:low | tags:[performance,supabase] | file:pt-rebuild/db/migrations/ | issue:RLS auth.uid() initialization plan fix (performance) | resolved:2026-02-20
  - Problem: Supabase performance advisor flagged 17 RLS policies across 9 tables for re-evaluating `auth.uid()` once per row instead of once per query.
  - Root cause: Policies used bare `auth.uid()` in WHERE conditions. PostgreSQL re-evaluates this for every row scanned. Wrapping in `(select auth.uid())` forces a single evaluation per query.
  - Change made: Dropped and recreated 15 affected policies on `patient_activity_logs` (select/update/delete), `patient_activity_sets` (select/update/delete), `patient_activity_set_form_data` (select/update/delete), and all 6 `vocab_*` tables (`_modify` policy on each). Replaced all bare `auth.uid()` with `(SELECT auth.uid())`. Zero behavior change — purely a query planner optimization.
  - Files touched: DB only (migration `fix_rls_auth_uid_initplan` applied via Supabase MCP)
  - Validation: Migration applied successfully. Re-run performance advisor to confirm warnings cleared.
  - Follow-ups: DN-009 — duplicate permissive SELECT policies still present on patient_activity_logs, patient_activity_sets, patient_activity_set_form_data, and vocab_* tables. Requires careful review before fixing (medium risk). DN-010 — 13 unused indexes flagged; defer until real query traffic confirms they're unneeded.
- [x] LE-010 | status:done | priority:P1 | risk:medium | tags:[supabase,migration] | file:pt-rebuild/db/migrations/ | issue:Supabase migrations file corrupted by storage-internal trigger lines | resolved:2026-02-20
  - Problem: VS Code Supabase extension reported errors on `20260220000755_remote_schema.sql`. The file is a full `pg_dump`-style schema export that GPT inserted after truncating `supabase_migrations.schema_migrations`. It contained `drop extension if exists "pg_net"` and 5 `CREATE TRIGGER` statements on `storage.objects` / `storage.prefixes` — internal Supabase objects that cannot be created by user migrations.
  - Root cause: GPT truncated the migrations table and inserted a single mega-migration row pointing at a full schema dump. The dump included storage-internal triggers at the end that Supabase tooling rejects. The DB itself was unaffected (the migration row was already marked applied), but the local file caused tooling errors.
  - Change made: Removed lines 2034–2045 from `pt-rebuild/supabase/migrations/20260220000755_remote_schema.sql` — specifically `drop extension if exists "pg_net"` and the 5 `CREATE TRIGGER` statements on `storage.objects` and `storage.prefixes`. No DB changes were needed.
  - Files touched: `pt-rebuild/supabase/migrations/20260220000755_remote_schema.sql`
  - Validation: Verified zero `storage.` and `pg_net` matches remain in the file.
  - Follow-ups: None — DB was never affected. If the VS Code extension still reports issues, verify the migration row in `supabase_migrations.schema_migrations` is still present and marked applied.
- [x] LE-005 | status:done | priority:P2 | risk:medium | tags:[ui] | file:pt-rebuild/pt_editor/index.html | issue:PT Editor archived exercise visibility toggles for Edit/Roles/Dosage selectors | resolved:2026-02-19
  - Problem: Archived exercises were always shown in PT Editor selection dropdowns, making active workflows noisier and increasing risk of picking archived items unintentionally.
  - Root cause: Dropdown population/filtering logic used `allExercises` directly without lifecycle-based filtering or any user-controlled archived visibility toggle.
  - Change made: Added a `Show Archived` checkbox to the exercise edit selector panel and refactored dropdown filtering/population for all three selectors (Edit, Roles, Dosage) to hide archived by default, include archived only when requested, and show archived items in a separate `Archived Exercises` section below active items. Implemented live re-render on search and toggle changes without page reload.
  - Files touched: `pt-rebuild/public/pt_editor.html`, `pt-rebuild/public/js/pt_editor.js`
  - Validation: Verified filtering flow in code paths for `loadExercises()`, `filterExercises()`, roles/dosage search handlers, and shared dropdown render helper now consistently applies lifecycle filtering and immediate re-render behavior.
  - Follow-ups: If therapists want independent archived visibility controls per section later, split the single toggle into scoped controls while preserving current default-hidden safety behavior.
- [x] LE-006 | status:done | priority:P2 | risk:medium | tags:[ui,api] | file:pt-rebuild/pt_editor/index.html | issue:pt_editor date fields blank when editing existing exercises | resolved:2026-02-19
  - Problem: `added_date` and `updated_date` fields were blank when opening an exercise for editing, even when values existed in the database.
  - Root cause: Values are stored as full ISO 8601 timestamps (e.g. `2026-02-20T00:00:00.000Z`) but `<input type="date">` requires `YYYY-MM-DD` format. Browser silently rejected the value, leaving fields blank.
  - Change made: Added `toDateInput()` helper that converts any valid date value to `YYYY-MM-DD` using `new Date().toISOString().split('T')[0]`. Applied to both `addedDate` and `updatedDate` fields in `loadExerciseForEdit()`.
  - Files touched: `pt-rebuild/public/js/pt_editor.js`
  - Validation: Cherry-picked from branch `claude/review-public-directory-I9eT4` (commit 37c15d1). Date fields now populate correctly when editing.
  - Follow-ups: None.
- [x] LE-001 | status:done | priority:P3 | risk:low | tags:[docs,api] | file:pt-rebuild/docs/API.md | issue:API docs aligned to post-consolidation route model | resolved:2026-02-18
  - Problem: API documentation still mixed pre-consolidation assumptions (12-slot snapshot and debug endpoint presence) with post-change behavior, creating ambiguity for future edits and endpoint work.
  - Root cause: Wrapper consolidation and `api/debug.js` removal were implemented after the original slot strategy memo and guide were written, but docs were not fully synchronized in one pass.
  - Change made: Updated API strategy memo to add an implementation status section, revise inventory to 9 current API files, mark wrapper consolidation/debug removal as completed, and note query/body id routing for programs/exercises updates. Updated development guide API surface text to reflect current methods and query/body id usage, and removed stale script reference.
  - Files touched: `pt-rebuild/docs/API_SLOT_STRATEGY_2026-02-17.md`, `pt-rebuild/docs/DEVELOPMENT.md`
  - Validation: Re-ran `rg` checks for `/api/programs/`, `/api/exercises/`, and `/api/debug` app callsites (none remaining in `pt-rebuild/public`); verified docs now state 9-file inventory and no debug route listing.
  - Follow-ups: If a dedicated messages endpoint is introduced later, update both docs in the same change set and add migration notes for callsite contract changes.
- [x] LE-002 | status:done | priority:P3 | risk:low | tags:[docs] | file:pt-rebuild/docs/DEV_NOTES.md | issue:DEV_NOTES converted to AI-optimized ops format | resolved:2026-02-18
  - Problem: Active TODOs, risk context, and workflow guidance were split across legacy sections, making agent handoff and consistent triage harder.
  - Root cause: Historical notes evolved with mixed styles (`Remaining Work`, freeform notes, and legacy prose) and no single machine-stable open-work section.
  - Change made: Added canonical top-of-file ops sections (`How to Use`, priority/risk/status enums, tag vocabulary, entry schema, migration approach), moved active outstanding work into `Open Items` (`DN-001` to `DN-006`), removed duplicated legacy `Remaining Work` block, and preserved historical entries under `Legacy Entries (Pre-Format)`. Added prose `Context` and `Constraints/Caveats` per open item for cross-agent compatibility (including Claude Code). Aligned guidance docs to the new behavior (`AGENTS.md`, `CLAUDE.md`, `DEV_PRACTICES.md`).
  - Files touched: `pt-rebuild/docs/DEV_NOTES.md`, `pt-rebuild/docs/DEV_PRACTICES.md`, `pt-rebuild/AGENTS.md`, `pt-rebuild/CLAUDE.md`
  - Validation: Verified `Open Items` now contains the previously active unresolved items with preserved priority and explicit risk; verified guidance references now point to `Open Items` + schema-based dated entries; confirmed legacy historical content remains intact.
  - Follow-ups: Keep future updates schema-compliant and close-loop `Open Items` whenever tracked work is completed.
- [x] LE-003 | status:done | priority:P2 | risk:low | tags:[cleanup,api] | file:pt-rebuild/index.html | issue:Removed redundant client-side form parameter backfill from index.html | resolved:2026-02-18
  - Problem: `loadData()` in `index.html` made a second serial fetch to `/api/exercises` whenever any exercise in the program had an empty `form_parameters_required` array, blocking LCP and contributing to 8.4s LCP on mobile.
  - Root cause: The backfill (commit `a7efd59`, 2026-01-30) was added as a workaround for RLS silently blocking patients from reading `exercise_form_parameters` via nested Supabase joins. A server-side fix (commit `4fc6973`, 78 minutes earlier) using an admin-client fetch in `programs.js` already resolved the same issue authoritatively. The client-side backfill was never removed after the server fix was confirmed working.
  - Change made: Removed the `missingFormParams` block (28 lines) from `loadData()` in `index.html`. The programs API already returns correct `form_parameters_required` for all exercises via the admin client fetch in `lib/handlers/programs.js` (lines 219-235). Verified live: 12 of 33 exercises return form parameters correctly, band resistance defaults to last used value, logging modal renders all required fields.
  - Files touched: `pt-rebuild/public/index.html`
  - Validation: Confirmed `/api/programs` response contains correct `form_parameters_required` for all exercises with parameters. Opened Log Set modal for Ankle Inversion (TheraBand) — band_resistance field present, populated from history, defaulting to last used value ("black"). No regressions.
  - Follow-ups: None.
- [x] LE-004 | status:done | priority:P2 | risk:low | tags:[ui,ios] | file:pt-rebuild/index.html | issue:Timer audio cues aligned for duration/hold and >10s start/pause voice | resolved:2026-02-18
  - Problem: `duration_seconds` timer flow diverged from `hold_seconds` behavior by announcing "Time" at completion, and long timers lacked explicit start/pause voice cues.
  - Root cause: Duration completion branch in `startTimer()` had a duration-specific speech fallback, and timer controls had no threshold-gated voice announcements for start/pause actions.
  - Change made: Updated duration completion speech to use `Set complete` so duration/hold share the same near-zero cue flow (countdown beeps at `3/2/1` and completion triple-beep at `0`). Added voice announcements for `Start` and `Pause` when `timerState.targetSeconds > 10`. Added `pauseTimer(announce = true)` parameter so auto-pause at completion and reset call `pauseTimer(false)` and do not produce extra pause announcements.
  - Files touched: `pt-rebuild/public/index.html`
  - Validation: Verified timer logic in `startTimer()`/`pauseTimer()`/`resetTimer()` now includes `speakText('Start')` and `speakText('Pause')` only for targets over 10s, keeps auto-complete and reset silent for pause voice, and retains existing countdown/completion beep behavior.
  - Follow-ups: Optional UX decision: keep `Set complete` spoken for duration completion, or switch completion to sound-only for both duration and hold for strict audio parity.
