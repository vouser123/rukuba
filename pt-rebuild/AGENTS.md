# Agent Instructions for PT Rebuild (`/pt-rebuild`)

This file governs agent behavior for work inside `pt-rebuild/`.

## Canonical References

- `pt-rebuild/docs/DEVELOPMENT.md` - architecture and implementation reference
- `pt-rebuild/docs/DEV_PRACTICES.md` - day-to-day workflow and troubleshooting
- `pt-rebuild/docs/vocabularies.md` - canonical field names and data contracts
- `pt-rebuild/docs/dev_notes.json` - canonical development tracking log (source of truth)
- `pt-rebuild/docs/AI_WORKFLOW.md` - required intake/execute/close-loop workflow

## Core Rules

- Use a docs-first workflow: check the canonical references before editing code.
- Do not invent new field names when existing vocabulary/schema terms are available.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns (`pointerup`, touch-safe UI behavior).
- Respect Vercel/serverless limits: avoid endpoint sprawl and prefer extending existing handlers.

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

### Item arrays and status rules

- `open_items`: active work queue. Only statuses `open`, `in_progress`, or `blocked` belong here.
- `closed_items`: completed items. Only status `done` belongs here.
- **Never** put a `done` item in `open_items`, or a non-`done` item in `closed_items`. The generator enforces this and will fail the build if violated.

| Status | Array | Meaning |
|---|---|---|
| `open` | `open_items` | Tracked, not yet started |
| `in_progress` | `open_items` | Actively being worked on this session |
| `blocked` | `open_items` | Cannot proceed — blocker documented in `constraints_caveats` |
| `done` | `closed_items` | Resolved — has `resolved` date and a `dated_entries` record |

### Lifecycle enforcement: intake → execute → close-loop

1. **Intake**
   - For every request, check whether work already exists in `open_items`.
   - If user asks for ad-hoc work not already tracked, create a new issue ID (`DN-###`, next available number) in `open_items` before execution or at the start of execution.
   - Every new open item **must** include an `agent` field (array). Use `["codex"]`, `["claude"]`, or `["codex", "claude"]`. Use `["unassigned"]` only if genuinely unclear — but triage it before proceeding.
   - Note: Codex cannot live-test deployments, access Vercel logs, or query Supabase directly. If any part of a task requires those steps, assign `["claude"]` for the whole item — Claude can choose to hand off the coding portion to Codex within a session, but ownership stays with Claude.
2. **Execute**
   - Set status to `in_progress` in `open_items` while work is active.
3. **Close-loop**
   - When resolved: set `status` to `done`, add `resolved` date, move the item from `open_items` to `closed_items`, and add a `dated_entries` record using the required field order (`Problem`, `Root cause`, `Change made`, `Files touched`, `Validation`, `Follow-ups`, `Tags`).
   - Regenerate Markdown after JSON edits.

## Change Hygiene

- Keep instructions concise and avoid duplicating detailed architecture from docs.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.
