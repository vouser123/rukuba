## Context

This change is not implementing the Next.js tracker yet. It is building the planning package that later migration work will actually rely on.

The current source truth is concentrated in static `public/index.html`, with supporting extraction material already preserved in:

- `design-extract.md`
- `index-reconstruction-guide.md`

Those files are intentionally kept as evidence and recovery material, but they are too large and too unevenly structured to serve as the primary migration planning surface. This design defines how the canonical OpenSpec artifacts should absorb that evidence so a later migration conversation can plan reconstruction work from the canonical docs first and consult extraction only when deeper proof is needed.

## Goals / Non-Goals

**Goals:**
- Preserve the extraction as a non-lossy evidence layer.
- Turn the extraction into canonical OpenSpec artifacts that are practical to read during migration planning.
- Make the capability specs strong enough that later migration agents do not need `index.html` to understand required behavior.
- Give future task slicing a stable basis for deciding what becomes a migration issue, what becomes an inconsistency review, and what remains supporting evidence only.
- Prepare the change so it can later be translated into Beads with explicit traceability back to the baseline and without re-discovery.
- Define a working contract for how this change moves from source evidence to migration-ready planning artifacts.
- Make the artifact package understandable to a handoff conversation that did not observe the extraction process directly.

**Non-Goals:**
- Designing the final Next.js component architecture.
- Replacing the extraction files with shorter summaries.
- Treating every observed static quirk as normative behavior without review.
- Jumping directly from extraction notes to Beads issue slicing.
- Writing migration execution tasks before the behavior contract is stable.

## Decisions

### Decision 1: Keep extraction and planning as separate layers

The preserved extraction files remain in the active change as supporting evidence, while the canonical OpenSpec artifacts are rewritten cleanly from proposal onward.

Why:
- The extraction is too valuable to discard.
- The extraction is too large to be the only thing migration agents rely on.
- Keeping both layers allows deliberate compression instead of accidental loss.

Alternatives considered:
- Use the extraction directly as the canonical artifact set.
  - Rejected because it is too long and too evidence-shaped for downstream planning.
- Delete or overwrite the extraction after summarizing it once.
  - Rejected because it would make later gaps hard to recover.

### Decision 2: Make canonical artifacts usable by migration agents, not merely schema-complete

The canonical artifacts must be written as working documents that a migration agent could actually use during implementation planning, rather than as minimal compliance documents that only satisfy OpenSpec headings.

Why:
- The extraction is too large to be the primary working surface.
- Migration agents need operational guidance, not just formal completeness.
- A short but vague artifact chain would recreate the same rediscovery problem in a different format.

Alternatives considered:
- Keep artifacts as minimal schema placeholders and rely on the extraction for detail.
  - Rejected because it would keep the real planning burden on the extraction.

### Decision 3: Write for handoff readers, not for the current conversation's memory

The canonical artifacts should assume the next conversation did not see the extraction work happen and does not have this chat history.

Why:
- Handoff safety is the real test of whether the artifact chain works.
- If an artifact only makes sense to the conversation that wrote it, it will fail during migration planning.
- Beads translation will be cleaner if artifact readers do not need hidden context.

Alternatives considered:
- Leave unstated assumptions in the artifacts and rely on extraction familiarity.
  - Rejected because it recreates the same late-discovery problem in another form.

### Decision 4: Treat proposal as the boundary-setting artifact

The proposal defines what this change is actually doing: building a static parity baseline and governance layer, not yet designing the final Next.js implementation.

Why:
- The artifact chain depends on scope clarity.
- If proposal scope drifts, every downstream artifact has to be rewritten.
- The user has explicitly asked for a stepwise process where each layer is the foundation for the next.

Alternatives considered:
- Let specs implicitly redefine the scope later.
  - Rejected because that weakens the contract between proposal and specs.

### Decision 5: Use specs as the main behavior-carrying compression layer

The specs are where the detailed static behavior must become normative and implementation-usable.

Why:
- Migration conversations may see the extraction, but they cannot depend on reading all of it.
- Beads should be created from a stable contract, not from raw evidence.
- Specs are the right place to carry forward user-visible behavior, ordering, timing, auth, API interaction, offline rules, and edge cases.
- Agents implementing or slicing work should assume they will not reopen `design-extract.md`, so the specs must preserve extraction-level specifics that change behavior instead of collapsing them into intent-only summaries.
- This includes smaller UX rules that later become bug sources when compressed away, such as layout-affecting shell behavior, auth-surface sequencing, edit-session details, form-parameter and dropdown behavior, `Other...` reveal rules, and other interaction details that influence what the user can do.

Alternatives considered:
- Put most behavior detail into design instead of specs.
  - Rejected because design should explain approach, not serve as the primary behavioral contract.

Specification standard for this change:
- Preserve named values verbatim when they affect parity, including copy strings, field names, helper names, storage keys, mutation identifiers, and exact clear/reset targets.
- Preserve ordered walkthroughs as ordered requirements when the extraction shows a behavior sequence that changes user-visible outcomes.
- Turn extraction inventories into explicit spec coverage, rather than assuming later agents will infer omitted items from context.
- Treat `design-extract.md` as the active evidence and recovery material; archived baseline companions should not be required for migration Beads or implementation planning once the canonical spec package is complete.

### Decision 5a: Readiness must be provable chunk by chunk, not inferred from later detail

The planning package must preserve enough source-coverage structure that later detailed sections do not create the false impression that earlier extraction chunks were already absorbed.

Why:
- The extract is source-ordered and contiguous, while the split specs are domain-organized.
- It is easy to over-credit a later detailed spec and miss an earlier uncovered source band.
- Beads readiness should be judged from explicit carry-forward proof, not optimism.

Alternatives considered:
- Treat any sufficiently detailed later spec as indirect proof that nearby earlier source areas were handled.
  - Rejected because this is how behavior gaps survive into execution planning.

### Decision 5b: The package must pass a docs-only reconstruction test before Beads slicing

Before migration work is distilled into Beads, the canonical package must support a reconstruction-grade review without reopening static source or relying on runtime rediscovery.

Why:
- The user expectation is that implementation agents can proceed from docs and Beads, not by rediscovering `index.html`.
- If docs-only review fails, Beads will encode a lossy or distorted contract.
- Runtime testing should validate the contract, not become the place where missing flow truth is rediscovered.

Alternatives considered:
- Allow Beads creation once the package feels directionally complete, then rely on runtime testing to fill gaps.
  - Rejected because it shifts avoidable compression errors into the execution layer.

### Decision 5c: The planning package must stay decomposable into stable review units

The canonical package must stay organized around stable review units such as shell, state, actions, APIs, timing, copy, and edge cases so later audits and Beads slicing can trace missing behavior to a clear home.

Why:
- The extract already surfaces these review units explicitly.
- Small UX details are easiest to lose when they are buried inside broad prose.
- Beads slicing is cleaner when each issue can point to a stable requirement family instead of one giant narrative.

Alternatives considered:
- Keep the package at a high enough level that later issue authors infer the right decomposition.
  - Rejected because issue authors will compress differently and produce inconsistent Beads.

### Decision 5d: Source review must precede code and runtime review

Parity review should happen in a fixed order: source-grounded package review first, implementation/code comparison second, and runtime validation last.

Why:
- The static source and extracted baseline still contain the authoritative answers.
- Code review without a stable source-grounded contract turns missing behavior into taste or guesswork.
- Runtime-first review is how subtle flow, copy, and timing rules get discovered too late.

Alternatives considered:
- Use runtime testing or code inspection as the primary discovery tool once a Next.js slice exists.
  - Rejected because this recreates the same late parity misses that prompted the extract.

### Decision 6: Keep design focused on planning architecture, not tracker re-description

This design should explain how the artifact chain supports migration planning, what each layer is responsible for, and what must be true before the work moves into Beads.

Why:
- Re-explaining tracker behavior here would duplicate the spec layer.
- Migration planning needs a clear operating model for how to use the artifacts together.
- Keeping design at the planning-architecture level makes later task and Beads creation cleaner.

Alternatives considered:
- Use design as a second behavior catalog parallel to specs.
  - Rejected because it would blur artifact roles and create another place for behavior drift.

### Decision 7: Record observed inconsistencies without blindly canonizing them

Observed static behaviors that appear buggy or internally inconsistent should be preserved in the evidence layer and called out explicitly during spec/design work, rather than silently normalized or automatically treated as intentional requirements.

Why:
- Some static behavior may be accidental.
- Migration should preserve intentional behavior, not blindly copy defects.
- Explicitly surfacing inconsistencies creates cleaner Beads decisions later.

Alternatives considered:
- Preserve every observed behavior as mandatory parity.
  - Rejected because known or likely defects need product review.
- Smooth over inconsistencies without documenting them.
  - Rejected because that loses important source truth.

### Decision 8: Use Beads as the execution layer, not the discovery layer

Beads should be created only after proposal, specs, design, and tasks have absorbed the relevant static behavior from the extraction.

Why:
- Beads are best at coordinating execution, dependency order, and ownership.
- Beads are not the right place to perform first-pass behavior discovery.
- Waiting until the OpenSpec layers are stable reduces the risk that migration work items are based on incomplete or distorted parity knowledge.

Alternatives considered:
- Create Beads directly from the extraction.
  - Rejected because too much important behavior would be implicit or easy to miss.
- Create Beads before specs and design are stable, then revise them later.
  - Rejected because that shifts avoidable compression errors into the execution tracker.

## Risks / Trade-offs

- [Compression loss between artifacts] -> Keep the extraction files active and require that important behavior be carried forward explicitly into canonical artifacts.
- [Earlier source bands appear “covered” because later domains are detailed] -> Keep coverage provable chunk by chunk and state uncovered or partially absorbed source bands explicitly until they are closed.
- [Specs become too summary-shaped] -> Keep revisiting the source-backed extraction when a flow is still vague or runtime-only.
- [Design drifts into migration implementation too early] -> Keep this design focused on artifact flow, planning architecture, and Beads handoff readiness, not component-level Next.js structure.
- [Potential static bugs get mistaken for required parity] -> Record them as observed inconsistencies and defer final treatment until migration design or issue slicing.
- [Beads get created from unstable docs] -> Do not move to Beads slicing until proposal, specs, design, and tasks are semantically aligned.
- [Runtime review becomes discovery instead of validation] -> Require source-grounded package review before code comparison and runtime testing.

## Migration Plan

1. Stabilize the proposal so the migration goal, capability boundaries, and role of Beads are explicit.
2. Recreate fresh specs from that proposal, using the extraction files as evidence and carrying forward the full extracted behavior, named values, copy, timing, ordering, risk notes, oddities, and migration-relevant observations that later work could need.
3. Keep this design focused on how the artifact chain should be used during migration planning and issue slicing.
4. Recreate tasks after proposal/spec/design are stable, with the task list written as a clean bridge into Beads and assuming Beads authors will slice from specs, not by rediscovering details in the extraction.
5. Prove readiness with a docs-only reconstruction check that confirms the package is decomposable into stable review units and that no uncovered source bands are being silently treated as absorbed.
6. Translate the resulting task plan into Beads as the migration execution graph, with each work item traceable back to the canonical OpenSpec artifacts and, when needed, to the preserved extraction.

Rollback strategy:
- If a canonical planning artifact drifts or compresses behavior incorrectly, restore the needed detail from the preserved extraction files and rewrite the affected artifact without deleting the evidence layer.

## Open Questions

- Which observed static inconsistencies should be treated as true parity requirements versus bugs to fix during migration?
- Are there any source bands or review units still only partially absorbed into the split specs and therefore not safe for Beads slicing yet?
- Which package areas still fail the docs-only reconstruction test for auth, layout, edits, offline flow, or smaller UX rules such as dropdown and form-parameter behavior?
