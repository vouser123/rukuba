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

## Local Memory Files (Outside GitHub Repo)

These local files are operator memory for agents and are not committed to GitHub:

- `C:\Users\cindi\OneDrive\Documents\claude-memory\MEMORY.md`
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\agent_memory\MEMORY.md`

Session-start requirement:

- Read both files if present before work begins.
- If guidance conflicts, prefer the file with the newer `LastWriteTime` and note the conflict in session updates.
- When adding durable local operational notes, update both files with the same change.

## Core Rules

- Use a docs-first workflow: check the canonical references before editing code.
- Do not invent new field names when existing vocabulary/schema terms are available.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns (`pointerup`, touch-safe UI behavior).
- Respect Vercel/serverless limits: avoid endpoint sprawl and prefer extending existing handlers.

## Operator Support Contract (Required)

This project is operated by a non-technical user. Agents must not assume technical fluency.

- Default to plain-language explanations first. Define jargon the first time it appears.
- Always include a one-line "What this means for you" summary for technical findings.
- Do not wait for the user to specify implementation details. Propose the recommended next step and proceed unless a real product decision is required.
- Ask clarifying questions only when ambiguity changes behavior, data safety, or UX semantics.
- When asking for user input, state exactly what decision is needed and provide a recommended option.
- Surface risk proactively (security, data loss, UX drift, deployment impact) without waiting for the user to ask.
- If a change can alter UX behavior, call it out explicitly before merge and obtain approval.
- For every completed task, provide: what changed, how to verify, known gaps, and rollback path.
- Never use dismissive phrasing or imply user error due to missing technical background.

## Decision Default (When User Is Unsure)

- Agents own technical steering by default.
- If the user says they are unsure, agents must choose the safest reasonable path, explain it briefly, and continue.
- If multiple valid paths exist, pick one recommendation and state why it is preferred now.

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

## Tracker Routing Policy (Required)

Use a split tracker model until explicitly retired:

- `NextJS migration/workstream` items: track in **Beads only**.
- `Non-NextJS` items (static app, API/security, DB/migrations, infra, docs/process outside NextJS migration): track in **dev_notes.json**.

Hard rules:

- Do not create new NextJS work items in `dev_notes.json` during the Beads pilot.
- Do not move or delete existing non-NextJS `dev_notes.json` items unless they are actually resolved/closed per current workflow rules.
- At session start, always check both queues:
  - Beads for NextJS active work.
  - `dev_notes.json` for non-NextJS open/deferred work.

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
- Note: If the current Codex environment does not have access to deployment previews, Vercel logs, or Supabase data needed for the task, assign `["claude"]` for the whole item or explicitly hand off that validation step. Claude can choose to hand off the coding portion to Codex within a session, but ownership stays with Claude for environment-dependent validation.
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

Codex cannot live-test on preview, but it can read code and reason about behavior — which is most of what parity checking requires.

## Testing Checklists

See [`pt-rebuild/docs/TESTING_CHECKLISTS.md`](docs/TESTING_CHECKLISTS.md) for all regression and parity testing checklists, including the Activity Log Testing Checklist (exercise types, set variables, side variables, log paths, idempotency, DB verification query).

## Change Hygiene

- Keep instructions concise and avoid duplicating detailed architecture from docs.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.

## Agent Ops Friction Logging

- Use Beads epic `ptrebuild-uf1` ("Agent Ops Epic: tracker/tooling friction log") for system/process/tooling friction discovered during execution.
- Create child issues from that epic for concrete incidents, include root cause + mitigation, and close child issues after fix.
- Keep the epic open as the longitudinal signal for whether current tracker/process choices still serve agent throughput.
- Child issue command pattern:
  - `bd create "<title>" -t task -p 2 --deps discovered-from:ptrebuild-uf1 --description "<incident + impact + root cause + mitigation>" --json`
  - Optional explicit parent-child link: `bd dep add <child-id> ptrebuild-uf1 --type parent-child`

## Beads Agent Discipline (Required)

- Claim first in multi-agent workflows:
  - `bd update <id> --claim --assignee codex` (or `claude`)
- Search before create to reduce duplicate issues:
  - `bd list --json` then title/label search before `bd create`
- Use dependency types correctly:
  - Only `blocks` should gate readiness
  - Use `related`, `parent-child`, and `discovered-from` for context/structure
- Keep ready queue clean:
  - For non-actionable meta/friction items, use low priority + defer:
  - `bd update <id> --priority 4 --defer +14d`
- Land-the-plane rule:
  - Update/close Beads items and push code before ending session; do not leave local-only state

Reference docs (local mirror for agents):
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\AGENT_INSTRUCTIONS.md`
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\docs\FAQ.md`
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\docs\TROUBLESHOOTING.md`
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\docs\PLUGIN.md`

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for all NextJS migration/workstream issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for all NextJS migration/workstream task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

### PT-Rebuild Beads Template (Required)

All new Beads issues in this repo must include the following sections in the description body:

1. `Source Reference` (Beads ID; DN optional)
2. `Status`
3. `Priority`
4. `Risk`
5. `Scope`
6. `Agent Owner`
7. `Agent Eligible`
8. `Tags`
9. `File Scope`
10. `Issue`
11. `Context`
12. `Constraints/Caveats`
13. `Validation Checklist`
14. `Dependencies`
15. `Reactivation Trigger` (if deferred)

For closure notes, include:

1. `Problem`
2. `Root Cause`
3. `Change Made`
4. `Files Touched`
5. `Validation`
6. `Follow-ups`

Agent assignment convention:

- Use Beads `assignee` for the active owner (`codex` or `claude`).
- Add labels: `agent:codex`, `agent:claude`, or `agent:shared`.
- Use Beads IDs as primary references in chat, commits, and handoffs.
- If a legacy DN exists, keep it only as optional `external-ref` during transition.

Execution caveat for this environment:

- In this workspace, `bd` commands may require elevated execution from Codex sessions even when local VS Code terminal commands work.

Canonical template: `pt-rebuild/docs/BEADS_TEMPLATE.md`.

## Landing the Plane (Session Completion)

**When ending a work session that included code changes**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt pull
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
