# PT Tracker Rebuild Specification (Firestore → SQL)

## 0. Executive Summary
The PT Tracker rebuild is a **ground-up** replacement of the current Firebase/Firestore PWA. The new system is an offline-first iOS PWA with background sync, a REST API, and a **server-authoritative SQL database** (Supabase Postgres) deployed on Vercel. The rebuild must preserve existing clinical workflows (tracker, report/editor, coverage, view, notes) while removing reliance on Firebase, bundled JSONs, or seeding behaviors as runtime inputs. Reference-only sources remain documented for migration and audit comparison only.

**This file is the safety-critical spec index.** Detailed requirements are split into logical companion files:
- **Data model & schema**: `architecture/pt_rebuild_data_model.md`
- **UI/UX specification**: `architecture/pt_rebuild_ui.md`
- **Sync & safety requirements**: `architecture/pt_rebuild_sync_safety.md`
- **Migration & verification**: `architecture/pt_rebuild_migration.md`
- **Reference-only artifacts**: `architecture/pt_rebuild_reference_only.md`

---

## 1. Scope, Assumptions, and Non-Negotiables
1. **Full rebuild**: No legacy systems are modified. This spec defines the entire new system.
2. **Offline-first iOS PWA** with background sync and explicit offline state.
3. **REST API** with **server-authoritative** SQL database (Supabase Postgres).
4. **Deployment**: Vercel + Supabase is the expected hosting configuration.
5. **Existing UI surfaces remain**: tracker, report/editor, coverage, view, notes.
6. **JSONs are not inputs** to the new build. They may exist only as **exported backups** or migration references.

---

## 2. Safety-Critical Requirements (Clinical-Adjacent)
This rebuild is **clinical-adjacent**. Data loss, silent corruption, ambiguous authority, or ambiguous state is unacceptable. The following safety guarantees are mandatory and explicitly defined in the detailed files referenced above.

### 2.1 Source of Truth & Authority Boundaries
- The **server database is the only source of truth**. Client caches are always advisory and must re-validate against server state.
- Client writes must be **idempotent**, **versioned**, and **audited**.
- Client must **never** overwrite server state without a known **server version** / **ETag** (or equivalent). Version mismatches must be surfaced to the user.

### 2.2 Offline Queue Semantics
- Offline queue must be **append-only**, **ordered**, and **durable** per device.
- Each mutation must include a stable **client mutation ID**, **device ID**, **user ID**, **timestamp**, and **entity target** to guarantee idempotency and traceability.
- Queue reconciliation rules and merge strategies must be explicit, deterministic, and auditable.

### 2.3 iOS Background Sync Behavior
- Background sync must **attempt** delivery but **cannot be assumed** to run on iOS PWA.
- The system must always provide:
  - a **foreground sync on app open**,
  - a **manual “Sync Now”** action,
  - a **visible unsynced indicator** when mutations remain queued.

### 2.4 Failure Handling & User-Visible Blocking
- **Hard blockers**: authentication failure, schema validation failure, and write conflicts must block write completion and surface explicit UI errors.
- **Soft failures**: transient network failures may be retried, but must present queued/unsynced state in the UI.
- **Silent failure is forbidden**. Any failure to persist medical session data must be explicitly surfaced.

### 2.5 Auditability & Traceability
- Every mutation to sessions, dosage assignments, roles, or notes must be recorded with:
  - who initiated it,
  - which device/app instance,
  - timestamps (client and server),
  - before/after state,
  - and a monotonic sequence where applicable.

### 2.6 Backup & Recovery Guarantees
- Server-side backups must be retained for a defined period and validated for restore.
- Client-side recovery must preserve unsynced queues and last known state after crash or app reinstall.

### 2.7 Schema-Level Invariants
- Schema must prevent invalid medical states (e.g., negative reps, missing exercise IDs for logged sets, ambiguous timezones). Required constraints are defined in `pt_rebuild_data_model.md`.

### 2.8 UI-Visible Invariants
- Counts, dates (“today” vs “yesterday”), and coverage summaries must be deterministic and consistent across devices. Required UI invariants are defined in `pt_rebuild_ui.md`.

---

## 3. Audit Completion: Missing / Ambiguous Areas Now Explicit
This section lists the **previously missing or ambiguous areas** that are now explicitly specified in companion documents:
- Source of truth boundaries, idempotency, and server authority.
- Offline queue structure, ordering guarantees, and retry semantics.
- Background sync expectations and explicit iOS fallbacks.
- Failure handling and user-visible blocking requirements.
- Migration acceptance criteria and data verification.
- Audit log requirements and mutation traceability.
- Backup and restore guarantees.
- Schema invariants to prevent invalid medical states.
- UI-visible invariants for counts, dates, and role coverage.

Any unresolved ambiguity must be added to the **Open Questions** section below.

---

## 4. Open Questions (Must Be Answered Before Build)
1. Therapist-to-patient relationship cardinality: one-to-many vs one-to-one must be finalized.
2. Required retention period for audit logs and server backups.
3. Whether partial session entries (drafts) are visible to therapists or only finalized sessions.

---

## 5. Cross-References
- **Data model**: `architecture/pt_rebuild_data_model.md`
- **UI specification**: `architecture/pt_rebuild_ui.md`
- **Sync & safety**: `architecture/pt_rebuild_sync_safety.md`
- **Migration & verification**: `architecture/pt_rebuild_migration.md`
- **Reference-only artifacts**: `architecture/pt_rebuild_reference_only.md`
