# Beads Workflow

Canonical bead lifecycle for `pt-rebuild/`.

Use this file for the required order of operations.
Use [`BEADS_OPERATIONS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/BEADS_OPERATIONS.md) for command details, Dolt sync, and recovery steps.

## Why This Matters

Beads are the only persistent record of what was done and why. Conversation context is lost between sessions. If a bead is not updated, that work is invisible — and will be repeated by the next agent at real cost to the user. Stale open beads and undocumented discoveries are not minor oversights. They are the primary source of wasted tokens and duplicate effort.

## Required Lifecycle

**This sequence is mandatory. No step may be skipped.**

1. Open or identify the bead
2. **Claim it and set `in_progress` before any work begins** — this is the only way to signal the bead was touched
3. Do the scoped work
4. Update notes while working
5. **Create `--discovered-from` beads immediately when new scoped work is found** — do not defer this
6. **Close the bead before committing** — bead state must be accurate before the commit is created
7. Commit with the bead ID in the message

```bash
bd update <id> --claim --status in_progress
# ...do work...
# if you discover new issues:
bd create --title="..." --description="..." --discovered-from <id>
# when scoped work is complete:
bd close <id> --reason "..."
# then and only then:
git commit -m "Your change (<id>)"
```

## Hard Rules

- **Commits do not close beads.** Manual closure is always required. Assuming a commit is enough is what creates the backlog of stale open beads.
- **You must claim and set `in_progress` before touching any bead's scope.** An untouched-looking open bead will be assigned to another agent and repeated.
- **You must close the bead before the commit.** Not after. Not "later." Before.
- **You must not leave a bead open because the remaining work feels small.** Small unclosed beads accumulate and become invisible debt.
- **You must not leave a verification bead open after it passes.** There is no commit to catch it. If you don't close it in the same pass, it will be re-run.
- **You must not leave a child bead open just because its parent is still open.** Close it when its own scope is done.
- **If a bead is staying open, you must leave an explicit note naming the exact unfinished scope.** "In progress" with no note is not acceptable.

## Code Beads

- Claim and set `in_progress` before writing any code
- Close the bead before creating the commit
- The commit message must include the bead ID
- Do not commit and plan to close the bead afterward — the bead will be left open

## Verification Beads

Verification beads rarely have a commit. The lifecycle is identical:

- Claim and set `in_progress` before running the verification
- If it passes: close the bead in that same pass with what was verified
- If it fails: leave an explicit note with the exact failing condition, keep the bead open
- **Do not leave a verification bead open with no failure note.** Another agent will re-run it.

## Discovered Issues

When you find a new issue or scope during work on a bead:

- **Immediately create a new bead with `--discovered-from <current-bead-id>`**
- Do not continue working on the new scope under the original bead
- Do not note it only in conversation — conversation is not persistent

## Implemented But Waiting On Another Thread

If code is implemented but another agent still needs to validate it:

1. Push the code
2. Update the bead immediately with:
   - the pushed commit id
   - the exact remaining validation task
   - the note `implemented, awaiting verification`
3. Leave the bead open only for that named validation scope — not for the full original scope

## Pre-Commit Gate

**Before creating any commit, you must:**

1. Run `bd list --status=in_progress` — review every bead you have touched
2. For each bead whose scoped work is complete: close it now, before the commit
3. For each bead still in progress: update notes with the exact remaining scope
4. Only after bead state is accurate: create the commit

**Do not commit and plan to update beads afterward. That is how beads get left open.**

## Session-End Rule

**Before ending any session, this sweep is mandatory:**

1. Run `bd list --status=in_progress` — close everything whose scope is done
2. For every bead staying open: update notes with the exact remaining scope and current state
3. Verify bead state is accurate, then commit
4. Push code
5. Sync beads: `bd dolt push`

**If work was done but the bead still looks open or untouched, the session is not complete.**
