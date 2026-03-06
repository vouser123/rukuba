# AI Workflow for Dev Tracking (`pt-rebuild`)

This workflow defines how agents (Codex/Claude) must track work using:
- Canonical source: `docs/dev_notes.json` (only hand-edited dev-tracking file)
- Generated artifact: `docs/DEV_NOTES.md`

## Tracker Split (Pilot Rule)

Until explicitly changed:

- NextJS migration/workstream tasks are tracked in **Beads**.
- Non-NextJS tasks remain tracked in `docs/dev_notes.json`.

Do not create duplicate items across both systems for the same task.
If a task crosses both domains, split it into two linked tasks (one in Beads, one in dev_notes) with explicit cross-reference.

## 1) Intake

### Planned work
- Locate existing issue ID (`DN-###`) in `open_items`.
- Confirm status, scope, and constraints before coding.

### Ad-hoc user requests (required rule)
- If requested work is **not already tracked**, create a new `DN-###` entry first (use the next available ID).
- Add at minimum: `status`, `priority`, `risk`, `tags`, `file`, and `issue`.
- Then begin implementation.

### Incident/regression work
- Open a dedicated `DN-###` item even if related to another task.
- Include clear context and constraints so follow-up agents can reproduce triage decisions.

## 2) Execute

- Implement changes.
- Keep `open_items` current with context/options/constraints as new findings appear.
- Do not hand-edit `docs/DEV_NOTES.md`.

## 3) Close-loop

When work is resolved:
1. Remove/resolve the corresponding `open_items` item.
2. Add a `dated_entries` record (newest-first when rendered) with exact field order:
   - `Problem`
   - `Root cause`
   - `Change made`
   - `Files touched`
   - `Validation`
   - `Follow-ups`
   - `Tags`
3. Run generator/check commands.

## When to update `open_items` vs `dated_entries`

- Use `open_items` for active, blocked, or in-progress work.
- Use `dated_entries` only for completed/resolved outcomes and shipped decisions.
- Keep IDs coherent: preserve existing `DN-###` numbering; only allocate new IDs at the next number.

## Required Commands

Run from `/pt-rebuild`:

```bash
npm run dev-notes:build
npm run dev-notes:check
```

Expected behavior:
- `dev-notes:build` rewrites `docs/DEV_NOTES.md` from JSON.
- `dev-notes:check` exits non-zero if Markdown and JSON are out of sync.
