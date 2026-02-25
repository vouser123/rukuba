#!/bin/bash
# sync-migration-doc.sh
#
# Syncs these files from the current branch (nextjs) to main so both
# branches always have identical docs/dev tracking:
#
#   pt-rebuild/docs/NEXTJS_MIGRATION.md
#   pt-rebuild/docs/dev_notes.json
#   pt-rebuild/docs/DEV_NOTES.md
#
# This is a CLAUDE task — Claude runs this automatically after every
# commit that touches any of the above files on the nextjs branch.
# Do not run manually.
#
# Prerequisites: clean working tree (no uncommitted changes).

set -e

# Navigate to repo root regardless of where the script was invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."   # pt-rebuild/scripts/ -> pt-rebuild/ -> repo root

REPO_ROOT="$(pwd)"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"

FILES=(
    "pt-rebuild/docs/NEXTJS_MIGRATION.md"
    "pt-rebuild/docs/dev_notes.json"
    "pt-rebuild/docs/DEV_NOTES.md"
)

# Guard: must be on a non-main branch.
if [ "$CURRENT" = "main" ]; then
    echo "ERROR: You are already on main. Run this from the nextjs branch."
    exit 1
fi

# Guard: refuse if there are uncommitted changes (would be lost on checkout).
if ! git diff --quiet HEAD; then
    echo "ERROR: Uncommitted changes detected. Commit or stash them first."
    exit 1
fi

# Capture all files before switching branches.
echo "Capturing files from $CURRENT..."
declare -A TMPFILES
for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        TMP="$(mktemp)"
        cp "$FILE" "$TMP"
        TMPFILES["$FILE"]="$TMP"
    else
        echo "WARNING: $FILE not found — skipping."
    fi
done

git checkout main

# Apply captured files and collect changed ones.
CHANGED=()
for FILE in "${FILES[@]}"; do
    TMP="${TMPFILES[$FILE]:-}"
    if [ -n "$TMP" ]; then
        cp "$TMP" "$FILE"
        rm "$TMP"
        if ! git diff --quiet "$FILE"; then
            CHANGED+=("$FILE")
        fi
    fi
done

if [ ${#CHANGED[@]} -eq 0 ]; then
    echo "No changes — all files already up to date on main."
else
    git add "${CHANGED[@]}"
    git commit -m "docs: sync docs from $CURRENT branch"
    echo "Synced to main: ${CHANGED[*]}"
fi

git checkout "$CURRENT"
echo "Done. Back on $CURRENT."
