# Agent Instructions for PT Rebuild (`/pt-rebuild`)

This file governs agent behavior for work inside `pt-rebuild/`.

## Canonical References

- `pt-rebuild/docs/README.md` - docs index that explains which doc to open and when
- `pt-rebuild/README.md` - landing reference for the live codebase shape, shared components/hooks/utilities, timer/audio wiring, and legacy-to-Next.js page mapping
- `pt-rebuild/docs/NEXTJS_CODE_STRUCTURE.md` - file size limits, split rules, cohesion checks, folder structure, naming conventions
- `pt-rebuild/docs/SYSTEM_ARCHITECTURE.md` - current hybrid architecture and implementation guardrails
- `pt-rebuild/docs/IMPLEMENTATION_PATTERNS.md` - approved shared helpers, components, and do-this-not-that implementation guidance
- `pt-rebuild/docs/DATA_VOCABULARIES.md` - canonical field names and data contracts
- `pt-rebuild/docs/TESTING_CHECKLISTS.md` - all regression, parity, and verification checklists for pt-rebuild/
- `pt-rebuild/docs/BEADS_OPERATIONS.md` - canonical Beads operating rules, parallel-thread guidance, and Dolt troubleshooting
- `pt-rebuild/docs/BEADS_QUICKREF.md` - generated quick reference derived from `BEADS_OPERATIONS.md` for agent session startup and recovery
- `pt-rebuild/docs/archive/dev-notes/dev_notes.json` - legacy tracking archive; no longer the active intake queue
- `pt-rebuild/docs/archive/dev-notes/DEV_NOTES.md` - generated legacy archive view derived from `dev_notes.json`

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
- Review `pt-rebuild/README.md` at session start as the first-stop map for what currently exists in the old and new app structures.
- Use `pt-rebuild/README.md` as the practical guide for what shared files own, when to use them, where they fit in the stack, and where adjacent logic should not go.
- Treat the static legacy surface as frozen unless the work is user-approved or a security issue. Default all routine feature, cleanup, and pattern-alignment work to the Next.js surface.
- Do not invent new field names when existing vocabulary/schema terms are available.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns (`pointerup`, touch-safe UI behavior).
- Respect Vercel/serverless limits: avoid endpoint sprawl and prefer extending existing handlers.
- **No hardcoded option lists without explicit sign-off.** Do not introduce or expand a hardcoded option list, enum, allowed-values array, or validation list without explicit user sign-off. Existing hardcoded values are not precedent. Before hardcoding, determine whether the values are behavior logic or domain data. Values that represent user/admin-managed domain data, vocab terms, reference data, or other extendable content must be loaded dynamically. Values that drive fixed application behavior may remain hardcoded only after explicit approval. When approval is given, add a short code comment at the hardcoded definition noting that it is intentionally hardcoded, why, and that future expansion also requires explicit sign-off. Example: `// Intentionally hardcoded behavior enum; approved by user on 2026-03-19. // Do not extend without explicit sign-off. These values drive timer behavior.`

## Operator Support Contract (Required)

This project is operated by a non-technical user. Agents must not assume technical fluency.

- You must use neutral and inclusive language and terminology. You must not use ableist or stigmatizing terms or phrases that invoke mental health conditions to convey wrongness, correctness, quality, or error states. Use neutral alternatives such as `confidence check`, `coherence check`, `validation`, `verification`, and `review pass` instead of phrases like `sanity check` or `sanity pass`. These examples are illustrative, not exhaustive.
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

- Preserve iOS-safe interaction patterns.
- Use `pt-rebuild/docs/IMPLEMENTATION_PATTERNS.md` for the detailed touch and interaction rules instead of duplicating them here.

## Active Tracker Policy (Required)

- Use Beads for active work tracking in `pt-rebuild`, including intake, execution, handoff, and closure.
- Do not create new `DN-*` items in `dev_notes.json`.
- Treat `pt-rebuild/docs/archive/dev-notes/dev_notes.json` and `pt-rebuild/docs/archive/dev-notes/DEV_NOTES.md` as legacy history only.
- If a legacy `DN-*` reference matters to current work, link it in Beads with `--external-ref DN-###` instead of reviving dev_notes as an active queue.
- If you need to review historical deferred items, consult the legacy archive and then create or update a Beads issue rather than reopening `dev_notes`.

## Validation Preference

- Prefer Vercel deployment checks/logs as the default validation path for routine changes.
- Run local `npm run build` only when Vercel signal is insufficient, when debugging environment-specific issues, or before especially risky refactors.

### Legacy Dev Notes Archive

- `pt-rebuild/docs/archive/dev-notes/dev_notes.json` is retained for historical reference.
- `pt-rebuild/docs/archive/dev-notes/DEV_NOTES.md` is generated from the JSON and should never be hand-edited.
- If the legacy archive is updated for documentation reasons, run `npm run dev-notes:build` and `npm run dev-notes:check`.
- Do not use the archive for active intake, assignment, or status management.

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
- Update `pt-rebuild/README.md` in the same change whenever you create, remove, rename, repurpose, or materially change a file in a way that another agent would need to know to find it, understand what it owns, or wire it in correctly.
- Update `pt-rebuild/docs/IMPLEMENTATION_PATTERNS.md` in the same change whenever you add, replace, or retire an approved shared helper/component/pattern, or whenever a do-this-not-that implementation rule changes.
- When a legacy HTML page is replaced, retired, redirected, or re-mapped, update the page mapping in `pt-rebuild/README.md` in the same change.
- Update `pt-rebuild/README.md` in the same change whenever a behavior change alters how a file should be used, what layer owns a concern, or which file another agent should touch for future work.
- Do not bypass the README pre-commit guard unless the staged changes leave `pt-rebuild/README.md` fully accurate as written.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.

## Agent Ops Friction Logging

- Use Beads epic `pt-uf1` ("Agent Ops Epic: tracker/tooling friction log") for system/process/tooling friction discovered during execution.
- Create child issues from that epic for concrete incidents, include root cause + mitigation, and close child issues after fix.
- Keep the epic open as the longitudinal signal for whether current tracker/process choices still serve agent throughput.
- Child issue command pattern:
  - `bd create "<title>" -t task -p 2 --deps discovered-from:pt-uf1 --description "<incident + impact + root cause + mitigation>" --json`
  - Optional explicit parent-child link: `bd dep add <child-id> pt-uf1 --type parent-child`

## Beads Agent Discipline (Required)

- Detailed operating rules live in `pt-rebuild/docs/BEADS_OPERATIONS.md`.
- Keep `AGENTS.md` as the policy surface; use the workflow doc for command patterns, parallel-thread rules, and Dolt cleanup steps.
- Check `bd dolt status` before trying to start Dolt; only run `bd dolt start` when the server is not already running.
- Do not use `bd edit` from agent sessions; use `bd update` flags instead.
- Claim first in multi-agent workflows:
  - `bd update <id> --claim --assignee codex` (or `claude`)
- Search before create to reduce duplicate issues:
  - `bd list --json` then title/label search before `bd create`
- Install the repo-local commit hooks when setting up a clone:
  - `npm run beads:install-commit-hook`
- The hook install writes both `.beads/hooks/commit-msg` and `.beads/hooks/pre-commit`.
- When the pre-commit hook flags shared ownership or route-shape changes, either stage `pt-rebuild/README.md` in the same commit or use the explicit bypass only if the README remains accurate:
  - PowerShell: `$env:PT_README_OK="1"; git commit ...`
- Use dependency types correctly:
  - Only `blocks` should gate readiness
  - Use `related`, `parent-child`, and `discovered-from` for context/structure
- Set dependencies at creation time using `--deps` in `bd create` — do NOT follow up with `bd dep add` for the same link (creates duplicates):
  ```bash
  bd create "Title" --description="..." -p 1 --deps discovered-from:pt-abc --json
  bd create "Title" --description="..." -p 1 --deps parent-child:pt-abc --json
  ```
- Use `bd dep add` only when adding a dependency to an **already-existing** issue:
  ```bash
  bd dep add <issue-id> <depends-on-id> --type discovered-from|parent-child|related|blocks
  ```
- Use `bd dep <id> --blocks <other-id>` to mark that `<id>` blocks `<other-id>`:
  ```bash
  bd dep pt-abc --blocks pt-xyz
  ```
- Keep ready queue clean:
  - For non-actionable meta/friction items, use low priority + defer:
  - `bd update <id> --priority 4 --defer +14d`
- Land-the-plane rule:
  - Update/close Beads items and push code before ending session; do not leave local-only state
- Concurrency rule:
  - Beads supports multi-agent coordination, but shared-file implementation still needs one owner at a time. Use parallel threads for review/verification or clearly separate file domains, not for the same helper/state path.

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
- No manual export/import needed
- If sync fails on Windows, see `pt-rebuild/docs/BEADS_OPERATIONS.md` for metadata / working-set cleanup

### Important Rules

- ✅ Use bd for all NextJS migration/workstream task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For repo structure and shared-file guidance, see `pt-rebuild/README.md`. For tracker workflow details, see `pt-rebuild/docs/BEADS_OPERATIONS.md` and `pt-rebuild/docs/BEADS_QUICKREF.md`.

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

Canonical template: `pt-rebuild/docs/BEADS_ISSUE_TEMPLATE.md`.

Detailed workflow and troubleshooting: `pt-rebuild/docs/BEADS_OPERATIONS.md`.

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
