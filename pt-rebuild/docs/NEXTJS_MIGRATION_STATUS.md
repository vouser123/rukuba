# Next.js Migration Status

Use this file for migration status, phase history, and rollout decisions.

Do not use this file as the live codebase map. Use [`../README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md) for that.
Do not use this file for Next.js file-structure rules. Use [`NEXTJS_CODE_STRUCTURE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_CODE_STRUCTURE.md) for that.
Do not use this file for verification checklists. Use [`TESTING_CHECKLISTS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/TESTING_CHECKLISTS.md).

## Current Strategy

- Migration work continues on `nextjs` while unmigrated surfaces remain.
- Verified page slices may be merged incrementally to `main`.
- Production cutover happens page by page after preview verification, not as one final all-at-once release.

This resolves the older contradictory wording: `nextjs` is still the active migration branch, but incremental page-level merges to `main` are the active rollout strategy.

## Current Status

As of 2026-03-20:

- Phase 1: `/rehab` migrated and verified.
- Phase 2: `/pt-view` migrated and verified.
- Phase 3: `/program` migrated through the verified core editor work; vocabulary/editor follow-up work may still remain.
- Phase 4: tracker (`index`) migration is still in progress.

Preview URL for the `nextjs` branch:
`https://pt-rehab-git-nextjs-pt-tracker.vercel.app`

## Working Rules

- Keep the Strangler Fig pattern: legacy and Next.js surfaces coexist until each legacy page is retired.
- Do not assume a route is fully retired just because a Next.js version exists.
- Continue using the legacy static pages as parity baselines until the relevant cutover is complete.

## Verification Notes

Useful Vercel CLI commands for migration verification:

- Preview deployments list (JSON): `npx vercel@latest ls --environment preview --format json`
- Inspect deployment summary: `npx vercel@latest inspect <deployment-url-or-id>`
- Inspect build logs: `npx vercel@latest inspect <deployment-url-or-id> --logs`
- Runtime logs (historical window): `npx vercel@latest logs --environment preview --level error --since 2h --no-branch --limit 200`
- Runtime logs for deployment URL (historical): `npx vercel@latest logs <deployment-url> --no-follow`

Known syntax pitfalls captured during DN-039:

- `vercel ls` does not support `--branch`
- `vercel inspect` does not support `--no-clipboard`
- `vercel logs` with a deployment URL implies follow mode; use `--no-follow` when filtering by time

## Phase Snapshots

### Phase 1: Scaffold plus rehab coverage

Status: complete

Delivered:

- Next.js scaffold and shared app entry
- shared auth/client foundations
- `/rehab` migration

### Phase 2: PT view

Status: complete

Delivered:

- `/pt-view` route
- shared messaging/history support needed by the PT-facing dashboard

### Phase 3: Program editor

Status: partially complete

Verified slices:

- core exercise management
- roles editing
- dosage modal integration

Follow-up work can still exist under Beads even after the main phase slice is considered migrated.

### Phase 4: Tracker index

Status: in progress

This remains the highest-risk migration slice because it includes:

- active logging flow
- timer and audio behavior
- messages/history parity
- offline queue and sync behavior
- cutover of the main tracker route

## Rollout Pattern

Use this pattern for each migrated page slice:

1. Implement on `nextjs`.
2. Validate on preview.
3. Merge the verified slice to `main`.
4. Validate production behavior.
5. Retire or remap the old legacy page when appropriate.

## Agent Note

Website-only Codex sessions that clone `main` may miss migration-only work that still lives on `nextjs`. For branch-specific migration work, use a local session with the correct branch available.
