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

At the start of every session, scan `open_items` in `pt-rebuild/docs/dev_notes.json` for items where `scope === "deferred"`. For each deferred item, evaluate whether its `reactivate_when.trigger` condition is now met:

- `deployment_scope_change` — check whether the number of active users in the `users` table exceeds 2, or whether there is any indication of a planned expansion. If yes, surface the item to the user before proceeding.
- `query_volume_sufficient` — check Supabase performance advisor notes or recent traffic context. If real sustained traffic exists, surface the item.
- `api_capacity_available` — check current Vercel function count against the free-tier limit (12). If capacity has changed, surface the item.

If no trigger conditions are met, proceed without surfacing deferred items. Do not re-open or act on deferred items autonomously — surface them to the user for a decision.

## Dev Notes Workflow (Required)

- Canonical tracking file: `pt-rebuild/docs/dev_notes.json` (the only hand-edited dev-tracking file).
- Generated artifact: `pt-rebuild/docs/DEV_NOTES.md` (never hand-edit).
- After any change to dev notes JSON, run `npm run dev-notes:build`.
- Before finishing, run `npm run dev-notes:check` to ensure no drift.

### Lifecycle enforcement: intake → execute → close-loop

1. **Intake**
   - For every request, check whether work already exists in `open_items`.
   - If user asks for ad-hoc work not already tracked, create a new issue ID (`DN-###`, next available number) in `open_items` before execution or at the start of execution.
   - Every new open item **must** include an `agent` field (array). Use `["codex"]`, `["claude"]`, or `["codex", "claude"]`. Use `["unassigned"]` only if genuinely unclear — but triage it before proceeding.
   - Note: Codex cannot live-test deployments, access Vercel logs, or query Supabase directly. Any item requiring those steps must include `"claude"` in its `agent` array.
2. **Execute**
   - Keep status/notes current in `open_items` while work is active.
3. **Close-loop**
   - When resolved, remove/resolve from `open_items` and add a `dated_entries` record using the required field order (`Problem`, `Root cause`, `Change made`, `Files touched`, `Validation`, `Follow-ups`, `Tags`).
   - Regenerate Markdown after JSON edits.

## Change Hygiene

- Keep instructions concise and avoid duplicating detailed architecture from docs.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.
