# PT Rebuild - Development Notes

Going forward, entries should follow this structure as applicable:
- Problem
- Root cause
- What I did
- Fix applied
- Notes

## Table of Contents
- [2026-01-26](#2026-01-26)

---

## 2026-01-26

- **2026-01-26** — **Problem:** Index and PT Editor flows returned empty program lists or failed to save dosages; error handling surfaced "Body is disturbed or locked" instead of real API errors. **Root cause:** Front-end sent Supabase auth UUIDs as `patient_id`, but `/api/programs` queried `patient_programs.patient_id` (users.id). Additionally, error handlers attempted to read response bodies twice, causing the body stream to be locked. **What I did:** (1) Added a resolver in `/api/programs` to map either users.id or auth_id to the canonical users.id before authorization checks and writes. (2) Updated fetch helpers to read response bodies once and parse JSON when possible. **Fix applied:** Program fetch/create now accepts auth IDs without returning empty results or RLS failures, and error messages reflect the real API payload. **Notes:** Keep passing auth UUIDs from clients only if the resolver remains in place; otherwise return to users.id wiring.

- **2026-01-26** — **Problem:** Needed a quick, in-repo reference for the current table layout. **Root cause:** Schema references were only shared out-of-band. **What I did:** Added a table layout reference under `/docs` with the supplied schema snapshot and execution warning. **Fix applied:** `docs/TABLE_LAYOUT.md` now documents the schema for quick lookup. **Notes:** Keep this in sync with future migrations.
