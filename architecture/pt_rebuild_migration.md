# PT Tracker Rebuild — Migration & Verification

This document defines the migration steps and **acceptance criteria** for data correctness. Migration must be fully auditable and verifiable.

---

## 1. Migration Inputs (Reference Only)
- Firestore exports and legacy runtime snapshots.
- Bundled JSONs and schema files (backup/reference only; not runtime inputs).
- V2 payloads (PT_DATA / PT_MODIFICATIONS) for export-only compatibility.

---

## 2. Mapping Summary (Legacy → SQL)
| Legacy Source | SQL Destination | Notes |
| --- | --- | --- |
| `users/{uid}` | `users` | `therapistUid` → `therapist_id`.
| `users/{uid}/sessions` | `sessions`, `session_sets` | Split header + set rows, preserve `sessionId` as `session_uid`.
| `users/{uid}/pt_runtime/state.exerciseLibrary` | `patient_exercise_assignments` | Use as program/dosage overrides only.
| `users/{uid}/notes` | `notes` | Preserve read/archive/delete flags (patient + therapist).
| `pt_shared/exercise_library` | `exercises` + auxiliary tables | Normalize muscles, equipment, tags (functional/format only), guidance, lifecycle, lineage.
| `pt_shared/exercise_roles` | `role_definitions` + `exercise_roles` | Map role tuples to shared definitions.
| `pt_shared/*_vocabulary` | `vocab_terms` | Keep vocab for editor/coverage UI.

---

## 3. Migration Steps (Required)
1. **Extract** Firestore data to immutable export files.
2. **Transform**:
   - Normalize exercise library into SQL tables.
   - Convert runtime program entries to patient assignments.
   - Split sessions into `sessions` + `session_sets`.
   - Remove heatmap tags and deprecated fields.
3. **Load**:
   - Load shared library and vocab first.
   - Insert users and therapist mappings.
   - Insert assignments, sessions, and notes.
4. **Verify** using acceptance criteria (below).
5. **Cutover** only after verification succeeds for 100% of users.

---

## 4. Acceptance Criteria (Data Correctness)
### 4.1 Counts Must Match
- Sessions per patient match legacy totals.
- Sets per session match legacy counts.
- Notes per patient match legacy totals.
- Exercises in shared library match legacy counts **minus heatmap-only fields**.

### 4.2 Value-Level Verification
- For each patient, sample at least 5 sessions and verify:
  - exercise name, type, and date/time
  - per-set values (reps/seconds/distance)
  - session notes
- Verify dosage assignments for at least 5 exercises per patient.
- Verify role coverage counts for at least 5 exercises per patient.

### 4.3 Deterministic Checks
- Session totals (sets and reps) computed in SQL must match legacy UI totals.
- Coverage summary for a patient must match the legacy report for the same date range.

### 4.4 Migration Audit Report
- Produce a report with:
  - total rows migrated per table,
  - counts per patient,
  - list of any dropped/invalid records,
  - checksum of source vs destination export.

---

## 5. Rollback Strategy
- If any acceptance criterion fails, data is not cut over.
- Legacy data exports are retained until a successful rebuild launch is verified.
