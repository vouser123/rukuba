import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const hooksDir = path.join(repoRoot, ".beads", "hooks");
const hookPath = path.join(hooksDir, "commit-msg");

const hookScript = `#!/usr/bin/env sh
set -eu

msg_file="$1"

# Allow merge commits, squash commits, and reverts without a Beads ID.
first_line="$(head -n 1 "$msg_file" || true)"
if printf '%s' "$first_line" | grep -Eq '^(Merge |Revert |fixup! |squash! )'; then
  exit 0
fi

if grep -Eq '\\((pt|bd)-[A-Za-z0-9][A-Za-z0-9.-]*\\)' "$msg_file"; then
  exit 0
fi

echo "Commit message must include a Beads ID in parentheses, e.g.:" >&2
echo "  Add minimal PR template (pt-84e)" >&2
exit 1
`;

await fs.mkdir(hooksDir, { recursive: true });
await fs.writeFile(hookPath, hookScript, { mode: 0o755 });

try {
  await fs.chmod(hookPath, 0o755);
} catch {
  // chmod is not meaningful on some Windows setups; ignore.
}

console.log(`Installed ${path.relative(repoRoot, hookPath)}`);
