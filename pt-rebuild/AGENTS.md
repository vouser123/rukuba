# Agent Instructions for PT Rebuild (`/pt-rebuild`)

This file governs agent behavior for work inside `pt-rebuild/`.

## Canonical References

- `pt-rebuild/docs/NEXTJS_STRUCTURE.md` - file size limits, split rules, cohesion checks, folder structure, naming conventions
- `pt-rebuild/docs/DEVELOPMENT.md` - architecture and implementation reference
- `pt-rebuild/docs/DEV_PRACTICES.md` - day-to-day workflow and troubleshooting
- `pt-rebuild/docs/vocabularies.md` - canonical field names and data contracts
- `pt-rebuild/docs/dev_notes.json` - canonical development tracking log (source of truth)
- `pt-rebuild/docs/AI_WORKFLOW.md` - required intake/execute/close-loop workflow
- `pt-rebuild/docs/TESTING_CHECKLISTS.md` - all regression, parity, and verification checklists for pt-rebuild/

## Core Rules

- Use a docs-first workflow: check the canonical references before editing code.
- Do not invent new field names when existing vocabulary/schema terms are available.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns (`pointerup`, touch-safe UI behavior).
- Respect Vercel/serverless limits: avoid endpoint sprawl and prefer extending existing handlers.
- MUST obtain explicit user permission before any UX behavior change.
- DO NOT simplify, alter, or remove existing UX semantics during migration/refactor without approval.
- This includes (non-exhaustive): labels/copy, thresholds, status buckets, icons, defaults, sort/order behavior, visibility rules, interaction patterns, fallback states, and summary text/details.
- If parity is unclear: stop, surface the exact proposed UX delta, and wait for user approval before implementing.

## iOS PWA Interaction Rules

- Always use `touch-action: manipulation` on interactive elements.
- Use `pointerup` events instead of `onclick` for reliable touch handling.
- Include `-webkit-tap-highlight-color: transparent` on buttons.
- Minimum touch target size: 44px (Apple HIG).

## Session Startup: Deferred Item Check (Required)

At the start of every session, scan `open_items` in `pt-rebuild/docs/dev_notes.json` for items where `scope === "deferred"`. (Only `open_items` needs checking — `closed_items` contains only `done` items.) For each deferred item, evaluate whether its `reactivate_when.trigger` condition is now met:

- `deployment_scope_change` — check whether the number of active users in the `users` table exceeds 2, or whether there is any indication of a planned expansion. If yes, surface the item to the user before proceeding.
- `query_volume_sufficient` — check Supabase performance advisor notes or recent traffic context. If real sustained traffic exists, surface the item.
- `api_capacity_available` — check current Vercel function count against the free-tier limit (12). If capacity has changed, surface the item.

If no trigger conditions are met, proceed without surfacing deferred items. Do not re-open or act on deferred items autonomously — surface them to the user for a decision.

## Dev Notes Workflow (Required)

- Canonical tracking file: `pt-rebuild/docs/dev_notes.json` (the only hand-edited dev-tracking file).
- Generated artifact: `pt-rebuild/docs/DEV_NOTES.md` (never hand-edit).
- After any change to dev notes JSON, run `npm run dev-notes:build`.
- Before finishing, run `npm run dev-notes:check` to ensure no drift.

## Validation Preference

- Prefer Vercel deployment checks/logs as the default validation path for routine changes.
- Run local `npm run build` only when Vercel signal is insufficient, when debugging environment-specific issues, or before especially risky refactors.

### Item arrays and status rules

- `open_items`: active work queue. Only statuses `open`, `in_progress`, or `blocked` belong here.
- `closed_items`: completed items. Only status `done` belongs here.
- **Never** put a `done` item in `open_items`, or a non-`done` item in `closed_items`. The generator enforces this and will fail the build if violated.

| Status | Array | Meaning |
|---|---|---|
| `open` | `open_items` | Tracked, not yet started |
| `in_progress` | `open_items` | Actively being worked on this session |
| `blocked` | `open_items` | Cannot proceed — blocker documented in `constraints_caveats` |
| `done` | `closed_items` | Resolved — has `resolved` date and all 6 closure narrative fields on the item |

### Lifecycle enforcement: intake → execute → close-loop

1. **Intake**
   - For every request, check whether work already exists in `open_items`.
   - If user asks for ad-hoc work not already tracked, create a new issue ID (`DN-###`, next available number) in `open_items` before execution or at the start of execution.
   - Every new open item **must** include an `agent` field (array). Use `["codex"]`, `["claude"]`, or `["codex", "claude"]`. Use `["unassigned"]` only if genuinely unclear — but triage it before proceeding.
   - Note: Codex can live-test preview UI flows when Playwright skill/extension is available. Codex still cannot access Vercel logs or query Supabase directly unless explicitly provided that access. If any part of a task requires those steps, assign `["claude"]` for the whole item — Claude can choose to hand off the coding portion to Codex within a session, but ownership stays with Claude.
2. **Execute**
   - Set status to `in_progress` in `open_items` while work is active.
3. **Close-loop**
   - When resolved: set `status` to `done`, add `resolved` date, move the item from `open_items` to `closed_items`, and fill all 6 closure narrative fields directly on the closed item: `problem`, `root_cause`, `change_made`, `files_touched`, `validation`, `follow_ups`.
   - Legacy pre-DN entries use `LE-###` IDs and live in `closed_items` alongside `DN-###` items.
   - `pt-rebuild/docs/HISTORY.md` is a read-only archive for pre-structured notes; agents do not need to read or update it.
   - Regenerate Markdown after JSON edits.

## Routine Codex Use: Parity Checking

Codex is effective at **behavioral parity checks** — comparing a new Next.js component against the corresponding static HTML to find differences in behavior, options, defaults, or logic.

Use this routinely, not just when a problem is already suspected:
- When a component is freshly ported from static HTML
- When a component is modified as part of a migration fix
- After a testing session surfaces a gap — ask Codex to scan for similar gaps elsewhere

**How to assign:** Give Codex both the static source file (e.g. `public/index.html`) and the new component (e.g. `components/SessionLoggerModal.js`) and ask it to list behavioral differences. Be specific about which feature area to check (side selector, form params, timer behavior, etc.).

Codex can live-test preview UI flows when Playwright is available, and can also read code for static parity checks.

Before coding any UX change found during parity review:
- Present the exact behavior diff to the user (what changes from current behavior).
- Ask for explicit approval.
- Only then implement.

### UX_APPROVED criteria (required)

For any non-parity UX change, approval must be recorded in the related `DN-###` item context using a `UX_APPROVED:` note.  
Approval is valid only when all of the following are explicit:
- Exact surface: page/component/flow being changed.
- Exact delta: before → after behavior (specific labels, thresholds, defaults, ordering, visibility, interactions).
- Scope boundary: what is included and what is explicitly not included.
- Validation target: what will be checked after implementation.

Rules:
- Approval is **not** global. A yes for one UX change does not approve any other UX change.
- Approval is **not** transferable across DNs unless the user says so explicitly.
- If implementation uncovers additional UX deltas, stop and request a new explicit approval.

Consent-style enforcement:
- Specific: approval must identify the exact UX change; broad or ambiguous approval is invalid.
- Informed: approval must be based on a clear before/after description.
- Scoped: approval applies only to the named surface and DN.
- Revocable: user can withdraw approval at any time; stop immediately and revert/re-plan if requested.

## Testing Checklists

See [`pt-rebuild/docs/TESTING_CHECKLISTS.md`](docs/TESTING_CHECKLISTS.md) for all regression and parity testing checklists, including the Activity Log Testing Checklist (exercise types, set variables, side variables, log paths, idempotency, DB verification query).

## Change Hygiene

- Keep instructions concise and avoid duplicating detailed architecture from docs.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.

