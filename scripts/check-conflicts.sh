#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root_dir"

marker_regex='^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|)'
found=0

# First, surface any unmerged files recorded by git (e.g., after an interrupted merge/rebase).
unmerged_files=$(git diff --name-only --diff-filter=U || true)
if [[ -n "$unmerged_files" ]]; then
  echo "Unmerged files detected:" >&2
  echo "$unmerged_files" >&2
  found=1
fi

# Then scan tracked files for conflict markers.
while IFS= read -r file; do
  if grep -Pq "$marker_regex" "$file"; then
    echo "Conflict markers found in: ${file}" >&2
    found=1
  fi
done < <(git ls-files)

if [[ $found -ne 0 ]]; then
  exit 1
else
  echo "No merge conflicts detected."
fi
