Purpose: define how the Next.js tracker migration should use the static baseline artifacts to achieve parity safely and in a Beads-ready way.

## Context

This change does not implement tracker parity directly. It establishes the migration design that should sit on top of the static baseline contract.

The current problem is not only missing parity in the Next.js tracker. It is also process drift:

- the static tracker behavior is large and concentrated in `public/index.html`
- agents have been discovering behavior late by using Playwright or ad hoc code reading
- migration planning has started before the static baseline was cleanly documented
- artifact roles blurred together, especially baseline exploration versus migration design

This design assumes the baseline artifacts now have distinct roles:

- [proposal.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/proposal.md): why this baseline change exists
- [specs/index-logging-parity/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/index-logging-parity/spec.md): what the static tracker must do
- [specs/legacy-parity-governance/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/legacy-parity-governance/spec.md): governance rules for source-first parity work
- [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md): source-harvest evidence from static index
- [index-reconstruction-guide.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/index-reconstruction-guide.md): ordered legacy-baseline reading guide

The design question for this file is: how should later Next.js migration work be structured so those baseline artifacts actually reduce late parity discovery?

## Goals / Non-Goals

**Goals:**

- define a clean migration-design role for this change, separate from source harvesting
- make the static baseline the required input to Next.js parity work instead of a helpful extra
- define how agents should compare Next.js code against the baseline before runtime testing
- define a work-slicing approach that later converts cleanly into Beads epics and issues
- reduce cross-file ambiguity by grouping migration work around user-visible tracker domains

**Non-Goals:**

- implement tracker parity in Next.js in this change
- replace the baseline artifacts with design prose
- create the final Beads issue set in this document
- design every non-index migration surface in the app
- restate every legacy behavior already captured in the specs and extract

## Decisions

### Decision 1: The specs are the parity contract; design is the migration approach

The baseline behavior belongs in the capability specs, not in this file.

Why:

- the spec-driven schema expects specs to define what the system should do
- the static behavior contract needs normative SHALL/MUST statements and scenarios
- migration design should explain how to satisfy that contract, not duplicate it

Alternatives considered:

- keep the legacy reconstruction summary in `design.md`
  - rejected because it confuses baseline capture with migration approach
- move all behavior into design and keep specs minimal
  - rejected because it weakens requirement clarity and testability

### Decision 2: Migration work should be sliced by behavior domain, not by current file names

Future Next.js work should be grouped around user-visible tracker domains:

- startup and auth bootstrap
- role and viewing-context resolution
- shell composition and navigation ownership
- logger execution
- set acceptance and save flow
- messages
- history maintenance
- offline and recovery behavior
- timing and copy parity

Why:

- the static tracker concentrates many flows in one HTML file, while Next.js distributes them
- slicing by current component or hook names risks scattering one user-visible behavior across multiple issues
- Beads issues are easier to review when they correspond to one parity domain with one verification story

Alternatives considered:

- slice by Next.js file tree only
  - rejected because one file often spans multiple parity domains
- slice by API endpoint only
  - rejected because much of the risk is UX ordering, local state, and shell behavior

### Decision 3: Source-first review is a required gate before runtime parity testing

Migration work should be reviewed against the baseline artifacts before Playwright or manual testing is used.

Why:

- the governance spec explicitly aims to stop runtime from being the first discovery step
- source-first review is where missing timing rules, copy, side behavior, and save ordering are caught earliest
- runtime should validate implementation, not define baseline truth

Alternatives considered:

- continue relying on browser walkthroughs as the main parity tool
  - rejected because it repeatedly finds issues too late

### Decision 4: Legacy source evidence should stay preserved in companion docs

The source harvest should remain available, but outside the migration design file.

Why:

- agents still need traceability back to the static file
- the design artifact should stay readable and architecture-shaped
- preserving the extract avoids losing the large amount of work already done

Alternatives considered:

- delete the extract once specs exist
  - rejected because traceability still matters
- fold the extract into design
  - rejected because it makes the design artifact unreadable

### Decision 5: Beads planning should begin only after semantic artifact cleanup

This change should feed Beads only after the proposal, specs, design, and tasks each match their intended OpenSpec role.

Why:

- planning from semantically mixed artifacts creates poor issue boundaries
- if design is still baseline exploration, tasks become cleanup tasks instead of migration work
- Beads works best when each issue can point to a stable contract and a stable approach

Alternatives considered:

- create Beads immediately from the current mixed artifact set
  - rejected because it would encode artifact confusion into the implementation queue

## Risks / Trade-offs

- [Risk] Specs may still miss legacy details even after major harvesting
  - Mitigation: keep using `design-extract.md` as the audit source and close remaining gaps before Beads slicing

- [Risk] Agents may still read the extract first and ignore the design/spec split
  - Mitigation: keep the migration design separate and point to supporting artifacts explicitly

- [Risk] Behavioral workstreams still overlap in Next.js implementation
  - Mitigation: slice Beads by dominant user-visible domain and call out cross-domain dependencies explicitly

- [Risk] The baseline may keep evolving while migration planning starts
  - Mitigation: finish semantic cleanup first, then treat the specs as the stable parity gate for issue creation

- [Risk] Copy and timing details may be dismissed as non-essential during implementation
  - Mitigation: keep them as normative spec scenarios so they remain part of review and verification

## Migration Plan

1. normalize the artifact roles
   - proposal stays about baseline purpose and scope
   - specs stay about static behavior requirements
   - baseline design stays in `design.md`
   - migration approach stays in `migration-design.md`
   - tasks become the Beads-preparation plan

2. finish the static baseline contract
   - close remaining gaps in `index-logging-parity/spec.md`
   - use `design-extract.md` and `index-reconstruction-guide.md` as supporting references

3. perform a source-first readiness pass
   - confirm that an agent can explain the tracker without opening `index.html`
   - confirm that runtime testing is no longer required to learn baseline behavior

4. translate the stabilized parity domains into Beads-ready workstreams
   - one workstream per dominant user-visible parity domain
   - include dependency order and verification expectations

5. only then create or revise implementation tasks and Beads issues
   - issues should point back to the finalized specs and this design

Rollback strategy:

- if the semantic split becomes confusing, keep `design-extract.md` and `index-reconstruction-guide.md` as stable references and rewrite migration design without losing source evidence
- no application-code rollback is required because this change is documentation and planning only

## Open Questions

- when should this change stop being “baseline cleanup” and start being “migration design complete” for Beads translation?
- should future tracker work get one Beads epic per parity domain, or one epic for index parity with domain-specific child issues?
- should copy- and timing-heavy parity checks live in the same future issues as UI structure, or in dedicated verification issues?
- after index parity is stabilized, which non-index surface should become the next baseline change?
