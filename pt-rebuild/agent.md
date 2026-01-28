# Agent instructions for PT rebuild

This folder contains the Supabase/Vercel rebuild of the PT tracker app.

Follow these rules:

- Use `pt-rebuild/public/docs/DEVELOPMENT.md` as the authoritative documentation/architecture reference for this rebuild.
- Use `pt-rebuild/public/docs/DEV_PRACTICES.md` for day-to-day workflows and troubleshooting guidance.
- Record dated updates in `pt-rebuild/DEV_NOTES.md` after completing a fix.
- Keep this file short and avoid duplicating detailed guidance stored in the docs.
- The rebuild is Supabase-backed; keep offline-friendly behavior but do not add new external APIs without explicit instruction.
- Treat JSON schemas (when present) and vocabulary docs in `pt-rebuild/public/docs/vocabularies.md` as the source of truth for field names and data shape.
- Do not invent new field names when existing schema fields or vocab terms are available.
- Prefer plain JavaScript and browser APIs.
- When in doubt, reference the docs in `pt-rebuild/public/docs/` before making changes.
