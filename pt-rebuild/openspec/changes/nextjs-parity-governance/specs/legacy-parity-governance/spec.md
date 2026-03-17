## ADDED Requirements

### Requirement: Static tracker source truth MUST be documented before migration slicing
The migration planning workflow SHALL treat the legacy static tracker as the source of truth for tracker behavior until an approved change explicitly says otherwise.

#### Scenario: Source truth is consulted before migration planning
- **WHEN** an agent plans or reviews a Next.js migration slice for the tracker
- **THEN** the agent MUST use the preserved static baseline package as the starting behavioral reference instead of relying on memory, chat history, or runtime rediscovery

### Requirement: Canonical artifacts MUST be usable without the extraction history
The canonical OpenSpec artifacts SHALL be written so a later migration conversation can understand what must be reconstructed without having seen the extraction work happen.

#### Scenario: Handoff conversation can use canonical artifacts first
- **WHEN** a later migration conversation picks up this change
- **THEN** it MUST be able to read proposal, specs, design, and tasks first and understand the migration-relevant contract before consulting extraction for deeper proof

### Requirement: Extraction MUST remain preserved as evidence
The preserved extraction files SHALL remain available as supporting evidence and recovery material while canonical artifacts are refined.

#### Scenario: Canonical artifact loses detail
- **WHEN** a later artifact is found to omit or blur an important static behavior
- **THEN** the preserved extraction MUST remain available so the missing behavior can be recovered and carried forward rather than re-discovered from `index.html`

### Requirement: Canonical artifacts MUST carry forward migration-critical behavior explicitly
Migration-critical truths from the extraction SHALL be promoted into canonical artifacts rather than left only in supporting evidence.

#### Scenario: Important tracker behavior exists in extraction
- **WHEN** the extraction identifies behavior that changes what the user sees, does, saves, or experiences
- **THEN** that behavior MUST become a canonical requirement, canonical scenario detail, or explicit inconsistency review item instead of surviving only in extraction notes

### Requirement: Behavior capture MUST stay separate from implementation structure
Canonical parity artifacts SHALL describe what the static tracker does before describing how a later implementation might organize code.

#### Scenario: Requirement is written for migration use
- **WHEN** a parity requirement is drafted from static source
- **THEN** it MUST describe the user-visible behavior, state rule, ordering rule, or API/timing contract rather than centering the text on future file ownership

### Requirement: Suspected static inconsistencies MUST be surfaced explicitly
Observed static behaviors that appear inconsistent, buggy, or incomplete SHALL be recorded as explicit review items instead of being silently normalized or blindly canonized.

#### Scenario: Observed static behavior looks defective
- **WHEN** extraction finds a static behavior that appears internally inconsistent or likely buggy
- **THEN** the canonical artifacts MUST preserve that observation and identify it as an inconsistency or review-required condition rather than automatically treating it as intentional parity

### Requirement: Specs MUST be the main behavior-carrying layer
The capability specs SHALL carry the detailed behavioral contract that later migration work and Beads execution planning depend on.

#### Scenario: Later planning needs tracker behavior detail
- **WHEN** a migration conversation needs to know what the static tracker MUST do
- **THEN** the capability specs MUST contain that behavioral contract in a form that is practical to read during planning and implementation review

### Requirement: Specs MUST carry forward extracted risks, notes, and oddities
The readable spec layer SHALL include extracted parity risks, late-discovery notes, suspicious static behaviors, and workflow warnings when a future migration conversation may need them.

#### Scenario: Extraction contains a risk note instead of a clean requirement
- **WHEN** the preserved extraction records a late-discovery zone, warning note, or suspicious static behavior
- **THEN** the spec layer MUST surface that note in readable form instead of leaving it buried only in extraction

### Requirement: Canonical specs MUST answer the docs-only reconstruction test
The canonical spec set SHALL answer the same practical reconstruction questions that static-source review was previously answering through browser rediscovery.

#### Scenario: `index.html` is unavailable during migration planning
- **WHEN** a later migration agent does not have `public/index.html` open
- **THEN** the canonical specs MUST still explain shell surfaces, major controls, modal order, visible copy in important states, timing and ordering rules, role-sensitive branches, API timing, and blocked states well enough to continue planning

### Requirement: Canonical specs MUST answer the state-and-lifecycle reconstruction test
The readable parity package SHALL preserve enough state meaning and lifecycle detail that later migration work can reason about what exists, what mutates, and what gets cleared.

#### Scenario: Later conversation needs to understand tracker state without source
- **WHEN** a migration agent needs to reason about `currentSession`, `currentExercise`, side state, queue state, auth state, message-read state, or timer state
- **THEN** the canonical specs MUST explain what that state means, what creates or updates it, and what clears it instead of leaving state lifecycle to inference

### Requirement: Source-map guidance MUST remain visible in canonical planning
The canonical artifacts SHALL preserve source-to-domain mapping guidance strongly enough that later parity review starts from the right behavior domain instead of from random runtime rediscovery.

#### Scenario: Agent reviews a migrated tracker slice
- **WHEN** an agent needs to compare a Next.js slice to the static baseline
- **THEN** the canonical planning package MUST make it clear which behavior domain to inspect first and which preserved extraction material can provide deeper proof when needed

### Requirement: User-visible binding behavior MUST not remain implicit
The canonical specs SHALL surface interaction-binding behaviors when they change what the user can do or what order the UI transitions follow.

#### Scenario: Static source uses different binding styles for different UX paths
- **WHEN** delegated actions, direct form submits, input listeners, or hamburger-owned handlers materially change the tracker flow
- **THEN** the readable specs MUST carry those behaviors forward as UX rules instead of leaving them hidden as source-only implementation details

### Requirement: Canonical specs MUST preserve the tracker action graph
The readable parity package SHALL preserve the central interaction graph strongly enough that a later migration conversation can reconstruct how user actions route through the shell.

#### Scenario: Later conversation needs to rebuild the interaction graph
- **WHEN** a migration agent needs to understand how taps, submits, closes, toggles, and maintenance actions are wired together
- **THEN** the canonical specs MUST preserve the major delegated-action families, direct-event exceptions, and hamburger-owned actions instead of leaving those routes implicit

### Requirement: Canonical planning MUST preserve the reconstruction standard
The migration planning package SHALL preserve the stated standard that an agent should be able to rebuild static `index.html` to look and behave identically from the docs package plus preserved evidence.

#### Scenario: Team evaluates whether planning artifacts are complete enough
- **WHEN** proposal, specs, design, or tasks are reviewed for readiness
- **THEN** readiness MUST be judged against whether the package could support total reconstruction of the static tracker without fresh behavior discovery from chat history

### Requirement: Planning artifacts MUST keep extraction and canon separate without dropping content
The planning chain SHALL preserve the distinction between evidence and canonical artifacts without using that distinction to hide behavior from the readable docs.

#### Scenario: Information is moved from extraction into specs
- **WHEN** content is rewritten from extraction into canonical artifacts
- **THEN** the rewrite MUST improve readability and organization without dropping migration-relevant behavior, risk notes, edge cases, or suspicious static inconsistencies

### Requirement: Source coverage MUST remain provable in contiguous chunks
The planning package SHALL preserve the rule that the extraction and its carry-forward can be checked in contiguous chunks rather than trusted as an undocumented summary.

#### Scenario: Later conversation needs to verify source coverage
- **WHEN** a later migration conversation checks whether the readable specs actually came from the extracted baseline
- **THEN** the planning package MUST preserve a chunked coverage trail that shows the source was harvested top-down and can still be audited chunk by chunk

### Requirement: Later chunks MUST not imply earlier chunks were absorbed
The carry-forward workflow SHALL preserve the rule that later-domain coverage does not silently imply earlier extraction chunks were already handled.

#### Scenario: A spec is detailed for a later behavior domain
- **WHEN** a later extraction chunk is heavily represented in canonical specs
- **THEN** that detail MUST NOT be treated as proof that earlier chunks were also fully carried forward unless those earlier chunks are explicitly covered or still marked pending

### Requirement: Canonical planning MUST preserve source-ordered anchors by behavior domain
The readable planning package SHALL preserve source-to-domain anchors strongly enough that later parity review can find the right behavior family without re-reading the entire extraction or static source.

#### Scenario: Later conversation needs to locate a behavior domain quickly
- **WHEN** a migration agent needs to review shell bootstrap, logger set acceptance, Pocket Mode, messages, history maintenance, or offline recovery
- **THEN** the canonical package MUST preserve which behavior domain owns that rule and which preserved evidence area can back it up if deeper proof is needed

### Requirement: High-risk parity domains MUST preserve source-to-target mapping expectations
The canonical planning package SHALL preserve the rule that high-risk tracker subflows need explicit mapping from static source domain to intended migration destination.

#### Scenario: Later conversation reviews a risky tracker subflow
- **WHEN** a migration agent reviews shell context resolution, session finalization, tracker-owned messages, Pocket Mode, timing semantics, or feedback parity
- **THEN** the planning package MUST preserve that those domains require explicit source-to-target mapping, the behavior or invariant being preserved, and the failure signature if the migrated flow is wrong or missing

### Requirement: Hidden-but-important tracker rules MUST surface canonically
The readable parity package SHALL preserve shell rules that are easy to miss because they are not obvious from a casual UI skim.

#### Scenario: Extraction identifies a hidden but behaviorally important rule
- **WHEN** the extracted baseline identifies rules such as frame-yield before messages, local read state plus server mark-as-read, queue-first save, local history prepend after save, side inheritance into subflows, or picker-only refresh on reconnect
- **THEN** those rules MUST be surfaced in canonical specs instead of being left only in extraction commentary

### Requirement: Transitional migration snapshot notes MUST remain visible until replaced
The readable parity package SHALL preserve extracted notes about what the current Next.js shell already appears to cover versus what still remains unconfirmed or missing, until later migration planning replaces them with task-level truth.

#### Scenario: Later migration conversation uses the parity package to scope remaining work
- **WHEN** a handoff conversation needs to understand which tracker domains were already visible in the current Next.js shell during extraction time and which were still unconfirmed or absent
- **THEN** the parity package MUST continue surfacing that transitional snapshot as planning guidance instead of dropping it as “not part of static behavior”

### Requirement: Canonical planning MUST preserve stable review units
The readable parity package SHALL stay organized around stable review units rather than one long narrative.

#### Scenario: Team turns the parity package into downstream planning work
- **WHEN** a later conversation reads the specs and design in order to create tasks or Beads
- **THEN** the package MUST remain decomposable into units such as shell surfaces, state, actions, APIs, timing, copy, and edge cases so details do not disappear inside one giant prose block

### Requirement: Uncovered source bands MUST remain explicitly uncovered
The planning workflow SHALL preserve the rule that unknown or not-yet-absorbed source areas are called out rather than silently treated as covered.

#### Scenario: A behavior domain has not yet been fully carried forward
- **WHEN** a later audit finds that a source area or extraction chunk is only partially represented in the canonical artifacts
- **THEN** that gap MUST be stated explicitly until it is absorbed, rather than being implied covered by nearby documentation

### Requirement: Beads MUST be used as the execution layer, not the discovery layer
Beads SHALL be created only after the canonical OpenSpec artifacts are stable enough to support migration execution without fresh tracker rediscovery.

#### Scenario: Team is ready to create migration work items
- **WHEN** proposal, specs, design, and tasks are stable enough to support tracker reconstruction planning
- **THEN** Beads MAY be created as the dependency-ordered execution graph for migration work

### Requirement: Source-first parity review MUST happen before runtime rediscovery
The parity workflow SHALL use source-grounded review before relying on Playwright or manual browser walkthroughs to discover behavior.

#### Scenario: Migration slice is reviewed for parity
- **WHEN** an agent reviews a migrated tracker flow
- **THEN** the agent MUST compare the implementation against the documented static contract first, and use runtime testing to validate that contract rather than to discover it for the first time

### Requirement: Runtime testing MUST validate documented behavior, not replace it
The canonical parity workflow SHALL treat browser testing as confirmation of the documented contract rather than the primary source of tracker truth.

#### Scenario: Team uses Playwright or manual walkthroughs during parity review
- **WHEN** runtime testing is performed on a migrated tracker flow
- **THEN** the test pass MUST validate the documented states, transitions, and edge cases instead of serving as the first place the team learns how the static tracker behaves

### Requirement: Preserved-document inconsistencies MUST remain visible until resolved
The parity package SHALL surface disagreements between preserved baseline documents instead of silently choosing one and hiding the mismatch.

#### Scenario: Preserved docs disagree about a shell or auth detail
- **WHEN** `design-extract.md`, `index-reconstruction-guide.md`, or archived source companions disagree on a detail such as auth-surface wording or shell labeling
- **THEN** the canonical package MUST either resolve the difference from source-backed evidence or preserve it as an explicit documentation inconsistency for later migration review

### Requirement: Named specifics MUST survive extraction-to-spec carry-forward
The canonical spec layer SHALL preserve exact named values from the extraction whenever they affect parity, review, or later task slicing.

#### Scenario: Extraction records a concrete value instead of a generic behavior
- **WHEN** the preserved extraction names a copy string, field name, function or helper name, localStorage key, mutation identifier, endpoint signature, or exact reset or clear target
- **THEN** the canonical specs MUST preserve that named value verbatim or near-verbatim instead of replacing it with only a generalized summary
