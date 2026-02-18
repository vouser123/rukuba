# Claude Instructions for PT Rebuild

This folder contains the Supabase/Vercel rebuild of the PT tracker app.

Operational rules and required final steps are in `pt-rebuild/AGENTS.md` — follow those for all work.

## Quick Reference

| Document | Purpose |
|----------|---------|
| `/pt-rebuild/docs/DEVELOPMENT.md` | Architecture reference, API endpoints, data models |
| `/pt-rebuild/docs/DEV_PRACTICES.md` | Day-to-day workflows, troubleshooting |
| `/pt-rebuild/docs/DEV_NOTES.md` | Canonical ops log (`Open Items` + dated entries) |
| `/pt-rebuild/docs/vocabularies.md` | Controlled vocabulary for field names |
| `/pt-rebuild/AGENTS.md` | Canonical operational guidance for all agents |

## File Structure

- `/pt-rebuild/public/index.html` - Main patient-facing exercise tracker
- `/pt-rebuild/public/pt_view.html` - Therapist-facing dashboard
- `/pt-rebuild/public/js/pt_editor.js` - Exercise program editor
- `/pt-rebuild/api/` - Vercel serverless functions (9 files, at free-tier limit — do not add new files)
- `/pt-rebuild/lib/` - Shared utilities and Supabase client

## Data Model

- **patient_programs** - Exercise assignments with dosage (sets, reps, seconds)
- **patient_activity_logs** - Session logs with sets array (performed_at, sets[], notes)
- **clinical_messages** - PT-patient messaging (served via logs.js API)

## Open Work

See `pt-rebuild/docs/DEV_NOTES.md` under `Open Items` for all tracked issues with priority, risk, context, and constraints.
