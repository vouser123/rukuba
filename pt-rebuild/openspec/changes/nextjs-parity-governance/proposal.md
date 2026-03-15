Purpose: establish the parity-governance and static-baseline scope for the Next.js tracker migration, so later migration design and Beads planning can be built on a trusted source contract.

## Why

The Next.js migration is missing small but important behaviors from the original app because too much parity knowledge is still being rediscovered from chat history, ad hoc code review, and manual runtime exploration. Agents are still learning key truths by opening the legacy tracker in Playwright instead of from OpenSpec.

Before a migration design can be trusted, we need a source-grounded baseline that states what the static tracker actually does. Without that baseline:

- migration work is planned against incomplete assumptions
- behavioral regressions are found late
- non-technical review has to catch missing parity by hand
- Beads planning happens before the contract is stable enough to slice correctly

## What Changes

- Establish OpenSpec as the governance layer for static-to-Next.js parity work.
- Define the rules agents must follow when using the legacy app as the behavioral source of truth.
- Capture the static tracker index as a reconstruction-grade behavior contract, with enough detail that agents can understand shell composition, flow order, copy, timing, auth, API, offline behavior, and edge cases without opening `public/index.html`.
- Separate baseline capture from migration planning:
  - the capability specs define what the static tracker does
  - later migration design should define how Next.js must satisfy that contract
- Create a handoff surface that can later be translated into Beads only after the baseline is stable enough to support clean slicing.
- Leave non-index surfaces, runtime signoff, and final Beads filing for later changes once this baseline is stable.

## Capabilities

### New Capabilities
- `legacy-parity-governance`: Defines the governing rules for using the original app as the behavioral source of truth during migration, including source precedence, artifact scope discipline, and source-first review expectations.
- `index-logging-parity`: Defines the static `index.html` tracker behavior contract, including startup, role and viewing context, shell surfaces, exercise selection, logging flow, Pocket Mode, messages, save behavior, offline recovery, timing semantics, and history maintenance.

### Modified Capabilities
<!-- None. This is the first OpenSpec parity baseline for the repo. -->

## Impact

Affected systems include:

- the OpenSpec workspace under `openspec/`
- source-review and parity-check workflows for AI agents
- future migration design work for the Next.js tracker
- future Beads planning for tracker migration slices
- the legacy source behavior under `public/` and `public/js/`

This change is intended to make the static tracker contract reliable first, so migration design and Beads planning can happen on top of a stable baseline instead of a moving target.
