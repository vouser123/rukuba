## 1. Stabilize The Canonical Artifact Set

- [ ] 1.1 Verify that `proposal.md`, `design.md`, `design-extract.md`, `index-reconstruction-guide.md`, and `specs/` use a consistent scope for `nextjs-parity-governance`
- [ ] 1.2 Tighten `design.md` so it remains the primary behavior-first design surface and does not drift back into extract-style notes
- [ ] 1.3 Keep `design-extract.md` as the source-harvest evidence record and remove any accidental canonical guidance that belongs in `design.md` or `spec.md`
- [ ] 1.4 Confirm that the current source-length and top-down chunk coverage recorded in the docs still matches `public/index.html`

## 2. Finish The Static Index Reconstruction Contract

- [ ] 2.1 Add any remaining top-level shell composition details to `specs/index-logging-parity/spec.md` so an agent can rebuild the visible page chrome without opening static source
- [ ] 2.2 Add any remaining auth-surface and auth-state details to `specs/index-logging-parity/spec.md`, including pending, success, blocked, and reset-password behavior
- [ ] 2.3 Add any remaining picker, logger, history, and modal copy contracts to `specs/index-logging-parity/spec.md`, including empty, failed, blocked, and hint states
- [ ] 2.4 Add any remaining execution-flow details to `specs/index-logging-parity/spec.md`, especially where timer, hold, duration, manual log-set, next-set, and Pocket Mode behavior still depends on inference
- [ ] 2.5 Add any remaining state, timing, and ordering rules to `specs/index-logging-parity/spec.md`, including startup order, view-switch behavior, backdate semantics, local-history mutation, and queue-first save rules

## 3. Complete Role, Messaging, Offline, And Maintenance Coverage

- [ ] 3.1 Verify that therapist, patient, and admin viewing-context behavior is fully specified in `specs/index-logging-parity/spec.md`
- [ ] 3.2 Verify that tracker-owned messages behavior is fully specified in `specs/index-logging-parity/spec.md`, including recipient fallback, badge clearing, read-state handling, archive behavior, and delete confirmation
- [ ] 3.3 Verify that offline startup, cache fallback, reconnect ordering, duplicate-safe sync, and manual sync behavior are fully specified in `specs/index-logging-parity/spec.md`
- [ ] 3.4 Verify that history maintenance behavior is fully specified in `specs/index-logging-parity/spec.md`, including edit-session population, empty-set state, add/delete set behavior, whole-session save, and destructive delete

## 4. Prove That Runtime Discovery Is No Longer Required

- [ ] 4.1 Review the completed `index-logging-parity` spec against `design-extract.md` and record any remaining behavior that still requires reading static source to understand
- [ ] 4.2 Close the remaining “late discovery” gaps by adding missing user-visible behavior, ordering rules, or copy into the canonical spec/design artifacts
- [ ] 4.3 Confirm that an agent could explain how `today`, adherence, save flow, auth flow, Pocket Mode, messages, and offline recovery work from docs alone
- [ ] 4.4 Confirm that the docs distinguish observable behavior from implementation guesses, especially in Next.js-oriented sections

## 5. Prepare The Beads-Ready Planning Surface

- [ ] 5.1 Group the completed parity contract into implementation workstreams that could become Beads epics or issue clusters
- [ ] 5.2 Identify dependency order between workstreams, including what must land before logger, messages, history maintenance, and offline parity can be considered complete
- [ ] 5.3 Identify the validation expectations each future Beads issue should carry, including source-review checks and runtime verification targets
- [ ] 5.4 Do a final plan-quality pass on this change so the OpenSpec is ready to translate into detailed Beads epics and issues
