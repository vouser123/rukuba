#!/bin/bash
# sync-migration-doc.sh
#
# Copies pt-rebuild/docs/NEXTJS_MIGRATION.md from the current branch (nextjs)
# to main so both branches always have the same version of the doc.
#
# Usage:
#   npm run sync-docs        (from pt-rebuild/)
#   bash scripts/sync-migration-doc.sh
#
# Prerequisites: clean working tree (no uncommitted changes).

set -e

# Navigate to repo root regardless of where the script was invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."   # pt-rebuild/scripts/ -> pt-rebuild/ -> repo root

REPO_ROOT="$(pwd)"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
FILE="pt-rebuild/docs/NEXTJS_MIGRATION.md"

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

if [ ! -f "$FILE" ]; then
    echo "ERROR: $FILE not found in $REPO_ROOT"
    exit 1
fi

echo "Syncing $FILE from $CURRENT → main..."

# Capture file content before switching branches.
TMPFILE="$(mktemp)"
cp "$FILE" "$TMPFILE"

git checkout main

cp "$TMPFILE" "$FILE"
rm "$TMPFILE"

if git diff --quiet "$FILE"; then
    echo "No changes — $FILE is already up to date on main."
else
    git add "$FILE"
    git commit -m "docs: sync NEXTJS_MIGRATION.md from $CURRENT branch"
    echo "Committed updated $FILE to main."
fi

git checkout "$CURRENT"
echo "Done. Back on $CURRENT."
