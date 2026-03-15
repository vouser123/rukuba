When a task is completed in pt-rebuild:

- Run the appropriate quality gates if code changed.
- Prefer Vercel deployment checks/logs for routine validation.
- Use local npm run build when Vercel signal is insufficient or before riskier refactors.
- If dev_notes.json changed, run npm run dev-notes:build and npm run dev-notes:check.
- Update tracking state in the correct tracker:
  - Beads for NextJS migration/workstream items.
  - dev_notes.json only for non-NextJS items, per project policy.
- Include Beads IDs in commit messages.
- End-of-session sync when code changed: git pull --rebase, bd dolt pull, bd dolt push, git push, git status.
- Final handoff should include what changed, how to verify, known gaps, and rollback path.

Beads discipline:
- Do not use bd edit from agent sessions; use bd update flags.
- Use dependency types correctly and avoid duplicate dependency links.