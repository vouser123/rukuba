## Why

The Next.js migration needs one planning package that answers a practical question: "What exactly must be rebuilt from static `index.html`, and how will we turn that into executable migration work without losing behavior?" Right now those answers are split across source code, extraction notes, and runtime rediscovery, which causes late parity misses and weakens downstream planning.

This change exists to close that gap before implementation slicing. Its job is not to migrate the tracker directly. Its job is to produce the migration baseline and planning package that later Beads work will execute against.

The intended reader is a later migration conversation that did not participate in the extraction work. That reader should be able to pick up the canonical artifacts, understand what must be preserved from static `index.html`, and continue toward Beads without reconstructing this reasoning from chat history.

## What Changes

- Build the OpenSpec package that migration agents will actually use when reconstructing the static tracker in Next.js.
- Define the static tracker as the baseline for all migration-critical domains:
  - visible UI and copy
  - flow order and modal sequence
  - auth and startup behavior
  - role and viewing-context rules
  - save ordering, history behavior, and offline recovery
  - API calls and timing rules
  - blocked states, inconsistencies, and edge cases
- Preserve the extraction files as supporting evidence, while moving the migration-critical truths into canonical OpenSpec artifacts that are short enough to use and detailed enough to trust.
- Produce a spec and design package that can later be translated into Beads as dependency-ordered migration work, without reopening `index.html` to rediscover missing behavior.
- Treat observed static inconsistencies separately from intentional parity rules so later migration tasks can decide whether to preserve, fix, or flag them.
- Produce a planning chain with clear roles:
  - extraction files preserve source evidence
  - proposal sets migration scope and capability boundaries
  - specs define what behavior Next.js must reconstruct
  - design explains how the baseline package should support migration planning
  - tasks later become the Beads-ready execution plan

## Capabilities

### New Capabilities
- `legacy-parity-governance`: Governs how agents use the legacy static app as the behavioral source of truth while planning and validating the Next.js migration.
- `tracker-shell-and-context-parity`: Defines the static tracker shell contract, including auth surfaces, startup order, role/viewing context, shell ownership, data-loading order, picker behavior, exercise-details behavior, and history rendering.
- `tracker-logging-and-pocket-parity`: Defines the active logger contract, including session creation, execution modes, side rules, `Next Set`, `Log Set`, Pocket Mode, form-parameter behavior, set payload rules, and session finalization.
- `tracker-messages-and-history-parity`: Defines tracker-owned supporting flows, including messages, recipient routing, unread behavior, edit-session maintenance, history edit/delete behavior, and their visible copy and guards.
- `tracker-offline-and-timing-parity`: Defines offline behavior, queue and sync semantics, timing rules, adherence semantics, blocked states, failure states, and static inconsistencies that later migration work must explicitly review.

### Modified Capabilities
<!-- None. This change is establishing the first clean baseline for these capabilities. -->

## Impact

- `pt-rebuild/openspec/changes/nextjs-parity-governance/`
- later migration agents who need a usable tracker baseline without reopening static source
- future Next.js migration design for the tracker
- future Beads execution planning for tracker migration work
- parity review of migrated Next.js tracker behavior against the static contract
- parity review workflow for AI agents
- static behavior documentation derived from `pt-rebuild/public/index.html`
