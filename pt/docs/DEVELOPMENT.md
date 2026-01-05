# PT Tracker - Development Guide

Complete technical documentation for PT Tracker and Rehab Coverage system.

## Table of Contents
- [Open Questions / Open Issues](#open-questions--open-issues)
- [System Overview](#system-overview)
- [File Reference](#file-reference)
- [Data Architecture](#data-architecture)
  - [Current State](#current-state)
  - [Transitional State](#transitional-state)
  - [Future State (Firebase-dependent Offline PWA)](#future-state-firebase-dependent-offline-pwa)
- [Exercise Roles System](#exercise-roles-system)
- [Data Import and Export](#data-import-and-export)
  - [V2 Payload Format (gzip/base64)](#v2-payload-format-gzipbase64)
  - [PT_report Exports → PT Tracker Imports](#pt_report-exports--pt-tracker-imports)
  - [Other Export/Import Flows](#other-exportimport-flows)
- [Development Workflow](#development-workflow)
- [Best Practices](#best-practices)
- [Common Issues & Solutions](#common-issues--solutions)
- [Configuration](#configuration)
- [Roadmap](#roadmap)

---

## Open Questions / Open Issues

These items require validation or product decisions. After listing them, this document uses the most conservative, evidence-backed interpretation of the current system behavior.

1. **Firestore shared data ownership:** Should `pt_shared` ever be edited outside the PT editor workflow, or is it strictly seeded from JSON via `seed_firestore.html`? This impacts how aggressively the app should write shared data back to Firestore. (See `shared/firestore_shared_data.js` and `seed_firestore.html`.)
2. **Offline auth behavior:** The Firebase Auth session persists locally, but we have not validated the UX when the user launches in airplane mode after the auth token expires. Do we want a forced sign-in UX, or fallback to local-only behavior?
3. **Runtime vs sessions authority:** `users/{uid}/pt_runtime/state` stores a snapshot of exercise library, preferences, and queue, while `users/{uid}/sessions` is authoritative for session history. Should runtime also become authoritative in the future, or remain as a cache only?
4. **V2 payload long-term storage:** PT_report currently exports modifications as V2 payloads over email/copy. Should future Firebase workflows persist the same payload for auditing, or replace email entirely?

---

## System Overview

PT Tracker is a static, offline-capable PWA with optional Firebase connectivity. The codebase currently blends local-first persistence with cloud-backed synchronization:

- **Local-first runtime**: `localStorage` holds exercise library, session history (legacy), preferences, and offline queues.
- **Cloud sync (transitional)**: Firebase Auth + Firestore are used for user sessions (`users/{uid}/sessions`), runtime snapshots (`users/{uid}/pt_runtime/state`), and shared global PT data (`pt_shared/*`).
- **PT ↔ patient exchange**: Data exchange uses V2 gzip+base64 payloads with strict markers and checksums for email/copy-paste resilience.

The architecture is in transition: local storage is still used as a fallback and a cache, but Firestore is authoritative for authenticated session history.

---

## File Reference

Maintain this section whenever HTML/JS/JSON inputs change (including new pages, shared modules, data files, or service worker cache lists). Update the roles/notes so it stays exhaustive for files that are in use. The packing app is a separate project and is intentionally excluded from this document.

### Core HTML

| File | Role | Notes |
|------|------|-------|
| `pt_tracker.html` | Patient-facing tracker | Uses Firestore auth + sessions, and localStorage for offline cache + library edits. Exports PT_DATA. Imports PT_MODIFICATIONS. |
| `rehab_coverage.html` | Coverage analysis | Reads shared data + session history. Also supports PT_DATA export and PT_MODIFICATIONS import. |
| `pt_report.html` | PT-facing report/editor | Imports PT_DATA, edits library/roles/vocab/dosage, exports PT_MODIFICATIONS. |
| `exercise_editor.html` | Library editor (standalone) | Exports/imports library and PT data; overlaps with PT editor workflows. |
| `seed_firestore.html` | Admin seeding | Writes JSON sources to `pt_shared` and migrates shared dosage into user runtime. |
| `pt_view.html` | Shared view link | Tokenized viewer for shared PT data summaries. |

### Shared Modules & Data

| File | Role | Notes |
|------|------|-------|
| `pt_payload_utils.js` | V2 export/import utilities | Canonicalizes JSON, computes SHA-256, gzip/base64 wrapping, parsing markers. |
| `shared/firestore_shared_data.js` | Shared Firestore bridge | Loads `pt_shared/*`, merges fallback JSON, seeds missing data. |
| `shared/exercise_form_module.js` | Exercise editor helpers | Form bindings, schema-based select options, and validation for editor UIs. |
| `exercise_library.json` | Baseline exercise library | Static fallback for shared data. |
| `exercise_roles.json` | Role assignments | Used by coverage and PT editor; can be seeded to Firestore. |
| `exercise_roles_vocabulary.json` | Role definitions | Textual vocabulary for roles. |
| `exercise_library_vocabulary.json` | Library vocabulary | Descriptions/labels tied to exercise library terms. |
| `schema/exercise_roles.schema.json` | Enum source of truth | Runtime derivation; no hardcoded enums. |
| `schema/exercise_file.schema.json` | Library schema | Used by PT editor and validation helpers. |
| `sw-pt.js` | Service worker | Network-first for JSON/HTML with cached HTML fallback for offline boot; cache-first for static assets. |
| `tests/export_import_v2_test.js` | V2 regression tests | Node-based verification of V2 payload behavior. |
| `manifest-pt.json` | PWA manifest | App icons, start URL, display mode, theme colors. |
| `firebase.js` | Firebase bootstrap | Initializes app, Firestore, and Auth with persistence enabled. |
| `shared-styles.css` | Shared PT styling | Common styles for PT pages. |

### PT Offline Cache Notes

- `pt_tracker.html` is explicitly cached by the service worker to allow offline boot/loading.
- Other PT HTML pages should also be cached for offline fallback; network-first remains the default when online.

---


## Data Architecture

### Current State

**Primary persistence:** localStorage, with Firestore overlays when authenticated.

#### localStorage keys (current)

```javascript
const STORAGE_KEY = 'pt_tracker_data';          // Session history (legacy/local cache)
const LIBRARY_KEY = 'pt_exercise_library';      // Working exercise library
const ROLES_DATA_KEY = 'pt_exercise_roles';     // Cached roles data
const VOCABULARY_KEY = 'pt_exercise_vocabulary';// Cached vocabulary data
const LAST_EXERCISE_KEY = 'pt_last_exercise_id';// UI state
const FIRESTORE_QUEUE_KEY = 'pt_firestore_queue';
const RECOVERY_STORAGE_KEY = 'pt_session_recovery';
const PREFERENCES_STORAGE_KEY = 'pt_preferences';
const RUNTIME_UPDATED_KEY = 'pt_runtime_updated_at';
const PT_VERSION_KEY = 'pt_data_version';
```

**Correct vs incorrect localStorage usage**

❌ **WRONG (legacy key):**
```javascript
localStorage.getItem('session_history');
```

✅ **CORRECT:**
```javascript
localStorage.getItem('pt_tracker_data');
```

#### Firestore collections (current)

- `users/{uid}/sessions`: **authoritative** session history for authenticated users.
- `users/{uid}/pt_runtime/state`: runtime snapshot for recovery, preferences, offline queue, and library cache.
- `pt_shared/{docId}`: shared global data (library, roles, vocab, schemas).

**Shared document IDs** (see `shared/firestore_shared_data.js`):
- `exercise_library`
- `exercise_roles`
- `exercise_roles_vocabulary`
- `exercise_library_vocabulary`
- `exercise_file_schema`
- `exercise_roles_schema`

#### How session history works today

- Local sessions are written into a memory cache and mirrored to localStorage.
- When authenticated, sessions are **also** queued in `pt_firestore_queue` and written to Firestore (`users/{uid}/sessions`).
- Firestore is treated as authoritative for session history once available; local history is migrated on first sign-in and deduped.

### Transitional State

**Transitional behaviors already implemented:**

1. **Legacy → Firestore migration**
   - On sign-in, local history (from `pt_tracker_data`) is compared to Firestore and missing sessions are enqueued.
   - Migration flags are stored in `pt_tracker_history_migrated`.

2. **Shared data fallback**
   - `pt_shared` is used when available; JSON files (`exercise_library.json`, `exercise_roles.json`, etc.) are the fallback.
   - If Firestore has missing exercises, the fallback is merged and optionally seeded back into Firestore.

3. **Runtime snapshots**
   - Runtime data (preferences, recovery, offline queue, library cache) is synced to `users/{uid}/pt_runtime/state`.
   - Session history within runtime snapshots is **ignored** because `users/{uid}/sessions` is authoritative.

**Areas that require further validation:**
- Whether runtime snapshots should ever overwrite local library data when conflicts exist.
- How to handle concurrent edits between local-only updates and Firestore updates in shared library data.

### Future State (Firebase-dependent Offline PWA)

**Target:** Firebase becomes the system of record for all user data and shared data, while the PWA remains offline-capable via Firestore persistence and service worker caching.

**Planned characteristics (future, not implemented yet):**

- All session history, preferences, and recovery data read/write directly to Firestore with built-in offline persistence.
- `localStorage` becomes a short-lived cache or is removed entirely (except where required for auth token or bootstrapping).
- Shared data (`pt_shared/*`) is authoritative and maintained through PT workflows (no JSON fallback in production).
- Authentication becomes mandatory for end-user usage (or a clearly defined guest mode is added).

**Requires additional planning:**
- Offline auth UX and token refresh behavior.
- Migration strategy for users who only have local data and no auth account. For the current single-user/admin setup, a lightweight backup reminder is likely sufficient; today that means exporting **PT Tracker → Export All Data** (JSON file with `pt_exercise_library` + `pt_tracker_data`) and/or saving a current V2 PT_DATA payload for reference. Revisit a full checklist only if multi-user support or enforced auth is introduced.

---

## Authentication and Access Control

### Firebase Authentication

**Current state:**
- Firebase Authentication is **required** for all PT pages (`pt_tracker.html`, `pt_report.html`)
- Auth guard overlay blocks page access until user signs in
- No guest/anonymous mode available

**Therapist access:**
- Therapists can access patient data using URL parameter: `pt_tracker.html?patientUid=PATIENT_UID`
- When `patientUid` is specified, all Firestore queries target the patient's data instead of the therapist's own data
- Firestore security rules control actual data access (see below)

### Firestore Security Rules

```javascript
// Phase-1: patient + single therapist access
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection (patient-owned)
    match /users/{userId} {

      // Owner (patient) OR linked therapist can read/write
      allow read, write: if
        request.auth != null &&
        (
          request.auth.uid == userId ||
          request.auth.uid == resource.data.therapistUid
        );

      // Subcollections under user (pt_runtime, sessions)
      match /{subcollection}/{docId} {
        allow read, write: if
          request.auth != null &&
          (
            request.auth.uid == userId ||
            request.auth.uid == get(
              /databases/$(database)/documents/users/$(userId)
            ).data.therapistUid
          );
      }
    }

    // Everything else locked down
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Access model:**
1. Patient owns their data (`users/{patientUid}/...`)
2. Patient links therapist by storing therapist's UID in `users/{patientUid}` document field `therapistUid`
3. Therapist can then access patient's data when authenticated and using `?patientUid=PATIENT_UID`

### Data Permanence: Archive-Only Policy

**IMPORTANT:** Deletion is disabled across all PT pages. Only archiving is allowed.

**Exercise archiving:**
- Exercises can be archived (sets `exercise.archived = true`)
- Exercises can be unarchived (sets `exercise.archived = false`)
- Permanent delete is disabled - the `permanentlyDeleteExercise` function shows an alert
- "Delete Forever" button removed from archived exercises view

**Session permanence:**
- Session history is permanent - cannot be deleted
- Edit/update is allowed (date, notes, sets)
- `deleteSession` function disabled - shows alert if called
- Delete button removed from session edit modal

**Rationale:**
- Sessions are training records and should never be deleted
- Exercises should be archived for reference, not removed
- Supports audit trail and long-term progress tracking

---

## Exercise Roles System

### Design Principles

1. **No hardcoded enums**: derive enums at runtime from `schema/exercise_roles.schema.json`.
2. **Exercise library is immutable**: roles are an overlay; do not mutate library structure to store roles.
3. **Schema is the source of truth**: schema changes should flow through the app without code changes.
4. **Bidirectional relationships**: exercises can have multiple roles, and roles apply across multiple exercises.

### Data structure (roles)

```javascript
{
  "schema_version": "1.0",
  "exercise_roles": {
    "01KDE8962NN3ZP5KDS6TMFP20W": {
      "name": "Forward Lunge with Rotation and Swiss Ball (Wall)",
      "roles": [
        {
          "region": "back",           // Enum: core, back, hip, knee, ankle, foot, vestibular
          "capacity": "stability",    // Enum: strength, control, stability, tolerance, mobility
          "focus": "anti_rotation",   // Optional. Enum varies by capacity
          "contribution": "high"      // Enum: low, medium, high
        }
      ]
    }
  }
}
```

### Runtime enum derivation

❌ **BAD (hardcoded enums):**
```javascript
const regions = ['core', 'back', 'hip', 'knee'];
```

✅ **GOOD (derived from schema):**
```javascript
const roleSchema = schema.definitions.role;
regions = roleSchema.properties.region.enum || [];
capacities = roleSchema.properties.capacity.enum || [];
contributions = roleSchema.properties.contribution.enum || [];
```

### Adding new roles or vocabulary

1. Update `schema/exercise_roles.schema.json`.
2. Update `exercise_roles_vocabulary.json`.
3. Assign roles in `exercise_roles.json`.
4. Bump `CACHE_NAME` in `sw-pt.js` to refresh cached JSON.

---

## Data Import and Export

### V2 Payload Format (gzip/base64)

V2 export/import is the **only supported external format** and is implemented via `pt_payload_utils.js`. The same code is used in PT Tracker, PT Report, and Rehab Coverage.

**Key properties:**

- JSON is canonicalized via `JSON.stringify` before size and checksum calculations.
- Payloads are gzip-compressed, base64-encoded, and line-wrapped to ≤ 76 chars.
- Marker-delimited blocks allow extraction from full email text.

**Correct vs incorrect checksum handling**

❌ **WRONG (hashes raw pasted text):**
```javascript
const checksum = sha256(pastedText); // whitespace-sensitive, fragile
```

✅ **CORRECT:**
```javascript
const obj = JSON.parse(decodedPayload);
const canonical = JSON.stringify(obj);
const checksum = sha256(utf8Bytes(canonical));
```

**Markers and headers (required):**

```
–START_PT_DATA_V2–
FORMAT: V2
ENCODING: gzip+base64
TYPE: PT_DATA
SIZE: <bytes>
CHECKSUM: <sha256 hex>
<wrapped base64>
–END_PT_DATA_V2–
```

A parallel marker set exists for `PT_MODIFICATIONS`.

### PT_report Exports → PT Tracker Imports

This is the highest-friction flow and uses V2 payloads with gzip+base64 to survive email/copy-paste.

#### Today (current behavior)

**Export (PT_report):**
- PT edits exercises, roles, vocabulary, or dosage in `pt_report.html`.
- Modifications are exported as a `PT_MODIFICATIONS` V2 block via `pt_payload_utils.buildV2Block`.
- The UI provides **Copy payload only** and **Send email** (mailto). Both embed the same V2 block.

**Import (PT Tracker / Coverage):**
- PT Tracker (`pt_tracker.html`) and Coverage (`rehab_coverage.html`) accept pasted email content.
- `pt_payload_utils.parseV2FromText` extracts the first valid `PT_MODIFICATIONS` block.
- The parsed modifications merge into the local library/roles/vocab and then sync to Firestore when possible.

**Common pitfalls:**
- iOS copy/paste truncation leads to checksum mismatch. The importer reports the mismatch and suggests re-exporting.
- Incorrect payload type: PT Tracker expects `PT_MODIFICATIONS`, not `PT_DATA`.

#### Future (Firebase-first)

Planned behavior (not implemented):
- PT_report writes modifications directly to a shared Firestore location with versioning.
- PT Tracker subscribes to shared changes, eliminating email exchange.
- V2 payloads may remain as a manual export fallback but are not the primary workflow.

**Requires validation:**
- Access control rules for PT vs patient roles.
- Version conflict strategy if patient library diverges from shared edits.

### Other Export/Import Flows

#### PT Tracker data export/import (JSON files)

- PT Tracker supports JSON file export of full data, library-only, and history-only.
- Import logic detects export type and either merges or replaces session history.
- These JSON exports are **local-only** and not part of the V2 email exchange.

**Example (full export)**
```json
{
  "pt_exercise_library": [...],
  "pt_tracker_data": [...],
  "pt_data_version": "1",
  "exported_at": "2025-01-01T12:00:00Z"
}
```

#### PT_data export (patient → PT)

- `pt_tracker.html` and `rehab_coverage.html` export `PT_DATA` V2 payloads.
- Payload includes session history, library, roles, schema, and vocabulary.
- `pt_report.html` imports `PT_DATA` to show progress and populate editor context.

---

## Development Workflow

### Day-to-day practices

- **Static dev**: Open `pt_tracker.html` directly or serve with a simple static server. No build step.

## 2026-01-05 — iOS-friendly Next Set modal buttons

**Symptom**
On iOS Safari, the "Cancel", "Edit", and "Log & Next" buttons in the Next Set modal do not reliably trigger their actions.

**Root Cause (as understood now)**
Inline `onclick` handlers inside modal overlays can be ignored by iOS Safari during touch interactions, so taps fail to dispatch the click event.

**Fix Applied**
Swapped the three Next Set modal buttons to `onpointerup` handlers for iOS-friendly activation without changing their underlying actions.

**Notes / Risks**
This fix depends on Pointer Events support in Safari (iOS 13+). Avoid "cleaning up" to inline `onclick` or removing pointer events without re-testing on iOS.
- **Auth-dependent paths**: To test Firestore sync, sign in via the PT Tracker menu.
- **Shared data updates**: Use `seed_firestore.html` to push JSON files to `pt_shared`.

### Seeding shared data (`seed_firestore.html`)

Use the seeder to update the shared Firestore documents and (optionally) migrate dosage values into a user runtime. The page is intended for admin use only.

**Recommended order:**
1. **Sign in** with a Firebase account that has write access.
2. **Seed Shared Data** to write `exercise_library.json`, `exercise_roles.json`, vocab, and schemas into `pt_shared`.
3. **Migrate PT Dosage → Runtime** if you need to copy shared dosage values into a specific user runtime library.
4. **Reload Status** if you need a quick auth state sanity check.

**When to use each action:**
- **Seed Shared Data**: after updating JSON sources or schemas; required before expecting shared data to update in production.
- **Migrate PT Dosage → Runtime**: when shared library dosage values should become patient runtime dosage (e.g., after changing default prescription values).
- **Reload Status**: when the auth state seems stale or you have just signed in/out.

**Options:**
- **Overwrite existing dosage values**: replaces any runtime dosage values with shared ones. Use only when you intentionally want to reset patient-specific edits.
- **Record migration entries in exercise history**: adds a history entry for each migrated dosage; disable if you want a clean history.

### Local vs deployed behavior

- **Service worker** caches JSON and static assets. HTML is network-first with cached fallback for offline boot, so refreshes still fetch fresh HTML when online.
- Local testing in `file://` may break Firebase imports due to module restrictions. Use a local server for Firebase behavior.

### Offline and sync considerations

- Session history is written to local cache even when offline.
- When authenticated, sessions are queued in `pt_firestore_queue` and flushed when online.
- Runtime snapshots (`pt_runtime/state`) are updated on queue changes and preference updates.

---

## Best Practices

### 1. Avoid inline event handlers

❌ **BAD - inline onclick (hard to maintain, CSP issues):**
```html
<button onclick="deleteExercise(123)">Delete</button>
```

✅ **GOOD - addEventListener:**
```html
<button class="delete-btn" data-exercise-id="123">Delete</button>

<script>
document.querySelector('.delete-btn').addEventListener('click', (e) => {
  const id = e.target.dataset.exerciseId;
  deleteExercise(id);
});
</script>
```

**Current state:** Several HTML pages still use inline handlers (technical debt).

### 2. Service worker caching strategy

- HTML is **network-first** with a cached fallback for offline boot.
- JSON is **network-first** so exercise/roles updates propagate.
- Static assets are **cache-first** for offline reliability.

**When to bump cache version:** after updating JSON files or shared assets used offline.

### 3. iOS Safari PWA gotchas

**Issue:** Each PWA home screen icon gets its own localStorage.

**Symptom:** Coverage or PT Report appears empty when launched directly.

**Solution:** Launch from PT Tracker or ensure the same home screen entry is used.

---

## Common Issues & Solutions

### Issue: Coverage shows all exercises as "not done"

**Likely causes:**
1. Firestore sessions not available (not authenticated).
2. localStorage key mismatch or empty history.
3. Exercise ID mismatch between library and roles.

**Checks:**
- Coverage debug panel (🐛) shows session counts and ID matches.
- Confirm `pt_tracker_data` exists in localStorage.

### Issue: V2 import reports checksum mismatch

**Cause:** payload truncation or altered text (iOS Mail copy/paste is the most common culprit).

**Fix:**
- Use **Copy payload only** (no extra text) and paste the entire block.
- Avoid manual editing of headers or payload.

### Issue: Firestore queue never flushes

**Cause:** user not authenticated or network offline.

**Likely causes:**
1. Firestore sessions not available (not authenticated).
2. localStorage key mismatch or empty history.
3. Exercise ID mismatch between library and roles.

**Checks:**
- Coverage debug panel (🐛) shows session counts and ID matches.
- Confirm `pt_tracker_data` exists in localStorage.

### Issue: V2 import reports checksum mismatch

**Cause:** payload truncation or altered text (iOS Mail copy/paste is the most common culprit).

**Fix:**
- Use **Copy payload only** (no extra text) and paste the entire block.
- Avoid manual editing of headers or payload.

### Issue: Firestore queue never flushes

**Cause:** user not authenticated or network offline.

**Fix:**
- Sign in via PT Tracker.
- Confirm `navigator.onLine` is true.
- Check `pt_firestore_queue` in localStorage to ensure queued items exist.
**Fix:**
- Sign in via PT Tracker.
- Confirm `navigator.onLine` is true.
- Check `pt_firestore_queue` in localStorage to ensure queued items exist.

### Issue: Shared data appears stale

**Cause:** service worker cache and Firestore fallback precedence.

**Fix:**
- Bump `CACHE_NAME` in `sw-pt.js` after JSON updates.
- Use `seed_firestore.html` to refresh Firestore shared data.

### Issue: iOS Safari offline launch fails with “FetchEvent.respondWith received an error: Returned response is null.”

**Cause (prior behavior):** the service worker did not cache HTML, so Safari could not fetch `pt_tracker.html` offline and returned no cached response.

**What this means today:** the service worker now caches `pt_tracker.html`, `rehab_coverage.html`, and `pt_report.html` and falls back to cached HTML when offline, so a cold offline launch should succeed once the cache is populated.

**Short-term requirement:** open the app once while online after a service worker update so the cached HTML is refreshed.

**Long-term decision (Phase 1+):** consider a dedicated offline shell to avoid serving a potentially stale HTML document.

### Issue: Shared data appears stale

**Cause:** service worker cache and Firestore fallback precedence.

**Fix:**
- Bump `CACHE_NAME` in `sw-pt.js` after JSON updates.
- Use `seed_firestore.html` to refresh Firestore shared data.
## Configuration

### Firebase

- Configuration is hard-coded in `firebase.js` and uses CDN imports.
- Firestore uses `persistentLocalCache()` for offline persistence.

### Service worker

```javascript
// sw-pt.js
const CACHE_NAME = 'pt-tracker-v1.22.18'; // bump to refresh cached assets
```

### Export/Import

```javascript
// pt_payload_utils.js
const ENCODING = 'gzip+base64';
const FORMAT = 'V2';
```

### Versioning

```javascript
// pt_tracker.html
const PT_DATA_VERSION = '1';
```

---

## Roadmap

The architecture is intentionally staged. Each phase includes explicit non-goals.

### Phase 0 (Current) — Transitional Firestore

**Status:** In progress / current state.

- Firestore is authoritative for session history when signed in.
- localStorage is still used for cached library, offline queue, and legacy history.
- Shared data uses Firestore when available, JSON fallback otherwise.

**Non-goals:**
- Full removal of localStorage.
- Enforced auth for all users.

### Phase 1 — Stabilize Firebase Sync

**Status:** Planned.

- Solidify conflict handling between local edits and Firestore updates.
- Improve offline auth UX and error surfacing.
- Define explicit source-of-truth rules for runtime vs shared data.

**Non-goals:**
- Replacing email-based V2 exchange entirely.
- Removing JSON fallback for shared data.

**Phase 1 readiness checklist (for this project):**
1. **Conflict rules documented** (even if simple): e.g., “Firestore sessions are authoritative; local cache is only a fallback when unauthenticated.” Document the chosen precedence for runtime snapshots vs shared data, and use the same rule in all pages.
2. **Offline auth behavior defined**: decide what the UI does when a cached Firebase auth session is unavailable offline (e.g., show read-only local cache vs require sign-in).
3. **Offline launch validated**: PWA opens offline without a fatal `FetchEvent.respondWith` error (see Common Issues for the current iOS Safari failure mode).
4. **Error surfacing**: users see a clear message for auth failures and sync queue failures.

### Phase 2 — Shared Data Firebase-First

**Status:** Planned.

- Shared library, roles, vocab, and schemas are always read from `pt_shared`.
- JSON files become seed-only or dev-only artifacts.
- PT Report writes directly to shared data with version control.

**Non-goals:**
- Removing offline support; it must remain PWA-capable.
- Eliminating PT_report (editor UI still required).

### Phase 3 — Fully Firebase-Dependent Offline PWA

**Status:** Planned (future).

- All user data is stored in Firestore with offline persistence.
- localStorage becomes a minimal boot cache (or is removed).
- Auth becomes the primary entry point for all data access.

**Non-goals:**
- No assumption of real-time multi-user collaboration.
- No redesign of UI/UX beyond what is required for the data shift.

---

## Quick Diagnostic Checklist

When debugging issues:

1. ✅ Bump service worker version after data changes.
2. ✅ Check localStorage keys match (`pt_tracker_data` not `session_history`).
3. ✅ Verify exercise IDs match between library and roles.
4. ✅ Use Coverage view debug panel (🐛) to inspect data.
5. ✅ On iOS, close PWA completely and reopen after cache changes.

---

## Development Notes

- **2025-01-05** — **Problem:** iOS taps on "Next Set" were unreliable; duration-based exercises still prompted for reps in manual logging. **What I did:** Added an iOS touchend fallback for the Next Set button and updated the log-set flow to capture duration seconds instead of reps (stored as `secondsAchieved`/`secondsTarget`).

## 2026-01-05 — Enforce pointer-based activation in PT Tracker

**Symptom**
Taps on interactive controls were unreliable in iOS Safari/PWA when inline `onclick` handlers were used.

**Root Cause (as understood now)**
`onclick` is not consistently delivered in iOS Safari/PWA, which caused some controls to miss activation.

**Fix Applied**
Replaced inline `onclick` usage in `pt/pt_tracker.html` with pointerup-based listeners and keyboard handling for non-button elements, using data attributes and centralized binding.

1. ✅ Bump service worker version after data changes.
2. ✅ Check localStorage keys match (`pt_tracker_data` not `session_history`).
3. ✅ Verify exercise IDs match between library and roles.
4. ✅ Use Coverage view debug panel (🐛) to inspect data.
5. ✅ On iOS, close PWA completely and reopen after cache changes.
**Notes / Risks**
Do not reintroduce `onclick` or `click` handlers; the pointer-based bindings are required for iOS PWA reliability across desktop and mobile.
