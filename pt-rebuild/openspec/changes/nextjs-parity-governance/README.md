# NextJS Parity Governance Package

This folder exists to turn static `public/index.html` behavior into a Beads-ready migration package for the Next.js tracker work.

If you are trying to understand what to migrate, what behavior must be preserved, or whether Beads can be created without reopening the static file, start here.

## What Is Here

### Canonical planning files

These are the active files to use when planning or slicing work.

- [proposal.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/proposal.md)
  - What it is: scope, intent, and capability boundaries for this change.
  - Look here when: you need to know what this OpenSpec package is trying to accomplish and what is in or out of scope.
- [design.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design.md)
  - What it is: planning architecture, artifact roles, readiness rules, and Beads handoff rules.
  - Look here when: you need to know how the package is supposed to work, what counts as “done,” and how docs become Beads.
- [tasks.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/tasks.md)
  - What it is: the bridge from canonical docs into the Beads tree.
  - Look here when: you are turning the package into execution work items.
- [specs/](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs)
  - What it is: the normative behavior contract split by domain.
  - Look here when: you need the actual behavior requirements for auth, shell, logging, offline behavior, messages, history maintenance, timing, and UX rules.

### Proof files

These exist to prove the canonical package absorbed the source truth strongly enough to support Beads creation.

- [coverage-matrix.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/coverage-matrix.md)
  - What it is: a mapping from source-ordered extract chunks and review units to the live canonical specs.
  - Look here when: you need to verify where a behavior landed, or check whether the package is complete enough to create Beads without reopening the extract.
- [audit-tracker.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/audit-tracker.md)
  - What it is: a ledger of audit findings and their exact landing places in the canonical package.
  - Look here when: you need to know whether any known gaps or wording problems still remain before closing the phase or creating Beads.

### Source-derived support files

These are useful companions, but they are not the canonical planning package.

- [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md)
  - What it is: the full chunked harvest from static `public/index.html`.
  - Look here when: the canonical package or proof layer still leaves a source-truth question unresolved.
- [index-reconstruction-guide.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/index-reconstruction-guide.md)
  - What it is: a human-friendly ordered guide for reconstructing the tracker top to bottom.
  - Look here when: you want one readable walkthrough of the tracker behavior, but not as the source of truth for Beads creation.

### Archive

- [archive/](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/archive)
  - What it is: historical or superseded planning material retained for reference only.
  - Look here when: you need old context or want to inspect prior planning history.
- [source-baseline-reference.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/archive/source-baseline-reference.md)
  - What it is: an archived source-derived companion that is no longer part of the active package.
  - Look here when: you explicitly need historical baseline context. Do not use it as a live planning dependency.

## When To Look At What

- Start with [proposal.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/proposal.md), [design.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design.md), and [specs/](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs) if you are planning or reviewing migration work.
- Open [coverage-matrix.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/coverage-matrix.md) if you need to prove that a source behavior has a live canonical home.
- Open [audit-tracker.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/audit-tracker.md) if you need to know whether known gaps still exist.
- Open [tasks.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/tasks.md) when you are translating the package into the actual Beads tree.
- Open [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md) only if the canonical package and proof layer do not answer the question.
- Do not rely on archived files for live planning unless you are deliberately checking historical context.
