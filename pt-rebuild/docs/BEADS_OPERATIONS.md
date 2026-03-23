# Beads Operations for PT Rebuild

Operational guide for using Beads in `pt-rebuild/`.

This document exists so `AGENTS.md` can stay short and policy-focused while this file carries the detailed Beads operating rules.

Use [`BEADS_WORKFLOW.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/BEADS_WORKFLOW.md) for the canonical lifecycle order. This operations guide assumes that finished scoped work is closed promptly, including verification-only beads.

## Purpose

<!-- QUICKREF:BEGIN -->
Use Beads for all `NextJS migration/workstream` tracking in `pt-rebuild/`.
<!-- QUICKREF:END -->

Beads is designed for concurrent multi-agent use, but safe concurrency still depends on work boundaries and ownership discipline.

## Core Rules

- One active issue subtree should have one implementation owner at a time.
- Parallel threads are safe for review, verification, or separate file domains.
- Parallel threads are unsafe when they edit the same helper/state path, even if they are working different child issues.
- Search before creating new issues to reduce duplicates.
- Prefer notes/comments on an existing issue when the finding is not distinct enough to deserve its own tracked child.
- Do not use `bd edit` from agent sessions. It opens an interactive editor. Use `bd update` flags instead.

## Ownership Rules

- Set `BEADS_ACTOR` in each agent's environment for attributable audit logs:
  - Claude: `BEADS_ACTOR=claude`
  - Codex: `BEADS_ACTOR=codex`
  - Without this, both agents fall back to the same git `user.name` and audit logs lose attribution.
- Claim first in multi-agent workflows:
  - `bd update <id> --claim --assignee codex`
  - `bd update <id> --claim --assignee claude`
- Keep Beads subtree ownership explicit:
  - one thread owns updates for an active parent/child subtree
  - other threads should stay review-only unless ownership is intentionally handed off
- If another thread is used in parallel, default split is:
  - implementation here
  - review/verification there

## Lifecycle Rule

The core workflow rule is:

- close the bead when the scoped work is done

Manual closure is required. Commits do not close beads automatically in the current Dolt-based workflow.

That applies to all bead types, including verification-only beads.

For code beads, the practical consequence is:

- bead state must be accurate before the commit is created
- manually close the bead before the commit if the scoped work is complete

For verification beads, there may be no commit at all, so the rule is still closure on completion, not closure-before-commit as a general slogan.

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

## Workspace Restrictions

- For `pt-rebuild`, use normal Beads issues only.
- Do not use `bd close --claim-next`.
- Do not use `bd create --no-history`, `bd create --ephemeral`, `bd create --wisp-type`, or `bd mol wisp` flows for project tracking.
- If work matters for coordination, handoff, parity tracking, or audit, it must be a normal Beads issue with Dolt history.

## Command Patterns

<!-- QUICKREF:BEGIN -->
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

### Useful `bd 0.60.0`+ commands

These are the commands and behaviors most likely to help in this workspace:

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

### Additional `bd 0.61.0` and `0.62.0` commands

These are the newer commands and behaviors most likely to help in this workspace after the `0.61.0` and `0.62.0` updates:

```bash
# Structured issue sections
bd create "Title" --description="..." --skills "Required skills" --context "Extra context" --json

# Shorthand for appending notes while you work
bd note <id> "Validation note or handoff context"

# Filter noise out of list/ready results
bd ready --exclude-type chore --json
bd list --exclude-type chore --json

# List all valid statuses (built-in + custom) — useful when custom statuses have been configured
bd statuses
bd statuses --json

# Show the currently claimed bead without specifying an ID
bd show --current

# Find abandoned claims — run this if an in_progress bead looks stale or unclaimed
bd stale --status in_progress --json
```

Practical notes:

- `bd bootstrap` can now auto-detect a Beads database on git origin and clone it when present.
- `bd init` now warns when the git remote already appears to contain a Beads database.
- `bd doctor` now auto-starts Dolt more reliably on cold standalone checks.
- `--format json` is now accepted as an alias for `--json`, but the repo examples should keep using `--json` for consistency.
<!-- QUICKREF:END -->

## Create vs Update Rules

<!-- QUICKREF:BEGIN -->
Set dependencies at creation time whenever possible:

```bash
bd create "Title" --description="..." -p 1 --deps discovered-from:pt-abc --json
bd create "Title" --description="..." -p 1 --parent pt-abc --json
bd create "Title" --description="..." -p 1 --parent pt-abc --deps discovered-from:pt-xyz --json
```

Use `bd dep add` only when linking an already-existing issue:

```bash
bd dep add <issue-id> <depends-on-id> --type discovered-from|parent-child|related|blocks
```

Examples:

```bash
# New child under a parent
bd create "Child task" --description="..." --parent pt-abc --json

# New issue discovered while working a parent
bd create "Found parity gap" --description="..." --deps discovered-from:pt-abc --json

# New child that was also discovered during parent work
bd create "Found parity gap" --description="..." --parent pt-abc --deps discovered-from:pt-abc --json

# Add parent-child after creation
bd dep add pt-child pt-parent --type parent-child

# Add discovered-from after creation
bd dep add pt-new pt-source --type discovered-from

# Add blocking dependency
bd dep add pt-blocked pt-blocker --type blocks
bd dep pt-blocker --blocks pt-blocked

# Relate two existing issues without hierarchy/blocking
bd dep relate pt-a pt-b
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
- Type selection:
  - `verification` for browser checks, parity confirmation, acceptance validation, or other proof-gathering work whose main purpose is to verify behavior rather than change it
    Example: test an iOS flow before closure or confirm preview parity after code lands
  - `bug` for broken behavior, regressions, or parity mismatches
    Example: a tracker regression, wrong patient context, or mismatched static parity behavior
  - `feature` for additive capability that is not just a fix or required migration follow-through
    Example: add a new workflow or user-facing capability that did not exist before
  - `task` for implementation, investigation, refactor, setup, or other necessary work that is not best described as a bug, feature, or chore
    Example: refactor a file, set up tooling, or land an agreed migration slice
  - `chore` for low-product-impact maintenance or housekeeping
    Example: tracker cleanup, housekeeping, or low-risk tooling upkeep
  - `epic` for parent containers only
    Example: a parent bead that groups a parity domain or cutover stream
  - `decision` for beads whose main purpose is to get or record user input, approval, or cutover direction
    Example: decide when to cut over, or capture a required user approval before implementation
<!-- QUICKREF:END -->

## PT-Rebuild Issue Template

Canonical template: `pt-rebuild/docs/BEADS_ISSUE_TEMPLATE.md`

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

<!-- QUICKREF:BEGIN -->
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
<!-- QUICKREF:END -->

## Duplicate Detection and Merge

**When you know a specific issue is a duplicate, use `bd duplicate`:**

```bash
bd duplicate <dupe-id> --of <canonical-id>   # mark dupe, auto-closes it with reference
```

This is the correct command for "I found a Codex bead that duplicates mine" — not `bd close`. It records the relationship explicitly so the duplicate chain is traceable.

Find and consolidate duplicate issues in bulk:

```bash
bd duplicates              # find all content duplicates
bd duplicates --dry-run    # preview what would be merged
bd duplicates --auto-merge # automatically merge all duplicates
```

Merge specific issues manually (when content should be combined, not just closed):

```bash
bd merge pt-42 --into pt-41           # merge one into another
bd merge pt-42 pt-43 --into pt-41     # merge multiple
bd merge pt-42 --into pt-41 --dry-run # preview first
```

Merge closes the source issues and migrates all dependencies and text references to the target. Cannot be undone (but git history preserves original state).

AI agent workflow when duplicates are found:

1. `bd list --json | grep "similar text"` — search for similar issues
2. `bd show pt-41 pt-42 --json` — compare details
3. `bd duplicate pt-42 --of pt-41` — if pt-42 is the dupe; or `bd merge pt-42 --into pt-41` if content should be combined

## Dependency Tree

View the full dependency graph for an issue:

```bash
bd dep tree pt-xxx
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
git commit -m "Fix offline cache hydration (pt-zb3)"
git commit -m "Add IndexedDB read fallback in useIndexData (pt-zb3)"
```

`bd doctor` cross-references open issues against git history and flags any where work was committed but the issue wasn't closed.

Because `.beads/hooks` is git-ignored, the local commit hooks are installed from a tracked script:

```bash
npm run beads:install-commit-hook
```

This writes `.beads/hooks/commit-msg` and `.beads/hooks/pre-commit` for the current clone. The commit-msg hook rejects commit messages that do not include a Beads ID in parentheses. The pre-commit hook blocks commits that touch shared ownership or route-shape files without either staging `pt-rebuild/README.md` or using the explicit bypass when the README is still accurate:

```bash
PT_README_OK=1 git commit ...
```

## Sync and Landing-the-Plane

<!-- QUICKREF:BEGIN -->
Normal sync:

```bash
# Pull latest tracker changes
bd dolt pull

# Push local tracker changes
bd dolt push
```

### Mandatory Session-End Workflow

Work is NOT complete until `git push` succeeds and Beads is synced. Complete ALL steps:

```bash
# 1. File issues for any remaining work discovered this session
bd create "..." -p 1 --deps discovered-from:pt-xxx --json

# 2. Close finished beads or narrow unfinished ones
bd close pt-xxx --reason "Completed" --json
# or, if not complete:
bd update pt-xxx --append-notes "Remaining scope: ..." --json

# 3. Run quality gates (only if code changed)
# Example: run the checks that apply to the code you changed

# 4. If code changed, commit after bead state is accurate
git commit -m "Your change (pt-xxx)"

# 5. Push code to remote — MANDATORY, do not stop before this completes
git pull --rebase
git push          # work is stranded locally until this succeeds
git status        # must show "up to date with origin/nextjs"

# 6. Sync Beads
bd dolt pull
bd dolt push

# 7. Clean up git state
git stash clear
git remote prune origin

# 8. Verify
git status

# 9. Choose next work and hand off context
bd ready --json
```

**Rules:**
- Manual closure is required. Commits do not close beads automatically in the current Dolt-based workflow.
- Close beads when their scoped work is done. For code beads, that means commit after bead state is accurate. For verification beads, close them in the same pass once they pass.
- NEVER stop before `git push` completes — stranded local work breaks multi-agent coordination
- NEVER say "ready to push when you are" — push it yourself
- If push fails, resolve and retry until it succeeds
<!-- QUICKREF:END -->

## Windows / Dolt Troubleshooting

### Session Start (required every session)

<!-- QUICKREF:BEGIN -->
Dolt server check at session start:

```bash
cd pt-rebuild
bd dolt status
```

If `bd dolt status` reports `Dolt server: not running`, then start it:

```bash
bd dolt start
```

Do not run `bd dolt start` blindly if the server is already running.

To stop the server (end of session or before restart):

```bash
bd dolt stop
```

`bd 0.60.0` also improved Dolt pull behavior:

- pending local changes are auto-committed before pull in more cases
- metadata merge conflicts during `bd dolt pull` are more likely to auto-resolve
- ephemeral Dolt ports reduce Windows port-collision issues

`bd 0.61.0` adds a few more startup and recovery improvements:

- `bd bootstrap` auto-detects a Beads database on git origin and clones it when found
- `bd init` warns when an existing Beads DB is detected on origin
- `bd doctor` auto-starts Dolt on cold standalone checks

`bd 0.62.0` adds Windows and Dolt lifecycle fixes that matter in this workspace:

- repo-local auto-started Dolt servers stay alive more reliably across commands
- stale Windows Dolt state files and false auto-stop warnings were fixed
- externally managed Dolt servers are less likely to be stopped by mistake
- doctor is less likely to get stuck in a restart loop during recovery

If `bd dolt status` says the server is not running and `bd dolt start` then fails after a Windows restart (stale stats cache):

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
- pre-commit hooks that chain linters/formatters/type-checkers can time out (default shim timeout is 300s; if hitting this, raise it with `BEADS_HOOK_TIMEOUT=600 git commit ...`)

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
<!-- QUICKREF:END -->

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
bd admin compact --analyze          # preview what would be compacted
bd admin compact --apply            # run compaction
bd admin compact --stats            # show database size stats

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

This updates the docs only — it does not update the `bd` binary. To update the bd tool itself, use the established install method for this workspace:

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

This installs to `C:\Users\cindi\go\bin\bd.exe`. Do NOT use winget, scoop, or other package managers — they install to different paths and create conflicting binaries.

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
| Issue database sync | `bd dolt pull` / `bd dolt push` | Every session |
| Docs reference refresh | `git pull` in PT_Backup/beads | Periodically / before referencing docs |
| bd binary update | `go install github.com/steveyegge/beads/cmd/bd@latest` | When new bd version is released |

Current repo note:

- As of March 22, 2026, upstream `bd` is `0.62.0`.
- The local mirror at `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads` was refreshed on March 22, 2026.
