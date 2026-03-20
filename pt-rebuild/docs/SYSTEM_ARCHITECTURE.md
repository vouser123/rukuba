# PT Tracker System Architecture

Use this file for the live system shape of `pt-rebuild/`.

Use [`../README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md) for the current file-ownership map.
Use [`NEXTJS_CODE_STRUCTURE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_CODE_STRUCTURE.md) for Next.js organization rules.

## System Overview

PT Tracker is currently a hybrid application:

- A legacy static surface still lives in `public/` and remains parity-relevant for unmigrated or recently migrated behavior.
- A Next.js surface lives in `pages/`, `components/`, `hooks/`, and the Next.js-layer files in `lib/`.
- Vercel serverless routes in `api/` continue to serve both the legacy and Next.js surfaces.
- Supabase remains the system of record for auth and application data.

This architecture is intentional during the migration. Do not assume the repo is either "all static" or "all Next.js."

## Runtime Surfaces

### Legacy Static Surface

`public/` still matters because legacy HTML pages remain the behavioral baseline for parity work.

Use the legacy surface when:

- checking parity against a static page such as `public/index.html`
- verifying behavior that has not been fully retired
- tracing older PWA or static asset behavior

### Next.js Surface

`pages/`, `components/`, `hooks/`, and the Next.js-layer utilities in `lib/` are the active implementation surface for migrated routes.

Use the Next.js surface when:

- working on `/rehab`, `/pt-view`, `/program`, or the migrated tracker route
- extracting shared UI, hooks, or pure helpers
- updating current offline-capable route behavior

### API Surface

`api/` remains the shared backend layer for both app surfaces.

Keep API route count lean. Prefer shared handlers and existing endpoints over entry-point sprawl.

## Data And Auth Model

- Supabase is the source of truth for user, exercise, program, activity-log, and messaging data.
- API routes enforce auth and role checks through the shared auth helpers in `lib/auth.js`.
- Frontend surfaces should use shared client/auth utilities rather than creating ad hoc Supabase clients.
- Avoid direct frontend-to-database patterns unless an existing shared architecture doc explicitly says otherwise.
- The app has two user identifiers that must not be mixed:
  - `auth.users.id` / `session.user.id`: the auth-session identifier used for sign-in and message sender/recipient auth references
  - `users.id`: the application profile identifier used for patient-scoped data such as programs and logs
- Patient-scoped routes must resolve an effective patient context from the `users` table before reading or writing patient data. For current Next.js pages, the shared frontend helper is `resolvePatientScopedUserContext(...)` in `lib/users.js`.

Core domains still in active use:

- users and therapist/patient context
- exercise library and related metadata
- patient programs and dosage
- activity logs, sets, and per-set form data
- clinical messages

## Offline And Storage Model

- Preserve offline behavior and PWA-safe interaction patterns.
- For current Next.js work, IndexedDB-backed storage is the preferred offline persistence layer.
- Do not introduce new `localStorage`-backed persistence for app data or queue state.
- Treat offline route bootstrap, queued writes, and auth persistence as architecture-level concerns, not one-off page hacks.

## Implementation Guardrails

### Frontend Work

- Legacy UI changes belong in `public/*.html`, `public/js`, and `public/css` when the legacy surface still owns that behavior.
- Next.js UI changes belong in `pages/`, `components/`, `hooks/`, and Next.js-layer `lib/` files when the migrated surface owns that behavior.
- Keep file ownership boundaries aligned with [`../README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md).

### API Work

- Route entry points live in `api/`.
- Shared handlers should be reused whenever possible to keep the function count under control.
- Keep API behavior consistent across legacy and Next.js callers.

### Supabase Access

- Use the shared backend auth/database helpers on the API side.
- Avoid bypassing the existing auth and role-check flow.

## Deployment Guardrails

- Vercel is the deployment target.
- Keep the serverless function footprint lean enough for the current plan constraints.
- Confirm required environment values remain available:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Prefer preview-based validation for routine doc or migration follow-up work unless a riskier change needs extra local checks.

## Documentation Maintenance

- Update docs when architecture, route ownership, data contracts, or operational workflows materially change.
- Keep active workflow docs small in number and clear in purpose.
- Use [`README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md) as the live file map, not as a catch-all architecture narrative.
- The retired dev-notes system now lives under [`archive/dev-notes/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/archive/dev-notes); do not treat it as the active tracker.
