## 1. Parity Verification Process

- [ ] 1.1 All parity work reads from the canonical spec package first before checking runtime behavior or rereading `design-extract.md`.
- [ ] 1.2 Source-precedence rule: each domain spec is the authoritative reference; `design-extract.md` and `index-reconstruction-guide.md` are fallback sources only for gaps not covered in specs.
- [ ] 1.3 Named-specifics carry-forward: parity verification must check exact copy strings, field names, helper names, storage keys, mutation identifiers, ordered sequences, API outcomes, and exact clear/reset targets — not just behavioral intent.
- [ ] 1.4 Verification method: parity work compares Next.js implementation against spec requirements; failures become bug fixes committed to the `nextjs` branch.

## 2. Shell And Context Parity

- [ ] 2.1 Verify top-level shell composition in Next.js: header with `PT Tracker` title, connectivity indicator, sync badge, hamburger; patient banner hidden by default; exactly two tabs `Exercises` and `History`; logger as a separate non-tab view.
- [ ] 2.2 Verify and fix auth surfaces: sign-in, forgot-password, reset-password modals with exact static copy, inline error areas, pending states (`Sending...`, `Updating...`), and auth-shell show/hide behavior.
- [ ] 2.3 Verify and fix authenticated bootstrap order: `/api/env` → offline init → queue restore → session inspect → hide auth UI → editor-link propagation → `loadData()` → first message check → 30-second poll start → interaction binding.
- [ ] 2.4 Verify and fix role and patient-context resolution: `/api/users` first, role match by auth id or email, `viewingPatientId` derivation, therapist fallback, `currentEmailNotifyEnabled` sync before continuing, patient banner behavior, missing-context blocking.
- [ ] 2.5 Verify and fix data-loading sequence: role/context → `/api/programs` → `/api/logs` → history render before picker cards → background cache hydration.
- [ ] 2.6 Verify and fix picker rendering: live `input` event filtering, archived exercise exclusion, `No active exercises.` vs `No exercises found.` as distinct conditions, adherence labels, dosage guidance, details affordance separate from logging tap.
- [ ] 2.7 Verify and fix exercise-details modal: read-only content sections, `No additional details available for this exercise.` fallback, no mutation of logging state on close.
- [ ] 2.8 Verify and fix history preview rendering: `formatDateTimeWithZone(...)` timestamp formatting, set summaries, notes preview, `No history yet. Start logging exercises!` and `Failed to load history.` empty/failed states.
- [ ] 2.9 Verify and fix shell utility actions: messages entry, manual sync entry, debug surface with tracker-diagnostic intent, reload behavior, hamburger wiring placed after bootstrap, sticky header, shared modal ownership.
- [ ] 2.10 Verify and fix adherence presentation: local-midnight day-difference semantics, `Done today` / `Never done` / `X days ago`, green (1–3 days) / orange warning (4–7 days) / red warning (8+ days) buckets.
- [ ] 2.11 Verify and fix auth-state clearing: `SIGNED_OUT` clears `currentUser`, `authToken`, `refreshToken`, `currentUserRole`, `currentUserProfileId`, `therapistId`, `viewingPatientId`, and `threadRecipientId`; no-session startup clears editor-link auth state.

## 3. Logging And Pocket Parity

- [ ] 3.1 Verify and fix exercise selection and logger entry: `currentSession` created at selection with `sessionId`, `exerciseId`, `exerciseName`, empty `sets`, and initial timestamp; activity-type derivation; side defaults (right for sided, null for bilateral); logger view transition.
- [ ] 3.2 Verify and fix counter mode: giant tap surface as primary increment, decrement guard (not below zero), live progress separate from accepted sets, milestone feedback, three-element surface (counter label, large tap display, minus/undo button).
- [ ] 3.3 Verify and fix timer mode: countdown behavior, reset semantics, hold rep-within-set progression, hold auto-pause on countdown completion, timer display resets to full target duration after each rep, duration single-run behavior, five-part timer surface (rep/duration info line, timer display, target label, start/pause button, reset button).
- [ ] 3.4 Verify and fix side switching: visible side labels, spoken side announcements, modal side inheritance, bilateral null-side semantics.
- [ ] 3.5 Verify and fix `Next Set` flow: captured-value summary, target comparison, empty-progress block (`Please perform at least one rep`), accepted-set feedback, delayed comparison speech, counter reset to 0 on confirm, app-recorded payload construction.
- [ ] 3.6 Verify and fix `Log Set` flow: target-prefill rules, hold-specific manual entry, duration `Seconds performed` path (hides hold-time input), timer-driven midpoint logging, form-parameter defaults, `Other...` handling, manual side selection, zero-value copy (`Please enter a value greater than 0`).
- [ ] 3.7 Verify and fix Pocket Mode: entry and exit, counter/timer display differences, `Tap to pause · Hold for partial` hint, long-press partial logging, refresh cadence, overlay-only dismissal.
- [ ] 3.8 Verify and fix undo/reset: previous-set removes most recent accepted set, undo toast names the removed set number, timer reset scope, blocked undo states, live-state vs accepted-set semantics.
- [ ] 3.9 Verify and fix session finalization: finish gate (at least one accepted set, copy `Please log at least one set before finishing`), notes modal behavior, backdate warning rules, cancel vs abandon, queue-first save ordering, immediate return to picker.
- [ ] 3.10 Verify and fix logger copy and speech feedback: progress wording, milestone speech thresholds, `Rep N complete`, all-sets-complete trigger in selection/progress check path, countdown thresholds, `Saved (with notes)` / `Saved (no notes)` feedback.
- [ ] 3.11 Review logger inconsistency items: `distance_feet: null` write behavior and any other payload or progression oddities — explicitly decide preserve, fix, or flag for each.

## 4. Messages And History Parity

- [ ] 4.1 Verify and fix messages entry sequence: hamburger close → frame yield → modal open; initial load; `lastReadMessageTime` update; best-effort server-side read mark; unread badge clear.
- [ ] 4.2 Verify and fix message recipient routing: thread-recipient preference, therapist fallback for patient/admin, viewed-patient fallback for therapist mode.
- [ ] 4.3 Verify and fix message rendering: `No messages yet. Send a message to your PT!`, failed-load copy, sender labels `You → PT` and `PT → You`, `Delivered` / `Read ...` states, `Hide` and `Undo Send` affordances.
- [ ] 4.4 Verify and fix message send, hide, undo-send: destructive confirmation, both-participants wording, one-hour undo window, send-success toast, message-list refresh after send.
- [ ] 4.5 Verify and fix email notification toggle: direct `change` event binding, `PATCH /api/users`, success/failure feedback, checkbox rollback on failure, sync from already-resolved `currentEmailNotifyEnabled` (not re-fetched on modal open).
- [ ] 4.6 Verify and fix history card maintenance entry: how edit-session opens from the index page.
- [ ] 4.7 Verify and fix edit-session field rendering: exercise-type-sensitive fields, `No sets logged` empty state, set-level form parameters, sided detection from exercise record OR saved set data, add-set defaults seeded from exercise, set renumbering after delete.
- [ ] 4.8 Verify and fix edit-session persistence: whole-session PATCH (timestamp + notes + sets together), history reload after save, `Session updated` toast, delete-session confirmation with destructive wording, `Session deleted` toast.

## 5. Offline And Timing Parity

- [ ] 5.1 Verify and fix offline startup and cache fallback: `Offline mode` / `Using cached data` feedback when cache present, explicit failed-load behavior when no cache, resolved-patient scoping.
- [ ] 5.2 Verify and fix queue-first save and sync badge: queue push before network attempt, sync badge update immediately on queue change, local history prepend before network confirms.
- [ ] 5.3 Verify and fix reconnect behavior: connectivity state + sync UI first, queue sync when authenticated + patient context present, picker-only full refresh on reconnect, background hydration when off-picker, post-sync history reload + cache hydration.
- [ ] 5.4 Verify and fix duplicate-safe sync: `pt_offline_queue` localStorage key, `client_mutation_id` field tied to session id, `409` counts as successful queue drain.
- [ ] 5.5 Verify and fix offline queue migration: old-format normalization, hold-bug collapse (multiple old sets with null reps AND null seconds collapse to one hold set).
- [ ] 5.6 Verify and fix adherence and time semantics: local-midnight `Done today`, green/orange/red bucket boundaries, `formatDateTimeWithZone(...)` for history timestamps, backdate rewriting, 30-second message poll cadence.
- [ ] 5.7 Verify and fix blocked and failed states: finish-with-zero-sets blocked, no-undo blocked, failed loads, zero-value validation copy, missing patient context block, missing message recipient block.
- [ ] 5.8 Verify and fix copy-sensitive parity: `Offline - changes will sync later`, `Tap to pause · Hold for partial`, progress copy, sync badge text, backdate warning copy, `Nothing to sync!`, toast animate-in and fade-out timing.
