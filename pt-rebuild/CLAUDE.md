# Claude Instructions for PT Rebuild

This folder contains the Supabase/Vercel rebuild of the PT tracker app.

## Quick Reference

| Document | Purpose |
|----------|---------|
| `/pt-rebuild/public/docs/DEVELOPMENT.md` | Architecture reference, API endpoints, data models |
| `/pt-rebuild/public/docs/DEV_PRACTICES.md` | Day-to-day workflows, troubleshooting |
| `/pt-rebuild/DEV_NOTES.md` | Dated updates and milestones - **add notes here after changes** |
| `/pt-rebuild/public/docs/vocabularies.md` | Controlled vocabulary for field names |
| `/pt-rebuild/agent.md` | Brief operational guidance |

## Key Rules

1. **Documentation First**: Reference docs in `/pt-rebuild/public/docs/` before making changes
2. **Record Changes**: Add dated entries to `DEV_NOTES.md` after completing any fix or feature
3. **Schema Compliance**: Use field names from `vocabularies.md` - do not invent new ones
4. **Plain JavaScript**: Prefer browser APIs, no external dependencies without explicit instruction
5. **Vercel Limits**: Do not add new API files - merge endpoints into existing files (e.g., messages API merged into logs.js)

## File Structure

- `/pt-rebuild/public/index.html` - Main patient-facing exercise tracker
- `/pt-rebuild/public/pt_view.html` - Therapist-facing dashboard
- `/pt-rebuild/public/js/pt_editor.js` - Exercise program editor
- `/pt-rebuild/api/` - Vercel serverless functions (auth.js, logs.js, users.js, programs.js)
- `/pt-rebuild/lib/` - Shared utilities and Supabase client

## Data Model

- **exercise_programs** - Exercise definitions with dosage (sets, reps, seconds)
- **exercise_logs** - Session logs with sets array (performed_at, sets[], notes)
- **clinical_messages** - PT-patient messaging (merged into logs.js API)

## iOS PWA Considerations

- Always use `touch-action: manipulation` on interactive elements
- Use `pointerup` events instead of `onclick` for reliable touch handling
- Include `-webkit-tap-highlight-color: transparent` on buttons
- Minimum touch target size: 44px (Apple HIG)

## Remaining Work (TODOs in Code)

Search codebase for `TODO:` comments — each has priority and risk level. Summary:

| Priority | File | Issue |
|----------|------|-------|
| P0 | `api/sync.js` | Uses anon Supabase client, should use auth-context (`getSupabaseWithAuth`) |
| P0 | `api/logs.js` | No therapist→patient auth check when `patient_id` differs from caller |
| P1 | `api/sync.js` | No cleanup of orphaned log if sets insert fails |
| P1 | `api/logs.js` (x2) | Form data matched to sets by array index, not `set_number` (HIGH RISK to change) |
| P1 | `public/js/offline.js` | `addToQueue` resolves on `request.onsuccess` not `tx.oncomplete` |
| P2 | `api/users.js` | Fetches all users then filters in memory instead of DB-level filtering |
| P3 | `public/js/hamburger-menu.js` | Menu structure inconsistent across 4 HTML pages |

Full details with rationale in `DEV_NOTES.md` under "Remaining Work (For Next Session)".

## Post-Change Checklist

1. Test on iOS Safari/PWA if UI changes
2. Verify dark mode support
3. Update `DEV_NOTES.md` with dated entry
4. Commit with clear message
