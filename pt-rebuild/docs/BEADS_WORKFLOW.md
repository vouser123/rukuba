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

For descriptions with quotes, backticks, or long content:

```bash
bd create "Title" --body-file description.md
bd update <id> --body-file description.md
```

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

## Sync and Landing-the-Plane

Normal sync steps:

```bash
bd dolt pull
bd dolt push
```

If ending a session that included code or Beads changes:

1. Update or close relevant Beads items
2. Ensure code is committed/pushed per project workflow
3. Run Beads sync

## Windows / Dolt Troubleshooting

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

## Reference Material

Local Beads mirror:

- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\AGENT_INSTRUCTIONS.md`
- `C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\ARTICLES.md`

Relevant documented points from the mirror:

- Beads is intended for multi-agent coordination
- Dolt auto-commits writes
- merge conflicts are expected to be rare with hash IDs
- keeping the working set small is still a recommended practice
