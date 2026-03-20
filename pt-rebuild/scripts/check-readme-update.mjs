import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const readmePath = "README.md";
const gitPrefix = execFileSync("git", ["rev-parse", "--show-prefix"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim().replace(/\\/g, "/");

const sharedTriggerPatterns = [
  /^pages\/.+/,
  /^components\/.+/,
  /^hooks\/.+/,
  /^lib\/.+/,
  /^api\/.+/,
  /^public\/(?:index\.html|pt_view\.html|pt_editor\.html|rehab_coverage\.html|manifest(?:-tracker)?\.json)$/,
  /^styles\/globals\.css$/,
];

function getStagedFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, "/"))
    .map((file) =>
      gitPrefix && file.startsWith(gitPrefix) ? file.slice(gitPrefix.length) : file,
    );
}

function matchesSharedTrigger(file) {
  return sharedTriggerPatterns.some((pattern) => pattern.test(file));
}

function printFailure(sharedFiles) {
  console.error("README review required before commit.");
  console.error("");
  console.error("You staged shared ownership or route-shape files that can change the agent-ops map:");
  for (const file of sharedFiles) {
    console.error(`  - ${file}`);
  }
  console.error("");
  console.error(`Stage ${readmePath} if the ownership map, route map, or shared-file guidance changed.`);
  console.error("If the README remains accurate without edits, retry with:");
  console.error('  $env:PT_README_OK="1"; git commit ...');
  console.error("");
  console.error(`See ${path.join(repoRoot, readmePath)} and ${path.join(repoRoot, "AGENTS.md")}.`);
}

const stagedFiles = getStagedFiles();
const sharedFiles = stagedFiles.filter(matchesSharedTrigger);

if (sharedFiles.length === 0) {
  process.exit(0);
}

if (stagedFiles.includes(readmePath) || process.env.PT_README_OK === "1") {
  process.exit(0);
}

printFailure(sharedFiles);
process.exit(1);
