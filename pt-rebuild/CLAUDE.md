# Claude Instructions for PT Rebuild

This folder contains the Supabase/Vercel rebuild of the PT tracker app.

Operational rules and required final steps are in `pt-rebuild/AGENTS.md` — follow those for all work.

## Quick Reference

| Document | Purpose |
|----------|---------|
| `/pt-rebuild/docs/DEVELOPMENT.md` | Architecture reference, API endpoints, data models |
| `/pt-rebuild/docs/DEV_PRACTICES.md` | Day-to-day workflows, troubleshooting |
| `/pt-rebuild/docs/dev_notes.json` | Canonical ops log source (`open_items` + `dated_entries`) |
| `/pt-rebuild/docs/DEV_NOTES.md` | Generated dev log artifact (do not hand-edit) |
| `/pt-rebuild/docs/AI_WORKFLOW.md` | Intake → execute → close-loop workflow for agents |
| `/pt-rebuild/docs/vocabularies.md` | Controlled vocabulary for field names |
| `/pt-rebuild/AGENTS.md` | Canonical operational guidance for all agents |

## Required Dev-Tracking Rules

- JSON is canonical: `docs/dev_notes.json` is the only hand-edited dev-tracking file.
- Markdown is generated: run `npm run dev-notes:build` after JSON changes.
- Drift check is required before handoff: `npm run dev-notes:check`.
- Lifecycle is mandatory: **intake → execute → close-loop**.
- **Docs sync (Claude task only):** After every commit on the `nextjs` branch that touches `docs/NEXTJS_MIGRATION.md`, `docs/dev_notes.json`, or `docs/DEV_NOTES.md`, run `npm run sync-docs` to copy all three to `main`. The user never runs this — it is always Claude's responsibility.
  - Intake rule for ad-hoc requests: if work is not already tracked, create a new `DN-###` item in `open_items` before or at start of execution.
  - Close-loop rule: when resolved, remove/resolve from `open_items` and add a `dated_entries` record using required field order.

## File Structure

- `/pt-rebuild/public/index.html` - Main patient-facing exercise tracker
- `/pt-rebuild/public/pt_view.html` - Therapist-facing dashboard
- `/pt-rebuild/public/js/pt_editor.js` - Exercise program editor
- `/pt-rebuild/api/` - Vercel serverless functions (9 files, at free-tier limit — do not add new files)
- `/pt-rebuild/lib/` - Shared utilities and Supabase client
