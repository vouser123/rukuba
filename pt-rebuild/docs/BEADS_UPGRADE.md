# Beads Upgrade Guide

How to upgrade `bd` and keep all docs, mirrors, and config in sync.

## When to Upgrade

- A new beads release is available and you want new features
- User requests an upgrade
- A bug fix in a new release affects this workspace

## Step-by-Step Upgrade Procedure

### 1. Create a bead for the upgrade work

```bash
bd create --title="Upgrade bd to vX.Y.Z" --type=task --priority=2
bd update <id> --claim --status in_progress
```

### 2. Upgrade the binary

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

**Install location:** `C:\Users\cindi\go\bin\bd.exe`

**Do NOT use winget, scoop, chocolatey, or npm** — they install to different paths and create conflicting binaries. `go install` is the only approved method for this workspace.

Verify:
```bash
where.exe bd        # Must resolve to go\bin\bd.exe only
bd version          # Confirm new version
```

### 3. Upgrade Dolt if needed

Check if the release notes mention a Dolt version bump. If so:

```bash
# Check current version
dolt version

# Dolt on Windows is installed via MSI installer or winget (equivalent on Windows)
winget upgrade --id DoltHub.Dolt --accept-package-agreements --accept-source-agreements

# Verify
dolt version
```

### 4. Pull fresh PT_Backup mirror

```bash
# Rename old mirror as backup
$date = Get-Date -Format "yyyyMMdd-HHmmss"
Rename-Item "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads" "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads-old-$date"

# Clone fresh
git clone https://github.com/steveyegge/beads "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads"
```

### 5. Review the changelog

```bash
# Diff changelog between old and new version
diff "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads\CHANGELOG.md" \
     "C:\Users\cindi\OneDrive\Documents\PT_Backup\beads-old-<date>\CHANGELOG.md" | head -100
```

Look for:
- New commands or flags → update AGENTS.md and BEADS_OPERATIONS.md
- Changed/removed commands → update any docs that reference them
- New runtime files → add to `.beads/.gitignore`
- Environment variable changes (e.g. `BD_ACTOR` → `BEADS_ACTOR`)
- Windows-specific fixes relevant to this workspace

### 6. Update repo docs if needed

Files to update based on changelog review:

| File | Update when |
|------|-------------|
| `pt-rebuild/AGENTS.md` | New commands, flags, or workflow changes |
| `pt-rebuild/docs/BEADS_WORKFLOW.md` | Lifecycle or workflow changes |
| `pt-rebuild/docs/BEADS_OPERATIONS.md` | Command syntax, install method, Dolt changes |
| `pt-rebuild/.beads/.gitignore` | New runtime files added by the release |

### 7. Regenerate BEADS_QUICKREF

```bash
cd pt-rebuild
npm run beads:quickref
```

Verify the output looks correct before committing.

### 8. Verify bd still works

```bash
cd pt-rebuild
bd dolt start
bd ready --json
bd stats
```

### 9. Close bead and commit

```bash
bd close <id> --reason "Upgraded bd to vX.Y.Z via go install. Dolt: vA.B.C. Docs updated: [list]. Mirror refreshed."

git add pt-rebuild/docs/ pt-rebuild/AGENTS.md pt-rebuild/.beads/.gitignore
PT_README_OK=1 git commit -m "docs: upgrade bd to vX.Y.Z and sync docs (<bead-id>)"
git push
bd dolt push
```

## Resource / Token Impact Check (Before Installing New Tools)

Before adopting any new beads-adjacent tool (UI, coordination server, MCP):

1. **CPU/RAM at idle** — user's machine is older; Serena caused a full lockup
2. **MCP or CLI?** — MCP adds tokens to every message; CLI has zero overhead when not called
3. **Token impact** — does it inject into system prompt or context?

Apply a strict bar. If resource usage is unclear, investigate before recommending.

## Version History

| Date | bd version | Dolt version | Method | Notes |
|------|-----------|-------------|--------|-------|
| 2026-03-22 | 0.62.0 | 1.84.0 | go install | Added bd note, --exclude-type, custom status categories, Windows Dolt lifecycle fixes |
