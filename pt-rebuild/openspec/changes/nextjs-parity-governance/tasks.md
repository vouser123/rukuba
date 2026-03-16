## 1. Create Governance Beads Issues

- [ ] 1.1 Create the parent Beads issue for `legacy-parity-governance`.
- [ ] 1.2 Create a child Beads issue for source-precedence and chunk-coverage rules so later migration work starts from canonical docs before runtime rediscovery.
- [ ] 1.3 Create a child Beads issue for source-to-target parity mapping across the high-risk domains called out in governance.
- [ ] 1.4 Create a child Beads issue for named-specifics carry-forward rules so later migration work preserves exact copy strings, field names, helper names, storage keys, mutation identifiers, and exact clear/reset targets instead of paraphrasing them away.
- [ ] 1.5 Create a child Beads issue for handoff and verification rules, including how runtime testing, Playwright, and later review work must use the canonical package.

## 2. Create Shell And Context Beads Issues

- [ ] 2.1 Create the parent Beads issue for `tracker-shell-and-context-parity`.
- [ ] 2.2 Create a child Beads issue for top-level shell composition: title, header, connectivity state, sync badge, hamburger, nav ownership, and single-shell view switching.
- [ ] 2.3 Create a child Beads issue for auth surfaces and auth-state transitions, including sign-in, forgot-password, reset-password, inline errors, pending states, and auth-shell show/hide behavior.
- [ ] 2.4 Create a child Beads issue for authenticated bootstrap order: `/api/env`, queue restore, interaction binding placement, session bootstrap, editor-link propagation and clearing, message-check startup, and poll scheduling.
- [ ] 2.5 Create a child Beads issue for role resolution and patient-context ownership, including patient banner behavior, therapist/admin context rules, and missing-context blocking behavior.
- [ ] 2.6 Create a child Beads issue for startup data-loading order: `/api/users`, `/api/programs`, `/api/logs`, history-before-picker render, shell API timing, and exact shell-state clear targets on signed-out transitions.
- [ ] 2.7 Create a child Beads issue for picker rendering, search behavior, exercise-card fields, details affordance, live `input` filtering, and the two distinct picker empty conditions.
- [ ] 2.8 Create a child Beads issue for the exercise-details modal, including content sections, read-only behavior, and the `No additional details available for this exercise.` fallback copy.
- [ ] 2.9 Create a child Beads issue for history preview rendering from the shell side, including card summaries, notes preview, `formatDateTimeWithZone(...)` timestamp formatting, and list-level empty or failed states.
- [ ] 2.10 Create a child Beads issue for shell utility actions and chrome behavior: messages entry, manual sync entry, debug entry, reload, sticky header, mobile viewport posture, and shared modal ownership.
- [ ] 2.11 Create a child Beads issue for adherence presentation details, including local-midnight logic, exact green/orange/red recency bucket styling, and visible `Done today`/`Never done` outputs.

## 3. Create Logging And Pocket Beads Issues

- [ ] 3.1 Create the parent Beads issue for `tracker-logging-and-pocket-parity`.
- [ ] 3.2 Create a child Beads issue for exercise selection, `currentSession` creation, logger-shell entry, side defaults, activity-type derivation, and logger state invariants.
- [ ] 3.3 Create a child Beads issue for counter-mode execution: giant tap surface, decrement rules, live progress separation from accepted sets, and counter feedback.
- [ ] 3.4 Create a child Beads issue for timer-mode execution: countdown behavior, reset semantics, hold rep-within-set progression, hold auto-pause plus target reset, duration single-run behavior, and speech nuance.
- [ ] 3.5 Create a child Beads issue for side switching and sided-progress behavior: visible labels, spoken side announcements, modal side inheritance, and bilateral null-side semantics.
- [ ] 3.6 Create a child Beads issue for `Next Set`: captured-value summaries, target comparisons, empty-progress blocking, exact zero-value copy, accepted-set feedback, delayed comparison speech, counter reset, and app-recorded payload construction.
- [ ] 3.7 Create a child Beads issue for `Log Set`: target-prefill rules, hold-specific manual entry, duration `Seconds performed` behavior, timer-driven midpoint logging, form-parameter defaults, `Other...` handling, and manual side selection.
- [ ] 3.8 Create a child Beads issue for Pocket Mode: entry and exit, counter/timer display differences, running-state hint behavior including `Tap to pause · Hold for partial`, long-press partial logging, refresh cadence, and overlay-only dismissal.
- [ ] 3.9 Create a child Beads issue for undo/reset behavior: previous-set scope, timer reset scope, blocked undo behavior, and accepted-set versus live-state semantics.
- [ ] 3.10 Create a child Beads issue for session finalization: finish gating, notes modal behavior, backdate warning rules, cancel-versus-abandon behavior, queue-first save ordering, and immediate return-to-picker.
- [ ] 3.11 Create a child Beads issue for logger copy and execution feedback: progress wording, named counter/timer surface parts, target labels, milestone speech thresholds, `Rep N complete`, undo set-number feedback, all-sets-complete intent, countdown thresholds, and save-success feedback.
- [ ] 3.12 Create a child Beads issue for logger inconsistency review, including `distance_feet: null` write behavior and any other payload or progression oddities that must be preserved, fixed, or flagged explicitly.

## 4. Create Messages And History Beads Issues

- [ ] 4.1 Create the parent Beads issue for `tracker-messages-and-history-parity`.
- [ ] 4.2 Create a child Beads issue for message entry and open sequencing: hamburger ownership, frame-yield before modal open, initial load, local read cutoff update, and unread badge clearing.
- [ ] 4.3 Create a child Beads issue for message recipient routing: thread-recipient preference, therapist fallback, viewed-patient fallback, and blocked send states.
- [ ] 4.4 Create a child Beads issue for message rendering: empty state, failed load, sender labels, delivered/read states, messages modal composition, and local unread cutoff behavior.
- [ ] 4.5 Create a child Beads issue for message send, hide, undo-send, destructive-confirmation behavior, both-participants wording, one-hour undo window, and send-success toast plus list refresh.
- [ ] 4.6 Create a child Beads issue for the email notification toggle: direct `change` binding, `PATCH /api/users`, success/failure feedback, checkbox rollback on failure, and synchronization from `currentEmailNotifyEnabled`.
- [ ] 4.7 Create a child Beads issue for history-card maintenance entry and how edit-session opens from the index page.
- [ ] 4.8 Create a child Beads issue for edit-session field rendering: exercise-type-sensitive fields, `No sets logged`, set-level form parameters, sided detection from exercise or saved set data, add-set defaults, and renumbering after delete.
- [ ] 4.9 Create a child Beads issue for edit-session persistence: whole-session PATCH behavior, history reload, delete-session confirmation, `Session deleted` success feedback, and destructive wording-close-to-static behavior.

## 5. Create Offline And Timing Beads Issues

- [ ] 5.1 Create the parent Beads issue for `tracker-offline-and-timing-parity`.
- [ ] 5.2 Create a child Beads issue for offline startup and cache fallback: offline shell feedback, cache-availability gating, and resolved-patient scoping.
- [ ] 5.3 Create a child Beads issue for queue-first save and sync badge behavior: immediate local queue update, local history prepend, and immediate-versus-deferred feedback.
- [ ] 5.4 Create a child Beads issue for reconnect behavior: sync-first ordering, picker-only full refresh, background hydration when off-picker, immediate online-status feedback, and post-sync history reload plus cache hydration.
- [ ] 5.5 Create a child Beads issue for duplicate-safe sync and queue identity: `pt_offline_queue`, `client_mutation_id` tied to session id, and `409` responses counting as successful queue drain.
- [ ] 5.6 Create a child Beads issue for offline queue migration: old-format normalization and the hold-bug collapse signature of multiple old sets with null reps and null seconds.
- [ ] 5.7 Create a child Beads issue for adherence and time semantics: local-midnight `Done today`, exact green/orange/red recency buckets, `formatDateTimeWithZone(...)`, backdate rewriting, and poll cadence.
- [ ] 5.8 Create a child Beads issue for blocked and failed states: finish-with-zero-sets, no-undo, failed loads, invalid manual entry, missing patient context, and missing message recipient.
- [ ] 5.9 Create a child Beads issue for copy-sensitive parity: offline copy, hint text, progress copy, badge text, warning copy, and toast lifecycle timing that functionally changes user behavior.
