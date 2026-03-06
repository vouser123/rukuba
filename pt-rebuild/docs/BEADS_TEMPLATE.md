# Beads Issue Template (PT Rebuild)

Use this template for all `bd create` issues in `pt-rebuild`.

## Required Description Template

```md
Source Reference: ptrebuild-xxx
Status: open|in_progress|blocked|done
Priority: P0|P1|P2|P3
Risk: high|medium|low
Scope: current|deferred
Agent Owner: codex|claude|shared
Agent Eligible: codex|claude|codex,claude
Tags: migration,ui,messages,...
File Scope:
- path/one
- path/two

Issue:
<single-sentence summary>

Context:
<what is known now, evidence, parity baseline, constraints from prior work>

Constraints/Caveats:
<must do / must not do / guardrails>

Validation Checklist:
- [ ] behavior/parity check 1
- [ ] behavior/parity check 2
- [ ] regression check 3

Dependencies:
- discovered-from: <beads-id or DN>
- blocks: <beads-id or DN>

Reactivation Trigger:
<only for deferred scope; otherwise "n/a">
```

## Closure Block (when completed)

Append this block before closing:

```md
Problem:
<what failed>

Root Cause:
<why it failed>

Change Made:
<what was changed>

Files Touched:
- path/one
- path/two

Validation:
<how verified>

Follow-ups:
<remaining items or "none">
```

## Agent Assignment Convention

- Set Beads assignee to current owner:
  - `codex`
  - `claude`
- Add one agent label:
  - `agent:codex`
  - `agent:claude`
  - `agent:shared`
- Use Beads IDs as primary references.
- Legacy DN references are optional during transition (`--external-ref DN-###` only when needed).

## Create Example

```bash
bd create \
  --title "Next.js index parity gaps" \
  --type bug \
  --priority P1 \
  --assignee codex \
  --labels "nextjs,pilot,migration,ui,agent:codex" \
  --description "<paste template body>"
```

## Update Example

```bash
bd update <beads-id> --status in_progress
bd update <beads-id> --assignee claude
bd label add <beads-id> agent:claude
bd label remove <beads-id> agent:codex
```
