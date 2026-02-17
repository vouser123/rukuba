# API Slot Strategy Memo (Vercel Free-Tier 12 Function Files)

_Date:_ 2026-02-17  
_Scope:_ `/pt-rebuild/api`  
_Purpose:_ Preserve the analysis performed in this session so future local Codex runs can reuse it instead of repeating discovery work.

## Why this exists

The app is currently at 12 API files in `/pt-rebuild/api`, matching the Vercel free-tier constraint referenced by the team. This memo captures:

1. What each API file currently does
2. Which front-end callsites depend on each endpoint
3. Cost/benefit and break-risk analysis for possible merges/splits
4. A risk-first recommendation for better use of the same 12 slots

## Current API file inventory (12)

1. `api/env.js`
2. `api/debug.js`
3. `api/logs.js`
4. `api/reference-data.js`
5. `api/roles.js`
6. `api/sync.js`
7. `api/users.js`
8. `api/vocab.js`
9. `api/programs/index.js`
10. `api/programs/[id].js`
11. `api/exercises/index.js`
12. `api/exercises/[id].js`

## Endpoint roles and active usage

### `api/env.js`
- Purpose: expose `SUPABASE_URL` + `SUPABASE_ANON_KEY` for browser bootstrap.
- Called from:
  - `public/index.html`
  - `public/pt_view.html`
  - `public/js/pt_editor.js`
  - `public/reset-password.html`
- Operational note: tiny endpoint, high fan-out dependency.

### `api/debug.js`
- Purpose: admin-only auth-context debugging helper.
- Called from: no current app UI callsites found in `public/`.
- Operational note: optional in production depending on support/debug workflow.

### `api/logs.js`
- Purpose: dual-domain endpoint.
  - Activity logs CRUD (`GET/POST/PATCH/DELETE /api/logs`)
  - Clinical messages CRUD (`/api/logs?type=messages`)
- Called from:
  - `public/index.html`
  - `public/pt_view.html`
  - `public/rehab_coverage.html`
  - `public/js/offline.js` (log preload)
- Risk note: highest blast radius file due to mixed clinical domains + many callsites.

### `api/sync.js`
- Purpose: offline queue processing (`POST /api/sync`) + audit insert.
- Called from:
  - `public/js/offline.js`
- Risk note: already has deferred P0/P1 hardening TODOs; avoid coupling until hardened.

### `api/users.js`
- Purpose: role-filtered user list.
- Called from:
  - `public/index.html`
  - `public/pt_view.html`
- Note: has TODO to push role filtering into SQL query instead of in-memory filtering.

### `api/roles.js`
- Purpose: exercise role mappings for rehab coverage and editor role CRUD.
- Called from:
  - `public/rehab_coverage.html`
  - `public/js/pt_editor.js`
- Note: cohesive domain boundary today.

### `api/reference-data.js`
- Purpose: dynamic distinct values (equipment, muscles, form parameters).
- Called from:
  - `public/js/pt_editor.js`
- Note: conceptually different from controlled vocab tables.

### `api/vocab.js`
- Purpose: controlled vocabulary API (GET/POST/PUT/DELETE).
- Called from:
  - `public/js/pt_editor.js`
- Note: editorial taxonomy ownership; separate lifecycle from dynamic reference data.

### `api/programs/index.js` + `api/programs/[id].js`
- Purpose: route wrappers only; both delegate to `lib/handlers/programs.js`.
- Called from:
  - `public/index.html`
  - `public/pt_view.html`
  - `public/js/pt_editor.js`
  - `public/js/offline.js`
- Note: good candidate for structural consolidation (same handler).

### `api/exercises/index.js` + `api/exercises/[id].js`
- Purpose: route wrappers only; both delegate to `lib/handlers/exercises.js`.
- Called from:
  - `public/index.html`
  - `public/js/pt_editor.js`
  - `public/js/offline.js`
- Note: good candidate for structural consolidation (same handler).

## Cost-benefit matrix (risk heavily weighted)

## A) Wrapper consolidation (programs + exercises)

- Change type: structural consolidation only (reduce duplicate route-wrapper files).
- Benefit:
  - Frees 2 slots while preserving existing business logic modules.
  - Reduces maintenance duplication at route-entry layer.
- Cost/risk:
  - Low-to-moderate (route semantics/testing/deployment rewrite behavior).
- Net: **Benefit > Cost** (best first move if rebalancing slots).

## B) Split `logs.js` into dedicated `logs` + `messages` files

- Change type: domain isolation.
- Benefit:
  - Better fault isolation (message changes less likely to impact activity logs).
  - Cleaner auth and validation boundaries per domain.
  - Easier future hardening and ownership.
- Cost/risk:
  - High currently (many callsites and query-param contract `type=messages`).
  - Migration risks across patient + therapist flows.
- Net: **Conditional**:
  - Near-term stability mode: **Cost > Benefit**.
  - Medium-term maintainability mode (with careful migration): can become **Benefit > Cost**.

## C) Merge `vocab.js` + `reference-data.js`

- Benefit: saves 1 slot.
- Cost/risk:
  - Couples controlled vocab administration with dynamic usage-derived reference data.
  - Increases accidental cross-impact in editor metadata flows.
- Net: **Cost > Benefit**.

## D) Merge `sync.js` into `logs.js` (or elsewhere)

- Benefit: saves 1 slot.
- Cost/risk:
  - `sync.js` has unresolved security/data-integrity TODOs.
  - Merging before hardening expands blast radius.
- Net: **Cost > Benefit**.

## E) Remove/relocate `debug.js`

- Benefit: saves 1 slot.
- Cost/risk:
  - Low if ops team does not rely on it in production.
  - Moderate if incident playbooks depend on it.
- Net: usually **Benefit > Cost**, but depends on support workflow.

## Recommended slot strategy (risk-first)

1. **Do first:** consolidate wrapper duplication (`programs` pair + `exercises` pair).
2. **Then decide:** keep or remove `debug.js` based on operational need.
3. **Only after that:** consider whether to spend reclaimed slot(s) on a dedicated messages endpoint for cleaner boundaries.
4. **Avoid for now:** merging `sync`, `users`, `roles`, `vocab`, `reference-data` into broader multi-domain files.

This yields safer architecture evolution than pushing more behaviors into already-complex endpoints.

## Dependency map to reuse in future Codex runs

Use these callsite searches first before endpoint changes:

- `/api/logs` and `/api/logs?type=messages`:
  - `public/index.html`
  - `public/pt_view.html`
  - `public/rehab_coverage.html`
  - `public/js/offline.js`
- `/api/programs`:
  - `public/index.html`
  - `public/pt_view.html`
  - `public/js/pt_editor.js`
  - `public/js/offline.js`
- `/api/exercises`:
  - `public/index.html`
  - `public/js/pt_editor.js`
  - `public/js/offline.js`
- `/api/users`: `public/index.html`, `public/pt_view.html`
- `/api/roles`: `public/rehab_coverage.html`, `public/js/pt_editor.js`
- `/api/vocab`: `public/js/pt_editor.js`
- `/api/reference-data`: `public/js/pt_editor.js`
- `/api/sync`: `public/js/offline.js`
- `/api/env`: `public/index.html`, `public/pt_view.html`, `public/js/pt_editor.js`, `public/reset-password.html`

## Validation snapshot used for this memo

- Read API file inventory from `/pt-rebuild/api`.
- Traced endpoint callsites in `public/` and `public/js/` with `rg`.
- Reviewed docs noting function-limit guidance and prior route merges.
- Confirmed no code behavior changes were made in this session.

