# PT Rebuild Testing Checklists

Canonical checklist reference for `pt-rebuild/`. Loaded by `AGENTS.md`. New checklists are added here.

---

## Activity Log Testing Checklist

**Trigger:** Any change to `createActivityLog`, `updateActivityLog`, `processActivityLog`, or `create_activity_log_atomic`. Test all variable combinations below. Skipping any of these has caused regressions in production.

### Exercise type variables
- Exercise **with** form parameters (e.g. Theraband Row — has band_resistance form param). Verifies form_data is written to the correct set row.
- Exercise **without** form parameters (e.g. Ankle Inversion — Isometric — form_data is null in payload). Verifies no empty form_data rows are created.
- Exercise with pattern modifier only (`hold_seconds` or `duration_seconds` — not form_data). Verifies modifier fields are written without form_data confusion.
- Exercise with `distance_feet` set. Verifies distance is stored correctly alongside sets.
- Exercise with reps only (no seconds, no distance). The baseline case; must not regress.

### Set variables
- Single set. Baseline.
- Multiple sets (3+). Verify form_data ends up on the correct `set_number`, not shifted — a previous bug wrote all form_data to set 1.
- Sets with different form_data per set (e.g. set 1: band=blue, set 2: band=red). Verifies DN-004 fix is intact: each set's form_data is independent.
- Sets where set_number is not contiguous (e.g. 1, 3, 5 — edit flow). Verifies the edit path handles gaps in set_number without reordering or dropping data.

### Side variables
- `side = null` — bilateral exercises where both sides are done together. The side selector must be hidden in the UI; the payload must omit side or send null.
- `side = 'left'`
- `side = 'right'`
- `side = 'both'` is **NOT a valid DB value** — confirmed across 823 sets in production. Bilateral exercises log `side = null`, not `'both'`. Do not test for or produce this value. DN-063 tracks the Next.js UI parity fix.

### Log path variables
- Online, direct POST to `/api/logs` (`createActivityLog`). The primary path.
- Offline: log queued to localStorage, then synced via `syncOfflineQueue` → POST `/api/logs`. Same endpoint as online, different entry point — verifies queue serialization and sync correctness.
- Edit/update via PATCH to `/api/logs/:id` (`updateActivityLog`). Verifies existing log data is correctly overwritten without duplication.
- Sync path via POST to `/api/sync` (`processActivityLog`). Reachable endpoint; tests separately from the primary log path.

### Idempotency
- POST the same `client_mutation_id` twice. Must return 409 on the second request with no duplicate row created.
- After the double-post, confirm exactly one row exists in `patient_activity_logs` for that mutation ID.

### DB verification query
Run after any log submission to confirm the full data shape is correct end-to-end:
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
WHERE l.patient_id = '35c3ec8d-...'  -- replace with actual patient UUID
ORDER BY l.created_at DESC, s.set_number, f.parameter_name;
```
