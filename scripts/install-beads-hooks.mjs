import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "pt-rebuild");
const hooksDir = path.join(repoRoot, ".beads", "hooks");
const commitMsgHookPath = path.join(hooksDir, "commit-msg");
const preCommitHookPath = path.join(hooksDir, "pre-commit");

const commitMsgHookScript = `#!/usr/bin/env sh
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

const preCommitHookScript = `#!/usr/bin/env sh
set -eu

hook_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cd "$hook_dir/../.."

node ./scripts/check-readme-update.mjs
`;

await fs.mkdir(hooksDir, { recursive: true });
await fs.writeFile(commitMsgHookPath, commitMsgHookScript, { mode: 0o755 });
await fs.writeFile(preCommitHookPath, preCommitHookScript, { mode: 0o755 });

for (const hookPath of [commitMsgHookPath, preCommitHookPath]) {
  try {
    await fs.chmod(hookPath, 0o755);
  } catch {
    // chmod is not meaningful on some Windows setups; ignore.
  }
}

console.log(`Installed ${path.relative(repoRoot, commitMsgHookPath)}`);
console.log(`Installed ${path.relative(repoRoot, preCommitHookPath)}`);
