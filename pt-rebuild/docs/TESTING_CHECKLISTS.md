# PT Rebuild Testing Checklists

Canonical checklist reference for `pt-rebuild/`. Loaded by `AGENTS.md`. New checklists are added here.

---

## Activity Log Testing Checklist

**Trigger:** Any change to `createActivityLog`, `updateActivityLog`, `processActivityLog`, or `create_activity_log_atomic`. All combinations below must pass. Skipping any has caused regressions.

**Exercise type** — test each:
- form parameters present (e.g. Theraband Row — band_resistance)
- no form parameters (e.g. Ankle Inversion Isometric — form_data null in payload)
- pattern modifier only: `hold_seconds` or `duration_seconds`
- `distance_feet` set
- reps only (no seconds, no distance)

**Set count** — test each:
- single set
- 3+ sets — verify form_data lands on correct set_number, not shifted (DN-004)
- different form_data per set (e.g. set 1: band=blue, set 2: band=red)
- non-contiguous set_numbers (e.g. 1, 3, 5) — edit flow only

**Side** — test each:
- `side = null` — bilateral exercise; side selector must be hidden; null logged
- `side = 'left'`
- `side = 'right'`
- `side = 'both'` is NOT a valid DB value (confirmed 823 sets in production). DN-063 tracks the Next.js fix.

**Log path** — test each:
- online POST `/api/logs` (createActivityLog)
- offline: queue to localStorage → sync via `syncOfflineQueue` → POST `/api/logs`
- edit: PATCH `/api/logs/:id` (updateActivityLog)
- sync: POST `/api/sync` (processActivityLog) — separate test

**Idempotency:**
- POST same `client_mutation_id` twice → must 409, no duplicate row
- Confirm exactly one row in `patient_activity_logs` after double-post

**DB verification query:**
```sql
SELECT
  l.id AS log_id, l.exercise_name,
  s.set_number, s.reps, s.seconds, s.distance_feet, s.side, s.manual_log,
  f.parameter_name, f.parameter_value, f.parameter_unit
FROM patient_activity_logs l
LEFT JOIN patient_activity_sets s ON s.activity_log_id = l.id
LEFT JOIN patient_activity_set_form_data f ON f.activity_set_id = s.id
WHERE l.patient_id = '35c3ec8d-...'  -- replace with actual patient UUID
ORDER BY l.created_at DESC, s.set_number, f.parameter_name;
```
