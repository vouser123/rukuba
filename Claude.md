# Claude Code Development Guide

This document covers repo-wide rules. For all work inside `pt-rebuild/`, read `pt-rebuild/CLAUDE.md` first — it is the authoritative entry point for the active app.

## Active App

All active development is in `/pt-rebuild/`. See `/pt-rebuild/CLAUDE.md` for instructions, workflows, and canonical references.

## Legacy App

`/pt/` contains the original Firebase/Firestore implementation. It is archived and not under active development. See `/pt/CLAUDE.md` for legacy reference notes. Do not make changes to `/pt/`.

## Required Workflow for All Code Changes

### 0. Pull Latest Changes from Main

**ALWAYS** pull the latest changes from the main branch before starting any work.

**If `origin` is missing (common in Codex containers), add it yourself before running the commands below.**
If you're on iOS and don't have the repo URL handy, ask a maintainer for the correct HTTPS URL before proceeding.
```bash
# Add the remote if it doesn't exist
git remote add origin <repo-url>
```

**Commands:**
```bash
# Fetch latest changes from remote
git fetch origin

# Pull main branch updates
git pull origin main

# If working on a feature branch, rebase on main to get latest changes
git rebase origin/main
```

**Why:**
- Ensures you're working with the most recent code
- Prevents merge conflicts later
- Avoids redoing work that was already completed
- Stays synchronized with other contributors' changes

**When to pull:**
- At the start of every session
- Before creating a new branch
- Before making significant changes
- When you've been away from the codebase for any length of time

### 1. Read the PT Docs First

**ALWAYS** read `pt-rebuild/CLAUDE.md` before making changes to any PT-related files.

**Why:**
- Points to canonical references for architecture, practices, and dev tracking
- Prevents reintroducing bugs that were already fixed
- Provides architectural context and design decisions

### 2. Comment Your Code

**All new functions and non-trivial code blocks must include comments.**

**Required for:**
- Function definitions (JSDoc-style preferred)
- Complex logic or workarounds
- iOS-specific fixes
- Supabase query patterns
- Dynamic HTML generation with event binding

### 3. Log Development Notes

All dev tracking is in `pt-rebuild/docs/dev_notes.json`. See `pt-rebuild/CLAUDE.md` for the required lifecycle and format.

## Summary Checklist

Before starting any work:

- [ ] Pull latest changes from main (`git pull origin main`)
- [ ] Read `pt-rebuild/CLAUDE.md` and follow its canonical references

Before submitting any code change:

- [ ] Add JSDoc comments to new functions
- [ ] Comment non-obvious logic and platform-specific workarounds
- [ ] Log development note per the lifecycle in `pt-rebuild/AGENTS.md`
- [ ] Test on iOS Safari/PWA if UI changes were made
- [ ] Verify no `onclick` or `click` handlers were introduced
- [ ] Check that dynamic HTML rebinds event handlers
