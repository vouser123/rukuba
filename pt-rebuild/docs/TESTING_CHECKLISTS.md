# Next.js Migration Testing Checklists

Reference checklists for regression and parity testing during the Next.js migration. Applies to Next.js components and pages in `pt-rebuild/`. Linked from `AGENTS.md` and relevant dev notes.

**Loaded by:** `AGENTS.md`

---

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
- `side = null` (bilateral exercises — both sides together, side selector hidden)
- `side = 'left'`
- `side = 'right'`
- Note: `side = 'both'` is NOT a valid DB value — confirmed across 823 sets in production. Bilateral exercises log `side = null`. (See DN-063 for Next.js parity fix.)

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
