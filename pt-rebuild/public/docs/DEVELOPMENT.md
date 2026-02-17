# PT Tracker Rebuild - Development Guide

This document describes the Supabase/Vercel rebuild located in `/pt-rebuild`.

## System overview

PT Tracker Rebuild is a static frontend served from `/pt-rebuild/public` with a small set of Vercel serverless API routes in `/pt-rebuild/api`. Supabase is the single source of truth for user data and exercise content. The frontend calls the API routes, which proxy to Supabase using the authenticated user access token.

Key traits:
- **Frontend:** static HTML/CSS/JS in `/pt-rebuild/public`.
- **Backend:** Vercel serverless functions in `/pt-rebuild/api`.
- **Data store:** Supabase Postgres.
- **Auth:** Supabase Auth; API routes use `requireAuth` middleware.

## File reference

- `pt-rebuild/public/`
  - `index.html`: main tracker UI entry point (patient exercises + logging).
  - `pt_view.html`: PT-facing view (read-only / review patient progress).
  - `pt_editor.html`: exercise editor (create/edit exercises).
  - `rehab_coverage.html`: rehab coverage view (manage exercise roles).
  - `js/`: app scripts including `offline.js` (IndexedDB cache), `pt_editor.js`, `report.js`.
  - `js/vendor/supabase.min.js`: self-hosted Supabase SDK (auto-updated monthly via GitHub Action).
  - `css/`: stylesheets.
  - `sw.js`, `manifest.json`: PWA shell (service worker caches static assets).
  - `icons/icon.svg`: PT² app icon (dark grey background, powder blue superscript 2).
  - `docs/`: rebuild-specific docs (this folder).
- `pt-rebuild/api/`: Vercel API routes (see below).
- `pt-rebuild/lib/`: Supabase client, auth helpers (`requireAuth`, `requirePatient`, `requireTherapist`, `requireTherapistOrAdmin`), and shared handlers.
- `pt-rebuild/db/`: migration scripts and DB utilities.
- `.github/workflows/update-supabase-sdk.yml`: GitHub Action to auto-update Supabase SDK monthly.

## API routes

These API routes are the public surface area for the frontend. Keep route count low to stay within Vercel’s Hobby plan limits.

- `GET /api/env` → returns Supabase URL + anon key.
- `GET/POST/PUT/DELETE /api/exercises` → manage exercises + related metadata.
- `GET/POST/PUT /api/programs` → manage patient programs (dosages/prescriptions).
- `GET/POST /api/logs` → manage activity logs + sets + form data.
- `GET/POST/PATCH/DELETE /api/logs?type=messages` → clinical messages (PT-patient communication).
- `GET/POST/DELETE /api/roles` → exercise roles/coverage.
- `GET /api/reference-data` → reference tables (equipment, muscles, form params).
- `GET /api/vocab` → vocabulary tables.
- `GET /api/users` → user lookup.
- `POST /api/sync` → sync logs payloads.

## Data model (Supabase)

Core tables used by the API layer:
- `users` — app-specific user profiles (role, therapist linkage, auth_id).
- `exercises` — canonical exercise definitions.
- `exercise_equipment`, `exercise_muscles`, `exercise_pattern_modifiers`, `exercise_form_parameters`, `exercise_guidance` — normalized exercise metadata.
- `exercise_roles` — rehab coverage roles/regions.
- `patient_programs` — assigned exercises + dosage.
- `patient_activity_logs`, `patient_activity_sets`, `patient_activity_set_form_data` — logged activity history.
- `clinical_messages` — bidirectional PT-patient messaging.

## Auth + security

- API routes are wrapped with `requireAuth` from `pt-rebuild/lib/auth.js`.
- The frontend must pass the Supabase access token so API routes can query as the authenticated user.
- Role-based checks are enforced in the API routes (patient vs therapist vs admin).

## Environment configuration

Vercel expects the following environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`/api/env` exposes these to the frontend.

## Deployment notes

- Vercel Hobby plan limits the number of serverless functions per deployment. Keep routes consolidated and avoid redundant function files.
- Shared handlers live in `pt-rebuild/lib/handlers/` so multiple route entries can reuse the same logic.
