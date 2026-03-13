# Beads Workflow for PT Rebuild

Operational guide for using Beads in `pt-rebuild/`.

This document exists so `AGENTS.md` can stay short and policy-focused while this file carries the detailed Beads operating rules.

## Purpose

Use Beads for all `NextJS migration/workstream` tracking in `pt-rebuild/`.

Beads is designed for concurrent multi-agent use, but safe concurrency still depends on work boundaries and ownership discipline.

## Core Rules

- One active issue subtree should have one implementation owner at a time.
- Parallel threads are safe for review, verification, or separate file domains.
- Parallel threads are unsafe when they edit the same helper/state path, even if they are working different child issues.
- Search before creating new issues to reduce duplicates.
- Prefer notes/comments on an existing issue when the finding is not distinct enough to deserve its own tracked child.
- Do not use `bd edit` from agent sessions. It opens an interactive editor. Use `bd update` flags instead.

## Ownership Rules

- Claim first in multi-agent workflows:
  - `bd update <id> --claim --assignee codex`
  - `bd update <id> --claim --assignee claude`
- Keep Beads subtree ownership explicit:
  - one thread owns updates for an active parent/child subtree
  - other threads should stay review-only unless ownership is intentionally handed off
- If another thread is used in parallel, default split is:
  - implementation here
  - review/verification there

## Dependency Rules

Use dependency types deliberately:

- `blocks`
  - only for real readiness blockers
- `parent-child`
  - for a concrete subtask that should roll up under a parent
- `related`
  - for associated work that should not gate readiness
- `discovered-from`
  - for provenance when a new issue was found during another issue's investigation

## Command Patterns

### Safe update patterns

Use `bd update`, not `bd edit`:

```bash
bd update <id> --title "New title"
bd update <id> --description "Updated description"
bd update <id> --append-notes "New validation note"
bd update <id> --status in_progress
```

For descriptions with quotes, backticks, or long content — three options:

```bash
# Option 1: --stdin flag (for bd create with special chars)
echo 'Description with `backticks` and "quotes"' | bd create "Title" --stdin --json

# Option 2: --description=- (for bd update with special chars)
echo 'Updated description with $variables' | bd update <id> --description=-

# Option 3: body file (better for long multi-line descriptions)
bd create "Title" --body-file description.md
bd update <id> --body-file description.md
```

### Useful `bd 0.60.0` commands

These are the new commands and behaviors most likely to help in this workspace:

```bash
# Safer troubleshooting context when bd errors
bd context

# Recovery/bootstrap helper for fresh clones or damaged local state
bd bootstrap

# Machine-readable command discovery
bd help --list
bd help --doc

# Closure alias
bd done <id> "Completed"
```

Practical notes:

- `bd done` is an alias for `bd close`; use either one.
- `bd search` now includes `external_ref`, so legacy DN refs or external tracker refs are easier to find.
- `--json` output and error handling are more reliable in `0.60.0`, especially for agent-driven workflows.

## Create vs Update Rules

Set dependencies at creation time whenever possible:

```bash
bd create "Title" --description="..." -p 1 --deps discovered-from:ptrebuild-abc --json
bd create "Title" --description="..." -p 1 --parent ptrebuild-abc --json
bd create "Title" --description="..." -p 1 --parent ptrebuild-abc --deps discovered-from:ptrebuild-xyz --json
```

Use `bd dep add` only when linking an already-existing issue:

```bash
bd dep add <issue-id> <depends-on-id> --type discovered-from|parent-child|related|blocks
```

Examples:

```bash
# New child under a parent
bd create "Child task" --description="..." --parent ptrebuild-abc --json

# New issue discovered while working a parent
bd create "Found parity gap" --description="..." --deps discovered-from:ptrebuild-abc --json

# New child that was also discovered during parent work
bd create "Found parity gap" --description="..." --parent ptrebuild-abc --deps discovered-from:ptrebuild-abc --json

# Add parent-child after creation
bd dep add ptrebuild-child ptrebuild-parent --type parent-child

# Add discovered-from after creation
bd dep add ptrebuild-new ptrebuild-source --type discovered-from

# Add blocking dependency
bd dep add ptrebuild-blocked ptrebuild-blocker --type blocks
bd dep ptrebuild-blocker --blocks ptrebuild-blocked

# Relate two existing issues without hierarchy/blocking
bd dep relate ptrebuild-a ptrebuild-b
```

Use notes/comments instead of new children when:

- the information is only status evidence
- the finding is too small to track separately
- the finding belongs to the active issue's expected scope

Quick decision guide:

- New subtask under current work:
  - `--parent <id>`
- Newly discovered follow-up from current work:
  - `--deps discovered-from:<id>`
- New child that should both roll up and preserve provenance:
  - `--parent <id>` plus `--deps discovered-from:<id>`
- Existing issues that should be linked after creation:
  - `bd dep add ... --type ...`
- Simple see-also relationship:
  - `bd dep relate <id1> <id2>`

## PT-Rebuild Issue Template

Canonical template: `pt-rebuild/docs/BEADS_TEMPLATE.md`

All new Beads issues in this repo should include:

1. `Source Reference`
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
15. `Reactivation Trigger`

Before closing an issue, append the closure block:

1. `Problem`
2. `Root Cause`
3. `Change Made`
4. `Files Touched`
5. `Validation`
6. `Follow-ups`

## Parallel-Thread Guidance

Safe parallelization:

- review-only against static source
- browser verification on preview
- Beads drafting in plain text
- work on separate file domains or separate issue subtrees

Unsafe parallelization:

- two threads editing the same page + helper + hook path
- two threads updating the same active parent/child subtree
- splitting tightly coupled child issues that converge in the same files

Recommended pattern:

- keep implementation in one thread
- use the second thread for review or verification after code lands

## Test Isolation

Never pollute the production database with test issues. Use `BEADS_DB` to point to a temporary database for any manual testing of bd commands:

```bash
BEADS_DB=/tmp/test.db bd create "Test issue" -p 1
BEADS_DB=/tmp/test.db bd list
```

**Warning:** bd will warn you when creating issues with a "Test" prefix in the production database. If you see that warning, you forgot `BEADS_DB`.

## Health Checks

`bd doctor` detects problems in the Beads database. Use `--fix` to auto-remediate:

```bash
bd doctor          # detect orphaned issues, schema problems
bd doctor --fix    # detect and auto-fix
```

If startup or local recovery is failing before normal commands work, try:

```bash
bd context
bd bootstrap
```

`bd bootstrap` is now an action-oriented recovery command in `0.60.0`, not just a hint printer.

Orphaned issues = open issues where work was committed to git but the issue was never closed. Detected by cross-referencing commit history against open issue IDs.

For git hook marker migration specifically:

```bash
bd migrate hooks --dry-run    # preview what would change
bd doctor --fix               # apply the standard fix path
```

## Duplicate Detection and Merge

Find and consolidate duplicate issues:

```bash
bd duplicates              # find all content duplicates
bd duplicates --dry-run    # preview what would be merged
bd duplicates --auto-merge # automatically merge all duplicates
```

Merge specific issues manually:

```bash
bd merge ptrebuild-42 --into ptrebuild-41           # merge one into another
bd merge ptrebuild-42 ptrebuild-43 --into ptrebuild-41  # merge multiple
bd merge ptrebuild-42 --into ptrebuild-41 --dry-run     # preview first
```

Merge closes the source issues and migrates all dependencies and text references to the target. Cannot be undone (but git history preserves original state).

AI agent workflow when duplicates are found:

1. `bd list --json | grep "similar text"` — search for similar issues
2. `bd show ptrebuild-41 ptrebuild-42 --json` — compare details
3. `bd merge ptrebuild-42 --into ptrebuild-41` — consolidate

## Dependency Tree

View the full dependency graph for an issue:

```bash
bd dep tree ptrebuild-xxx
```

## Database Location

To confirm which database is active (useful when debugging multi-clone setups):

```bash
bd where
bd where --json
```

## Multi-Agent Database Sharing

Multiple git clones can share a single beads database via a redirect file. Create `.beads/redirect` in secondary clones pointing to the primary:

```bash
# In secondary clone
mkdir -p .beads
echo "../main-clone/.beads" > .beads/redirect   # relative path
# or
echo "/absolute/path/to/.beads" > .beads/redirect
```

`bd where` will show the active database and whether it was redirected. Single-level redirects only (chains not supported).

## Non-Interactive Shell Commands (Windows)

On Windows, `cp`, `mv`, `rm` may be aliased to interactive mode and hang waiting for y/n. Always use force flags in agent sessions:

```bash
cp -f source dest
mv -f source dest
rm -f file
rm -rf directory
```

## Commit Message Convention

Include the Beads issue ID in parentheses in git commit messages. This lets `bd doctor` detect orphaned issues — work committed but issue not closed:

```bash
git commit -m "Fix offline cache hydration (ptrebuild-zb3)"
git commit -m "Add IndexedDB read fallback in useIndexData (ptrebuild-zb3)"
```

`bd doctor` cross-references open issues against git history and flags any where work was committed but the issue wasn't closed.

## Sync and Landing-the-Plane

Normal sync — two equivalent options:

```bash
# Option 1: unified sync command (pull + push)
bd sync

# Option 2: manual pull/push pair
bd dolt pull
bd dolt push

# Pull only (no push):
bd sync --no-push
```

### Mandatory Session-End Workflow

Work is NOT complete until `git push` succeeds and Beads is synced. Complete ALL steps:

```bash
# 1. File issues for any remaining work discovered this session
bd create "..." -p 1 --deps discovered-from:ptrebuild-xxx --json

# 2. Run quality gates (only if code changed)
npm run dev-notes:check

# 3. Close finished issues
bd close ptrebuild-xxx --reason "Completed" --json

# 4. Push code to remote — MANDATORY, do not stop before this completes
git pull --rebase
git push          # work is stranded locally until this succeeds
git status        # must show "up to date with origin/nextjs"

# 5. Sync Beads
bd sync

# 6. Clean up git state
git stash clear
git remote prune origin

# 7. Verify
git status

# 8. Choose next work and hand off context
bd ready --json
```

**Rules:**
- NEVER stop before `git push` completes — stranded local work breaks multi-agent coordination
- NEVER say "ready to push when you are" — push it yourself
- If push fails, resolve and retry until it succeeds

## Windows / Dolt Troubleshooting

### Session Start (required every session)

Dolt server stops between sessions — always restart at the beginning of each session:

```bash
cd pt-rebuild && bd dolt start
```

To stop the server (end of session or before restart):

```bash
bd dolt stop
```

`bd 0.60.0` also improved Dolt pull behavior:

- pending local changes are auto-committed before pull in more cases
- metadata merge conflicts during `bd dolt pull` are more likely to auto-resolve
- ephemeral Dolt ports reduce Windows port-collision issues

If `bd dolt start` fails after a Windows restart (stale stats cache):

```bash
rm -rf .beads/dolt/beads/.dolt/stats
bd dolt start
```

After starting, verify with `bd ready` or `bd stats`.

To check server logs for startup issues:

```bash
tail -f .beads/dolt/sql-server.log
```

### Auto-Sync via Git Hooks

Install git hooks so Dolt changes are automatically committed on git operations (optional, recommended):

```bash
bd hooks install
```

This installs:
- **pre-commit** — commits pending Dolt changes
- **post-merge** — pulls remote Dolt changes after git merge

### Known Friction

Known friction on Windows:

- transient Dolt/TCP abort noise can happen
- auto-push may fail with non-fast-forward when another writer updated remote
- `bd dolt pull` can fail with `cannot merge with uncommitted changes`

When `bd dolt pull` fails with `cannot merge with uncommitted changes`:

1. Inspect the local Dolt working set in `.beads/dolt/beads`
2. Check whether the only dirty table is `metadata`
3. If it is just Beads metadata churn, commit it locally, then retry pull/push

Useful commands:

```bash
bd dolt status
bd dolt show
bd status

# Low-level Dolt inspection
cd .beads/dolt/beads
dolt status
dolt diff --stat
dolt diff metadata
```

Typical metadata-only cleanup:

```bash
dolt add metadata
dolt commit -m "bd: sync metadata"
bd dolt pull
bd dolt push
```

### Merge Conflicts

If Dolt merge conflicts occur (rare with hash IDs):

```bash
bd vc conflicts    # view conflicts
bd vc resolve      # resolve conflicts
```

Dolt uses cell-level 3-way merge — conflicts are isolated to the specific field that diverged.

## Database Maintenance

Compact old closed issues when the database grows large:

```bash
bd admin compact --dry-run --all    # preview
bd admin compact --days 90          # compact issues closed > 90 days ago

# Run Dolt garbage collection after compaction
cd .beads/dolt && dolt gc
```

Export to JSONL for backup or migration:

```bash
bd export -o issues.jsonl --json
```

## Direct SQL Access

Query the Dolt database directly:

```bash
bd query "SELECT id, title, status FROM issues WHERE status = 'open'"
```

## Dolt Server Mode

Switch between embedded (single-user) and server (multi-writer) modes:

```bash
bd dolt set mode embedded    # single-user, no server needed (good for git worktrees)
bd dolt set mode server      # multi-writer concurrent access
```

Server mode (`bd dolt start`) is required for concurrent writes from multiple processes.

## Database Corruption Recovery

If the local Dolt database is physically corrupted (disk error, power loss, concurrent write without server mode):

```bash
rm -rf .beads/dolt
bd init
bd dolt pull    # restore from Dolt remote
```

This is distinct from logical issues (duplicate IDs, orphans) which `bd doctor --fix` handles.

## Worktree "Branch Already Checked Out" Error

If bd's sync-branch worktrees cause "branch already checked out" errors when switching branches:

```bash
rm -rf .git/beads-worktrees
rm -rf .git/worktrees/beads-*
git worktree prune
```

To disable sync-branch worktree creation permanently:

```bash
bd config set sync.branch ""
```

## Agent Setup (Non-Interactive Init)

When an agent initializes bd in a fresh clone, use `--quiet` to suppress interactive prompts:

```bash
bd init --quiet    # auto-installs hooks, no prompts
bd ready --json    # start using bd normally
```

## Reference Material

### GitHub (authoritative, always current)

- Repo: https://github.com/steveyegge/beads
- Key docs online:
  - [AGENT_INSTRUCTIONS.md](https://github.com/steveyegge/beads/blob/main/AGENT_INSTRUCTIONS.md)
  - [ADVANCED.md](https://github.com/steveyegge/beads/blob/main/docs/ADVANCED.md)
  - [FAQ.md](https://github.com/steveyegge/beads/blob/main/docs/FAQ.md)
  - [TROUBLESHOOTING.md](https://github.com/steveyegge/beads/blob/main/docs/TROUBLESHOOTING.md)

### Local Mirror

`C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\` is a full git clone of the beads repo. Most operational guidance is already captured in this document — the local mirror is a fallback for edge cases not covered here.

To refresh when bd has been updated with new features:

```bash
cd "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads"
git pull
```

**Who does this:** User or agent, on request only — not a regular session task. Pull when you notice bd has a new release or want to check updated docs for a specific feature.

This updates the docs only — it does not update the `bd` binary. To update the bd tool itself, use the original installer method (the install script at https://github.com/steveyegge/beads).

Key local docs for operational reference:
- `AGENT_INSTRUCTIONS.md` — agent session workflow, session-end checklist
- `ADVANCED.md` — rename-prefix, duplicate merge, database redirects, worktrees
- `FAQ.md` — common questions, compaction, corruption recovery, multi-agent patterns
- `docs/TROUBLESHOOTING.md` — error reference
- `docs/DOLT.md` — Dolt backend deep-dive
- `docs/PROTECTED_BRANCHES.md` — sync-branch setup for protected main branches

### Beads Issue Sync vs Docs vs Binary Updates

Three separate things — do not confuse them:

| What | How | When |
|------|-----|-------|
| Issue database sync | `bd sync` or `bd dolt pull/push` | Every session |
| Docs reference refresh | `git pull` in PT_Backup/beads | Periodically / before referencing docs |
| bd binary update | Original installer (Homebrew etc.) | When new bd version is released |

Current repo note:

- As of March 13, 2026, upstream `bd` is `0.60.0`.
- The local mirror at `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads` was refreshed on March 13, 2026.
