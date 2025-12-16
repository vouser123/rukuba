#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
marker_regex='^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|)'

found=0
while IFS= read -r -d '' file; do
  if grep -Pq "$marker_regex" "$file"; then
    echo "Conflict markers found in: ${file#$root_dir/}" >&2
    found=1
  fi
done < <(find "$root_dir" -type f -not -path '*/.git/*' -print0)

if [[ $found -ne 0 ]]; then
  exit 1
else
  echo "No merge conflict markers detected."
fi
