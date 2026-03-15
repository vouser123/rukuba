Purpose: document the static tracker index completely enough that an agent could rebuild `index.html` to look and behave identically even if the original source file were no longer available.

## Index Behavior Capture Notes

This change treats the tracker index as a reconstruction contract, not just a review aid. The primary target is the lived interaction process and shell behavior:

- what the user taps
- what opens next
- what defaults appear
- what actions are available from that state
- what gets saved
- what changes when offline or by role

The standard for this document is stronger than "enough to review migration work." It should be specific enough that an agent could recreate:

- the shell views and what each one contains
- the major controls and what each one does
- the modal sequence and blocked states
- the text the user sees in important states
- the timing and ordering rules that change perceived behavior
- the role-sensitive and offline-sensitive branches

The static app concentrates this behavior inside `public/index.html`, while the Next.js version distributes it across `pages/index.js`, `components/TimerPanel.js`, `components/SessionLoggerModal.js`, `components/NextSetConfirmModal.js`, `components/HistoryPanel.js`, `hooks/useSessionLogging.js`, `hooks/useTimerSpeech.js`, `hooks/useExerciseTimer.js`, and related `lib/` helpers.

## Review Revisions

This review makes four corrections to the original OpenSpec pass:

- scope alignment: the proposal now names only the capabilities actually present in this change
- artifact compliance: each artifact now starts with the single-domain purpose statement required by governance
- early-detection coverage: the index spec now requires source-to-target mapping for the flows that have been escaping into late Playwright discovery
- role and shell clarity: the index spec now treats viewing context, patient banner behavior, recipient resolution, and tracker-owned menu actions as first-class parity behavior instead of background setup

## Ordered Reconstruction Guide

This section is the intended reading order for rebuild work. The detailed harvest sections below remain the evidence base, but an agent should be able to read this top to bottom and understand how static `index.html` behaves without jumping around.

### 1. Read order for implementation and review

1. startup and shell bootstrap
   - auth state, token state, offline-manager init, connectivity listeners, queue load, event binding
2. role and viewing-context resolution
   - who the signed-in user is, whose patient data is loaded, when the patient banner appears, who messages target
3. shell surfaces and ownership
   - header, badges, nav tabs, picker, logger, history, auth modals, notes modal, messages modal, edit-session modal, Pocket Mode
4. data-loading sequence
   - `/api/users`, `/api/programs`, `/api/logs`, history-before-picker render, background cache hydration
5. picker and history rendering
   - exercise cards, adherence copy, history-card preview copy, empty and failed states
6. session creation and logger entry
   - `currentExercise`, `currentSession`, activity-type derivation, side defaults, mode selection
7. active execution behavior
   - counter behavior, timer behavior, audio and speech, Pocket Mode, side switching, live progress vs accepted sets
8. set acceptance subflows
   - `Next Set`, `Log Set`, parameter defaults, side inheritance, comparison announcements, undo behavior
9. session finalization
   - finish gate, notes, backdate, cancel-with-confirmation, queue-first save, immediate local-history prepend
10. tracker-owned secondary flows
   - messages open/load/read/send/archive/delete, edit-session open/edit/delete
11. offline and recovery behavior
   - cached startup, sync badge, manual sync, automatic sync on reconnect, duplicate-safe queue drain, picker-only refresh
12. timing and invariant rules
   - local-midnight `Done today`, polling cadence, session timestamp rewrite, state-clearing rules, blocked states and edge cases

### 2. Ordered behavior summary

#### 2a. Startup and auth bootstrap

- `init()` loads Supabase config from `/api/env`, initializes the offline manager, installs connectivity listeners, checks for an existing session, then either opens auth UI or enters authenticated bootstrap.
- authenticated startup sets `currentUser`, `authToken`, and `refreshToken`, hides auth UI, updates the editor link, runs `loadData()`, checks messages immediately, then starts 30-second message polling
- `PASSWORD_RECOVERY` hides the normal auth surfaces and opens the new-password flow
- `SIGNED_IN` repeats the authenticated bootstrap path
- `SIGNED_OUT` clears user, token, role, profile, therapist, and thread-recipient state, then returns the shell to the sign-in surface

#### 2b. Role and viewing context

- `/api/users` is the blocking context-resolution step before exercises or history can be trusted
- patient role views its own data and may get `therapistId` from its profile
- therapist role resolves a patient from its assigned patients, loads that patient’s tracker data, and shows the patient banner
- admin role either behaves like a patient when it has `therapist_id`, or falls back to some patient-viewing context when it does not
- if no patient context can be resolved, normal tracker bootstrap does not continue

#### 2c. Shell and markup surfaces

- the shell is a three-view app: `picker`, `logger`, and `history`
- only `picker` and `history` have active nav-tab ownership; `logger` is outside top-tab navigation
- the visible shell also includes three auth modals, exercise-details modal, log-set modal, next-set modal, notes modal, messages modal, edit-session modal, and Pocket Mode overlay
- the header always contains the title, connectivity indicator, sync badge, and hamburger trigger
- Pocket Mode is a full-screen overlay, not a route change or separate page

#### 2d. Data-loading order

- `loadData()` resolves viewing context from `/api/users`
- online path fetches programs for the resolved patient
- history loads before the exercise list renders so adherence labels are correct on first paint
- after a successful online load, cache hydration runs in the background rather than blocking the interactive shell
- offline-only startup uses IndexedDB cache if available and shows explicit offline feedback

#### 2e. Picker and history rendering

- picker cards exclude archived exercises
- each card shows exercise name, dosage, adherence, optional category tag, and a dedicated details button
- adherence uses local-midnight day bucketing, with `Done today`, `N days ago`, warning colors, and `Never done`
- history cards show performed date/time, exercise name, set summary, first-set parameter summary, and optional inline notes preview
- both picker and history have explicit empty and failed states that must be preserved verbatim or near-verbatim

#### 2f. Logger entry and active session model

- tapping an exercise immediately creates `currentSession` with `sessionId`, exercise identity, derived `activityType`, empty `sets`, and a session timestamp
- sided exercises show side controls, default to right, and switch progress display into left/right mode
- bilateral exercises hide side controls and clear `currentSide` to `null`
- timer-capable exercises enter timer mode directly; rep-style exercises enter counter mode directly

#### 2g. Execution behavior

- counter mode uses a giant tap surface to increment visible reps, plus undo/decrement bounded at zero
- counter mode emits per-tap beep feedback and milestone speech for 5 left, 3 left, last rep, and set complete
- timer mode counts down from target, not up from zero
- hold exercises advance rep progress inside the timer without creating a completed set until the configured rep count is satisfied or manually logged
- duration exercises become a single timed set on confirmation
- timer reset clears live timer progress only; it does not remove previously accepted sets
- side switches update both the visible `Working [side] side` label and spoken announcement

#### 2h. Pocket Mode

- Pocket Mode can only open when an exercise session is already active
- counter Pocket Mode shows current count plus reps and sets left, with `Tap to count`
- timer Pocket Mode mirrors the live timer display, current rep, running or paused state, and sets left
- Pocket tap routes to counter increment for counter exercises and start/pause for timer exercises
- timer Pocket Mode supports a 700ms long press for partial hold logging; releasing early falls back to normal tap behavior
- closing Pocket Mode dismisses only the overlay and returns to the same logger session

#### 2i. Set acceptance flows

- `Next Set` summarizes the current live logger value against the target and can confirm or route to edit
- `Log Set` is manual entry and prefills from target dose, not from whatever the live counter currently shows
- form parameters use historical values, global values, and last-used values; `Other...` reveals a custom free-text input
- accepted sets are appended into `currentSession.sets`; live counter or timer state alone does not count as an accepted set
- `previous-set` removes the most recent accepted set, updates progress immediately, and errors when nothing can be undone

#### 2j. Session finalization

- `Done` is blocked until at least one set has been accepted
- after `Done`, notes and optional backdate are collected in the notes modal before save
- backdate defaults from session start time in local datetime format and shows a warning only when changed by more than two minutes
- cancelling from notes asks for confirmation before discarding the active session
- save is queue-first: the session is pushed into the offline queue and queue UI updates before sync is attempted
- after save, local history is updated immediately so picker adherence can show `Done today` without waiting for a refetch
- save returns the user to picker immediately and clears `currentSession` and `currentExercise`

#### 2k. Messages and history maintenance

- messages are tracker-owned shell behavior opened from hamburger actions
- opening messages closes the hamburger, yields one animation frame, opens the modal, loads messages, updates local `lastReadMessageTime`, best-effort marks received messages as read server-side, and clears the badge
- message recipient fallback depends on role and context: thread participant first, then therapist fallback for patient/admin-patient mode, or viewed patient for therapist mode
- messages preserve empty state, failed state, delivered/read receipt states, hide behavior, and undo-send confirmation
- history maintenance opens from a session card, populates a modal with date, notes, and set fields, allows add/delete set operations, and persists through PATCH or DELETE calls

#### 2l. Offline and recovery behavior

- offline startup can render from cache and announces `Offline mode`
- online load failure can fall back to cache and announces `Using cached data`
- the sync badge reflects unsynced queue length and connectivity state
- reconnect behavior syncs queue first, then refreshes full data only if the user is on picker; otherwise it only hydrates cache in the background
- sync treats `409` duplicate responses as success and removes those sessions from the queue
- old offline queue entries are migrated on load, including the special hold-session collapse path

#### 2m. Timing, invariants, and blocked states

- `Done today` is based on local calendar date via local-midnight truncation, not elapsed rolling 24 hours
- startup timing matters: authenticated bootstrap loads data before the first renderable tracker state, then checks messages immediately, then begins 30-second polling
- `currentSession` and `currentExercise` are cleared on explicit abandonment, notes discard confirmation, and successful save
- missing patient context, missing message recipient, zero-value manual entry, no sets to undo, failed exercise load, failed history load, and password mismatch are all explicit blocked or failure states that must remain visible in docs

### 3. How to use the remainder of this document

- sections `0da` through `0dc` are the proof that the source was harvested in order
- sections `0e` through `0j` are cross-cutting inventories used during rebuild and delta review
- sections `1` through `8` are supporting analysis and late-discovery risk notes

## Current Exploration Findings

The sections below are grouped into three jobs:

1. evidence that the static source was harvested in order
2. cross-cutting inventories an implementation agent needs while rebuilding
3. deeper analysis, invariants, and late-discovery risk notes

Read them in that order if you are rebuilding. Read them out of order only when you are looking up one specific rule.

## Source-Ordered Evidence

### 0. Static source map for the tracker shell

This should let a reviewer reconstruct the static tracker without logging into the app first.

| Static area | Static source anchor | Static behavior that should be explicit in the docs |
|---|---|---|
| Shell bootstrap and viewing context | `loadData()` in `public/index.html` | Resolves the signed-in user profile by `auth_id` or email, stores `currentUserProfileId` and `currentUserRole`, determines `viewingPatientId`, sets `therapistId`, syncs the email notification toggle, shows the therapist patient banner, and refuses to continue if no patient context can be resolved |
| Auth bootstrap and auth-state transitions | startup session check, `supabaseClient.auth.onAuthStateChange(...)`, auth modal helpers in `public/index.html` | Startup checks for an existing session, opens auth modal when absent, reacts differently to `PASSWORD_RECOVERY`, `SIGNED_IN`, and `SIGNED_OUT`, and re-runs tracker bootstrap plus message polling on sign-in |
| Tracker shell actions | hamburger setup inside `loadData()` in `public/index.html` | The tracker shell exposes tracker-owned actions for messages, manual sync, and debug; these are part of index behavior, not separate page behavior |
| Exercise selection and logger entry | `selectExercise()` in `public/index.html` | Exercise tap derives `activityType`, creates route-level `currentSession` with `sessionId`, `exerciseId`, `exerciseName`, empty `sets`, and a session timestamp, configures the logger, and transitions into logger view |
| Side-aware logging behavior | `selectExercise()`, `selectSide()`, `showLogSetModal()`, `showNextSetModal()` in `public/index.html` | Side selector is shown only for `pattern === 'side'`; sided exercises default to right, bilateral exercises set `currentSide = null`, and manual/next-set flows inherit the current side only when sided |
| Session finalization | `finishSession()`, `toggleBackdate()`, `saveSession()` in `public/index.html` | Finish blocks when no sets exist, notes modal opens after finish, backdate defaults from session start and can warn, save queues first then tries sync, local history updates immediately, picker view returns immediately, and success feedback includes note status |
| Execution mode behavior | `initTimerMode()`, `increaseCounter()`, `decreaseCounter()`, `toggleTimer()`, timer completion handlers in `public/index.html` | Counter mode increments locally with per-tap feedback and milestone announcements; timer mode owns start or pause, reset, countdown display, timed completion, and the transition from active timing into recorded set progress |
| Pocket Mode overlay | `togglePocketMode()`, `updatePocketOverlay()`, `handlePocketTap()`, `setupPocketLongPress()` in `public/index.html` | Pocket Mode is a full-screen logger companion entered from the active session, mirrors current session progress, changes tap behavior by exercise mode, supports timer-only long-press partial logging, and must be explicitly dismissed without leaving the session |
| Messages flow from index | `showMessagesModal()` and send-message helpers in `public/index.html` | Opening messages closes the hamburger first, yields a frame before opening the modal, loads messages, marks them read locally and server-side, hides the badge, and resolves recipients from thread context plus role-aware fallback |
| History and adherence | `loadHistory()`, `getDaysDiff()`, `getAdherenceInfo()` in `public/index.html` | History can be patient-scoped by `viewingPatientId`; adherence uses local-midnight day differences with fixed text and color buckets |
| History maintenance flow | `renderHistory()`, `openEditSessionModal()`, `saveEditSession()`, `deleteSession()` in `public/index.html` | History has a real empty state, opens an edit-session modal from each session card, allows full-session patching and deletion, and confirms destructive delete before removing a session |
| Offline and sync behavior | `loadData()` offline fallback, online listener, `syncOfflineQueue()` in `public/index.html` | Cached-data fallback, queue badge updates, duplicate-safe sync, sync-on-return-online, and post-sync history/cache refresh are all shell-visible behavior |
| View transitions and feedback | `showView()` and `showToast()` in `public/index.html` | The tracker is a three-view shell (`picker`, `logger`, `history`) and uses transient feedback to confirm blocked actions, mode changes, saves, cache fallback, and sync outcomes |

### 0d. Structured decomposition for a 5k-line source file

To make a file this large migration-safe, the docs should not rely on one long narrative. They should break the tracker into stable review units:

| Unit | What it answers | Why it reduces late discovery |
|---|---|---|
| shell surfaces | what the user can see in each view or modal | prevents missing controls and hidden ownership boundaries |
| state inventory | what state exists and what it means | prevents migration from preserving UI but mutating the wrong state |
| event/action inventory | what each user action does | prevents wrong ordering and missing side effects |
| API inventory | what calls happen, when, and why | prevents visually-correct rebuilds with wrong data flow |
| timing inventory | what is immediate, delayed, polled, or background | prevents bugs around `today`, syncing, read state, and timer flow |
| copy inventory | what text and labels are functionally important | prevents “close enough” rewrites that change user guidance |
| edge-case inventory | what failures and blocked states exist | prevents agents learning important behavior only in runtime QA |

This document should read more like a field manual than a code-review note.

### 0da. Source coverage ledger

To avoid "assuming coverage," the docs should track the actual contiguous source chunks that have been read from `index.html`.

Current source length in this checkout: `4590` lines.

| Lines | Source shape | What this chunk establishes |
|---|---|---|
| 1-260 | document head, root styles, auth shell styles, header styles | viewport disables zoom, PWA metadata, toast mechanics, auth-modal existence, sticky header shell, patient banner presence, connectivity and sync-badge styling |
| 261-520 | hamburger, side-tracking, picker-card, detail styles | hamburger is an injected side panel, side controls are first-class logger UI, exercise cards include top-right details action, detail modal has pills/lists and guidance sections |
| 521-780 | adherence tags, logger controls, counter and timer surfaces | logger always has a dedicated control row, counter uses giant tap circle plus undo, timer has separate info/display/target/start-reset composition |
| 781-1040 | history cards, generic modal primitives, nav tabs, dark-mode styles | history cards are tappable maintenance entry points, all modals share one overlay shell, only picker and history have nav tabs, dark mode is explicitly styled rather than delegated to browser defaults |
| 1041-1300 | Pocket Mode styles, auth markup, header markup, picker markup | Pocket Mode is a full-screen overlay with close button plus giant tap pad; auth has three distinct modal surfaces; header contains connectivity + sync + hamburger; picker starts with loading state |
| 1301-1560 | logger/history/modal markup, notes/messages/edit-session markup | exact logger composition, sided progress block, `Done` and `Pocket Mode` buttons, modal field ownership, messages composer/email toggle, edit-session structure, and Pocket overlay anchor after main script |
| 1561-1820 | global state, Supabase bootstrap, init/auth listeners | runtime state inventory, `/api/env` startup, offline-manager init, session check, `PASSWORD_RECOVERY` / `SIGNED_IN` / `SIGNED_OUT` handling, initial message polling start, queue load, event binding boot order |
| 1821-2080 | editor link propagation, `loadData()` role/context resolution | `pt_editor.html` token handoff, `/api/users` as blocking tracker bootstrap, role-specific viewing-patient rules, therapist banner display, hamburger menu action wiring, offline-only cache path, program transform, history-before-picker render |
| 2081-2340 | history/API helpers, dosage/adherence, picker/history renderers | `/api/logs` history fetch, authenticated fetch error contract, local-midnight `today` semantics, adherence buckets, archived-exercise filtering, exercise-card markup, history-card summary layout |
| 2341-2600 | exercise details modal, `selectExercise()`, set-progress logic | detail modal contents, `currentSession` creation at exercise tap, activity-type derivation, sided-vs-bilateral logger branching, logger mode selection, all-sets-complete speech trigger |
| 2601-2860 | target display, parameter history helpers, counter and timer core | target label rules, historical parameter reuse, per-tap beep and milestone speech, timer state model, hold-vs-duration initialization, countdown behavior, completion audio, hold rep advancement, duration completion semantics |
| 2861-3120 | audio helpers, Pocket Mode runtime, side selection | speech queue clearing, Pocket refresh cadence, tap routing, 700ms long-press partial logging, timer-only partial behavior, overlay cleanup, visible side-label update, spoken side switch |
| 3121-3380 | logger feedback, debug, log-set modal, next-set modal | set flash feedback timing, debug info surface, manual log-set target-prefill behavior, side-specific modal progress, parameter field rendering, next-set summary against target, side display in next-set modal |
| 3381-3640 | next-set confirm, previous-set, comparison speech, parameter value sourcing | accepted-set write path, timer reset after acceptance, undo behavior, delayed comparison speech, exercise-local and global parameter history, session-local last-used override |
| 3641-3900 | parameter collection, direct `change`, `saveLoggedSet()`, finish transition | `Other...` custom-input reveal, manual validation rules, hold manual-set special path, timer-mode rep accumulation before full set creation, `manual_log` flag semantics, finish gate into notes modal |
| 3901-4160 | notes/backdate, messages modal open/load/toggle/send | backdate defaults to session start in local time, 2-minute warning threshold, messages modal frame-yield after hamburger close, local + server read handling, thread-recipient inference, message empty/error states, email toggle PATCH semantics, recipient fallback rules |
| 4161-4420 | archive/delete messages, unread polling, edit-session open/render | hide vs undo-send semantics, unread badge uses `lastReadMessageTime`, edit-session modal population, sided detection from exercise or saved set data, empty-set copy, editable set fields are exercise-type sensitive |
| 4421-4590 | edit-session save/delete, session save, queue migration, sync, dispatcher | edit PATCH and delete DELETE flows, queue-first session save, immediate local-history prepend for `Done today`, old offline-queue migration rules, duplicate-safe sync, picker-only online refresh, delegated `pointerup` action graph, back-to-picker abandon semantics |

The expectation is not just "the doc mentions these domains." It should preserve enough of each reviewed chunk that an agent can reconstruct behavior without reopening the file.

### 0db. Top-down harvest rule

This spec should be maintained in contiguous source order, not by whichever feature area feels convenient at the moment.

- if a later chunk is documented before an earlier chunk, that gap should remain visibly marked rather than implied complete
- chunk notes should say what the source defines, not what the Next.js migration currently happens to do
- line ranges should be stable enough that a reviewer can re-open the file and verify the same band quickly
- the chunk ledger is part of the artifact, not scratch work
### 0dc. Harvesting rule for this spec

For a file this large, "documenting index.html" means harvesting the full source, not summarizing a subset.

Each harvested section should produce structured notes for:

- surfaces or markup it defines
- state it introduces or mutates
- user actions it handles
- API/auth interactions it triggers
- timing/ordering rules it establishes
- copy, labels, or hints that shape workflow
- edge cases, blocked states, and failure behavior

If a source section has not been harvested into those categories yet, it should be treated as uncovered rather than implicitly complete.

## Cross-Cutting Reconstruction Inventories

### 0e. Shell surface inventory

| Surface | User purpose | Must include |
|---|---|---|
| auth modal | sign in when unauthenticated | sign-in fields, auth gating, handoff into tracker load |
| forgot-password modal | request reset email | email entry and exit back to auth flow |
| new-password modal | finish password recovery | updated-password submission after recovery event |
| picker view | choose what to log | search, exercise cards, adherence summaries, shell actions, patient banner when applicable |
| logger view | run and record the current exercise | exercise identity, dosage, target, progress, mode controls, side controls when applicable, logger actions |
| history view | inspect and maintain saved sessions | session cards, empty state, edit entry |
| exercise-details modal | inspect exercise metadata | description, pattern, muscles, equipment, guidance, empty fallback |
| log-set modal | manually create a set | target-based defaults, form parameters, side picker when applicable, validation |
| next-set modal | confirm live logger output | summary against target, side summary when applicable, confirm or route to edit |
| notes modal | finalize a session | notes entry, optional backdate, cancel-with-confirmation, save |
| messages modal | tracker-owned PT messaging | message list, composer, email toggle, empty/failure states, archive/undo actions |
| edit-session modal | maintain an existing saved session | session date, notes, per-set editing, add/delete set, destructive delete |
| Pocket Mode overlay | eyes-free logger interaction | large tap zone, close control, mode-specific label/meta/hint |

### 0ea. Markup-level shell inventory

The docs should preserve the actual element-level composition of the shell, because rebuild agents need more than feature names:

| Surface | Static composition details that matter |
|---|---|
| header | title `PT Tracker`, connectivity indicator, sync badge, hamburger button |
| patient banner | hidden by default, shown only for therapist patient-view context, text starts `Viewing exercises for:` |
| nav tabs | exactly two top-level tabs: `Exercises` and `History` |
| picker view | search input with `Search exercises...` placeholder and exercise list container with loading state |
| logger view | header with exercise name and dosage, side-tracking block, one active execution surface at a time, progress block, three control buttons, `Done`, `Pocket Mode`, and back button |
| counter surface | counter label, large tappable display used as main increment surface, minus/undo button |
| timer surface | rep or duration info line, timer display, target label, start/pause button, reset button |
| log-set modal | title, primary numeric input, optional hold-time input, optional form-parameter block, optional side-selection block, cancel/save actions |
| next-set modal | title, summary block, optional parameter block, optional side display, cancel/edit/confirm actions |
| notes modal | notes textarea, backdate toggle button, conditional datetime picker and warning, cancel/save actions |
| messages modal | scrollable message list, composer textarea, email-notify checkbox row, cancel/send actions |
| edit-session modal | exercise info banner, datetime field, editable sets list, add-set button, notes textarea, delete-session button, cancel/save actions |
| Pocket Mode overlay | close button outside main tap zone, giant tap pad, label, meta, hint |

### 0eb. Auth-surface inventory

The auth surfaces are part of index reconstruction too, because startup behavior depends on them:

| Surface | Static composition details that matter |
|---|---|
| sign-in modal | titleless auth card with email input, password input, `Sign In` submit button, inline auth error area, and `Forgot password?` link |
| forgot-password modal | `Reset Password` title, explanatory sentence, email input, `Send Reset Link` button, inline error/success area, and `Back to sign in` link |
| new-password modal | `Set New Password` title, new-password input, confirm-password input, `Update Password` submit button, inline error area |

The docs should also preserve the submit-button progress states and inline responses:

- forgot-password submit changes button text to `Sending...` while pending
- successful password-reset request replaces the inline message with `Check your email for the reset link.`
- new-password submit changes button text to `Updating...` while pending
- successful password update closes the modal and shows `Password updated successfully!`
- mismatched password confirmation blocks submission with `Passwords do not match.`

### 0i. Copy inventory worth preserving verbatim or near-verbatim

These strings are behaviorally important because they tell the user what state the tracker is in or what to do next:

| Context | Static copy |
|---|---|
| picker empty state | `No active exercises.` |
| history empty state | `No history yet. Start logging exercises!` |
| no adherence | `Never done` |
| finish blocked | `Please log at least one set before finishing` |
| previous-set blocked | `No sets to undo` |
| offline cached startup | `Offline mode` |
| online API failure with cache fallback | `Using cached data` |
| failed exercise load | `Failed to load exercises. Check your connection.` |
| failed history load | `Failed to load history.` |
| messages empty state | `No messages yet. Send a message to your PT!` |
| messages failed load | `Failed to load messages` |
| sync empty queue | `Nothing to sync!` |
| connectivity loss | `Offline - changes will sync later` |
| manual hold midpoint | `Rep N complete` |
| save success | `Saved (with notes)` / `Saved (no notes)` |

### 0j. Event-binding model matters too

The docs should preserve that the tracker uses a central delegated interaction model for most controls:

- most user actions are routed through `data-action` dispatch
- pointer-safe interactions are preferred for iOS/PWA reliability
- checkbox `change` is used for the email-notification toggle instead of pointerup
- some shell actions are handled inside the hamburger module before they reach document-level dispatch

That interaction model is part of why the static tracker behaves consistently on touch devices.

### 0ja. Delegated action inventory

The static tracker’s `data-action` map is itself part of the rebuild contract. These actions should be explicitly documented so an agent can recreate the interaction graph:

| Action | Static target |
|---|---|
| `show-view` | nav tabs |
| `select-exercise` | exercise card |
| `showExerciseDetails` / `closeExerciseDetailsModal` | exercise details flow |
| `counter-tap`, `counter-decrease` | counter controls |
| `timer-start-pause`, `timer-reset` | timer controls |
| `previous-set` | logger undo control |
| `show-log-set-modal`, `close-log-set-modal`, `save-logged-set` | manual set flow |
| `show-next-set-modal`, `close-next-set-modal`, `edit-next-set`, `confirm-next-set` | next-set confirmation flow |
| `finish-session`, `close-notes-modal`, `toggle-backdate`, `cancel-session` | session finalization flow |
| `close-messages-modal`, `send-message`, `archive-message`, `undo-send-message` | messages flow |
| `select-side`, `log-set-select-side` | main logger and manual-modal side behavior |
| `edit-session`, `close-edit-session-modal`, `save-edit-session`, `delete-session`, `add-edit-session-set`, `delete-edit-session-set` | history maintenance flow |
| `toggle-pocket-mode`, `pocket-tap` | Pocket Mode overlay |

The hamburger-only actions are also behaviorally important even though they do not pass through the document-level dispatcher:

- `show-messages`
- `manual-sync`
- `show-debug`
- `toggle-hamburger`
- `sign-out`
- `reload`

### 0jb. Form-submit and direct-event inventory

Not every interaction comes through delegated `pointerup`. These direct bindings should be documented too:

| Event source | Static behavior |
|---|---|
| first body `pointerup` | unlocks audio once for later beeps/speech |
| auth form submit | calls sign-in and writes inline auth error on failure |
| forgot-password link click | swaps sign-in modal for forgot-password modal |
| back-to-login link click | closes forgot-password modal and reopens sign-in |
| forgot-password form submit | requests reset email and updates inline success/error plus pending button state |
| new-password form submit | validates confirm-password match, updates password, shows success toast |
| search input `input` | filters exercise cards live |
| notes form submit | calls final session save directly from modal |
| backdate input `change` | toggles warning visibility based on 2-minute delta from session start |
| document `change` for email checkbox | updates email notification preference |
| document `change` for form-parameter `Other...` select | reveals or hides custom free-text input |

### 0f. Core state inventory

| State | Meaning | Created/updated by | Cleared by |
|---|---|---|---|
| `currentUser` | authenticated Supabase user | startup session check, `SIGNED_IN` | `SIGNED_OUT` |
| `authToken` / `refreshToken` | auth credentials used for API calls and editor-link propagation | startup session check, `SIGNED_IN` | `SIGNED_OUT` |
| `currentUserRole` | resolved app role from `/api/users` | `loadData()` | `SIGNED_OUT` |
| `currentUserProfileId` | resolved profile id for the current signed-in person | `loadData()` | `SIGNED_OUT` |
| `viewingPatientId` | patient whose tracker data is being shown | `loadData()` role resolution | next `loadData()` reset or `SIGNED_OUT` |
| `therapistId` | fallback tracker-message recipient for patient/admin patient-mode | `loadData()` role resolution | next `loadData()` reset or `SIGNED_OUT` |
| `threadRecipientId` | current message-thread counterpart when known | message load/poll | `SIGNED_OUT` or later thread replacement |
| `currentExercise` | exercise currently being logged in logger view | `selectExercise()` | back to picker, notes cancel discard, successful save |
| `currentSession` | unsaved session being assembled for `currentExercise` | `selectExercise()` | back to picker, notes cancel discard, successful save |
| `currentSide` | active side in main logger for sided exercises | `selectExercise()`, `selectSide()` | bilateral selection path, logger exit |
| `logSetSelectedSide` | side chosen inside manual log-set modal | `showLogSetModal()`, `selectLogSetSide()` | modal close/new modal open |
| `allExercises` | rendered exercise list for current patient context | `loadData()` | replaced on reload |
| `allHistory` | loaded saved-session history for current patient context | `loadHistory()` | replaced on reload |
| `offlineQueue` | locally stored unsynced sessions | localStorage load/save, save flow, sync flow | cleared item-by-item by sync success/duplicate |
| `lastReadMessageTime` | local unread cutoff for tracker badge | message modal open | updated on each open |
| `timerState` | live timer-mode progress | timer init/start/pause/reset/completion | reset on new timer lifecycle or logger exit |

### 0g. User action inventory

| Action | Where it starts | Immediate effect | Deferred or follow-on effect |
|---|---|---|---|
| select exercise | picker card | creates `currentExercise` + `currentSession`, enters logger | may initialize counter or timer mode |
| switch side | logger side button | updates `currentSide`, label, speech | affects later modal defaults and set side |
| counter tap | logger or Pocket Mode | increments visible count | may trigger milestone speech |
| timer start/pause | logger or Pocket Mode | toggles live timer state | may trigger speech, countdown beeps, rep progression |
| reset timer | logger | clears live timer progress to target display | does not remove accepted sets |
| previous set | logger | pops last accepted set, updates progress, shows toast | none |
| open log set | logger | opens manual-entry modal with defaults | user may save a manual set into `currentSession` |
| open next set | logger | opens confirmation modal from live logger output | confirm writes set, edit routes to manual modal |
| finish session | logger | blocks or opens notes modal | save path may backdate and enqueue |
| save session | notes modal | writes to offline queue, updates UI immediately | attempts sync, refreshes history/cache |
| open messages | shell action | closes hamburger, yields frame, opens modal | loads messages, marks read, clears badge |
| manual sync | shell action | starts queue sync | may refresh history and cache |
| edit history session | history card | opens edit modal with populated session | save/delete mutate server then reload history |

### 0h. API inventory

| API | Method | Trigger | Purpose | User-visible effect |
|---|---|---|---|---|
| `/api/users` | GET | authenticated `loadData()` | resolve profile, role, patient context, email prefs | controls banner, data target, message recipient fallback |
| `/api/users` | PATCH | email notify toggle | save notification preference | success or failure toast, checkbox revert on failure |
| `/api/programs?patient_id=...` | GET | after role resolution | load exercise program and dosage | populates picker and logger targets |
| `/api/logs?include_all=true&limit=1000&patient_id=...` | GET | history load | load session history | populates history and adherence |
| `/api/logs` | POST | offline queue sync | persist saved sessions | sync success/failure feedback |
| `/api/logs?id=...` | PATCH | edit-session save | update existing saved session | `Session updated` toast + history reload |
| `/api/logs?id=...` | DELETE | delete saved session | remove existing saved session | `Session deleted` toast + history reload |
| `/api/logs?type=messages` | GET | message open or poll | load conversation and infer thread recipient | modal content and unread badge |
| `/api/logs?type=messages` | POST | send message | create outgoing message | message list refresh + send toast |
| `/api/logs?type=messages&id=...` | PATCH | mark read or archive | update message state | badge clear, hide behavior |
| `/api/logs?type=messages&id=...` | DELETE | undo send | delete outgoing message | message deleted toast + list refresh |

### 0c. Auth and API contract must be documented too

For a true rebuild spec, the docs need more than UI flow. They must also explain:

- which auth states the page responds to
- which APIs are called in each shell phase
- what local state is derived from those responses
- what UI is shown before, during, and after each call
- which calls are blocking, best-effort, background, or fire-and-forget

Without that, an agent could rebuild the page shape but still get the tracker behavior wrong.

### 0a. Review checklist for "docs-only" parity work

If `index.html` disappeared tomorrow, the OpenSpec should still let an agent answer all of these without opening the live app:

- user-visible flows:
  - picker, logger, timer path, counter path, manual set entry, next-set confirmation, notes/backdate, Pocket Mode, history maintenance, messages, offline fallback
- ordering rules:
  - what happens first, what is blocked, what exits to picker, what updates immediately, what waits for later sync
- role and viewing-context rules:
  - who the tracker is acting on, when the patient banner appears, how therapist/admin context changes data and messages
- state invariants:
  - what `currentSession` means, when it starts and ends, when `currentExercise` exists, when `currentSide` is `right`, `left`, or `null`, and what local collections mutate immediately
- timing semantics:
  - what `today` means, how recency buckets work, when timestamps are rewritten, when polling or sync happens, and what happens on online/offline transitions
- validation and blocked states:
  - empty history, never-done, no sets to undo, finish-with-zero-sets, missing patient context, missing recipient fallback, failed load states, cancel-without-save confirmation
- feedback contract:
  - which toasts, badges, labels, hints, and announcements are functionally meaningful
- hidden but behaviorally important rules:
  - frame-yield before messages, local read-state plus server mark-as-read, queue-first save, local history prepend after save, side inheritance into subflows, picker-only online refresh behavior
- static source anchors:
  - where each rule lives in `public/index.html`

### 0b. Reconstruction standard

If `public/index.html` were deleted, the docs should still let an implementation agent answer:

- what the tracker looks like at rest:
  - top shell, picker view, logger view, history view, patient banner, unread badge, sync badge, side controls, progress displays, Pocket Mode overlay
- what controls exist in each state:
  - main tap surfaces, modal buttons, back actions, finish action, manual sync, messages entry, history edit/delete, Pocket Mode close
- what text appears in major states:
  - empty states, blocked states, save toasts, offline toasts, message copy, Pocket Mode hints, side labels, progress labels
- what data each action mutates:
  - live counter or timer state, `currentSession`, local history, offline queue, local read state, badges
- what timing-sensitive effects happen:
  - countdown beeps, speech milestones, message polling, frame-yield before modal open, queue-first save, immediate picker refresh after save

If a reviewer still has to guess at any of those, the docs are not finished.

## Supporting Analysis And Risk Notes

### 1. Index behavior is larger than "logging"

The static `index.html` contains these major interaction domains:

- bootstrap/auth/offline initialization
- exercise list rendering and selection
- tracker execution surface selection
- timer and counter execution
- pocket mode
- manual log-set modal
- next-set confirmation modal
- history rendering and edit-session flow
- notes and backdate flow
- messages modal
- offline queue load, save, and sync
- feedback toasts and spoken progress cues

The current Next.js `pages/index.js` already composes several of these domains, but not all of them are yet visible in the route shell.

Current source-based coverage snapshot:

- Present in Next.js route shell:
  - auth gate
  - exercise picker
  - history tab and edit entry
  - timer panel
  - manual session logger modal
  - next-set confirmation modal
  - offline queue badge and manual sync action
- Not yet visible in Next.js index shell or not yet confirmed from source:
  - tracker-owned messages modal entry and modal flow
  - notes modal and backdate flow
  - tracker toasts and status messaging parity
  - spoken progress comparison and all-sets-complete announcements
  - side-switch announcement parity

This means the index spec must treat these as tracker subflows, not as optional polish.

### 1c. The doc needs a source-map, not just good prose

One reason parity gaps are being found late is that a reader can currently agree with the spec in the abstract without proving where each behavior lives in static source and where it should land in Next.js. The artifact should require explicit source mapping for high-risk subflows:

- static source reference
- intended Next.js counterpart files
- the user-visible behavior or invariant being preserved
- the failure signature if the behavior is missing

Without that mapping, the spec can still read correctly while leaving agents to rediscover basic routing and ownership questions by hand.

### 1a. The tracker shell is role-aware and changes who the page is "for"

The static tracker is not a generic personal dashboard. During bootstrap it resolves:

- the signed-in user role
- the profile id used for logging and messages
- the patient whose program and logs are being viewed
- the therapist recipient fallback for messages

That role resolution changes runtime behavior:

- patients view their own program and message their assigned therapist
- therapists view a patient's data and see a patient banner
- admins may behave like a patient when they have a therapist assignment, or otherwise fall back to a patient-viewing mode

This matters because parity is not only "what is visible on index", but also "whose tracker state is being operated on" and "who receives messages from index-owned flows".

### 1b. The tracker is a state machine with explicit UX checkpoints

The static `index.html` behaves more like a runtime state machine than a simple route:

```text
bootstrap/auth
-> tracker shell resolves viewing context
-> picker or history tab
-> exercise selected
-> logger view opens
-> execution path diverges:
   - counter path
   - timer path
   - pocket mode
   - manual log-set modal
   - next-set confirmation modal
-> session finalization:
   - finish session
   - notes
   - optional backdate
   - save / enqueue / sync
-> return to picker with refreshed adherence and history
```

The parity artifact should therefore capture:

- what state the user is in
- what actions are available from that state
- what transitions are blocked or allowed
- what feedback is shown when a transition succeeds or fails

### 1ba. Shell surfaces that must be reconstructable

The static tracker is a three-view shell plus modal and overlay subflows:

- picker view:
  - exercise search
  - exercise cards with adherence summary
  - tracker shell actions
  - role-sensitive patient context banner when applicable
- logger view:
  - exercise name
  - dosage summary
  - target dose display
  - sided or bilateral progress display
  - counter controls or timer controls depending on exercise type
  - actions for previous set, manual log set, next set confirmation, Pocket Mode, finish, and back to picker
- history view:
  - session cards with date, exercise name, set summary, optional form-parameter summary, optional notes preview
  - editable session maintenance from each card
- modals and overlays:
  - exercise details
  - log set
  - next set
  - notes/backdate
  - messages
  - edit session
  - Pocket Mode overlay

An implementation should be able to recreate those surfaces and their ownership boundaries from the docs.

### 1bb. Auth-state walkthrough must be reconstructable

The docs should preserve the static auth lifecycle:

1. Offline manager initializes first.
2. Connectivity listeners are registered before tracker interaction begins.
3. Startup checks `supabaseClient.auth.getSession()`.
4. If no session exists:
   - auth modal is shown
   - tracker does not load program or history data
   - editor-link auth state is cleared
5. If a session exists:
   - `currentUser`, `authToken`, and `refreshToken` are set
   - auth modal is hidden
   - editor-link auth state is updated
   - `loadData()` runs
   - message freshness check runs immediately
   - 30-second message polling is scheduled
6. `onAuthStateChange` then handles:
   - `PASSWORD_RECOVERY`: closes auth and forgot-password modals, opens new-password modal
   - `SIGNED_IN`: sets user/tokens, hides auth UI, reloads tracker data, checks messages
   - `SIGNED_OUT`: clears user, tokens, role/viewing context recipients, shows auth modal, refreshes editor-link state

### 1bc. API sequence must be reconstructable

The docs should preserve the main request sequence and what each call is for:

- `/api/users`
  - first blocking data call inside `loadData()`
  - used to resolve current user profile, role, `currentUserProfileId`, `viewingPatientId`, `therapistId`, and email-notification toggle state
- `/api/programs?patient_id=...`
  - blocking call after viewing context resolves
  - populates exercise list and dosage fields for the current patient context
- `/api/logs?include_all=true&limit=1000&patient_id=...`
  - called before rendering the exercise list so adherence can use history immediately
  - populates `allHistory`, history cards, and form-parameter history
- `window.offlineManager.hydrateCache(authToken, viewingPatientId)`
  - background cache hydration after fresh online load
  - also used on online return when not interrupting the current active view
- `/api/logs`
  - POST used by offline-queue sync to persist saved sessions
- `/api/logs?id=...`
  - PATCH and DELETE used by history maintenance
- `/api/logs?type=messages`
  - GET to load messages and to poll message freshness
  - POST to send a message
- `/api/logs?type=messages&id=...`
  - PATCH for mark-as-read and archive/hide
  - DELETE for undo send
- `/api/users` PATCH
  - used by email-notification toggle inside the messages flow

### 1bd. API timing classes should be named

Not every request behaves the same way, and the docs should preserve those differences:

- blocking startup calls:
  - session check
  - `/api/users`
  - `/api/programs?...`
  - history load before exercise render
- background or best-effort calls:
  - cache hydration after successful online load
  - server-side mark-as-read patch fan-out
- recurring calls:
  - message freshness poll every 30 seconds while signed in
- queue-driven deferred calls:
  - `/api/logs` POST from offline sync, possibly much later than the visible save

### 1e. The execution path itself needs to be reconstructable

An agent should be able to answer these runtime questions from docs alone:

- when exercise selection opens counter mode versus timer mode
- what the main tap does in each mode
- what reset does and does not clear
- when a completed timer run becomes a set
- when the user is sent into manual set entry instead of staying in the main logger
- when the user gets a next-set confirmation modal instead of silent progression
- how Pocket Mode mirrors and controls the same in-progress session

If the docs only say that timer, counter, Pocket Mode, manual entry, and next-set modals exist, that is not enough. The docs need to say how the user moves between them and what session state each one mutates.

### 1h. Canonical logger walkthrough

This is the minimum runtime narrative an agent should be able to reconstruct from the docs alone.

#### Reps exercise

1. User taps an exercise from the picker.
2. Tracker creates a fresh `currentSession`, enters logger view, and shows counter mode with `0`.
3. Main counter tap increments the visible value immediately and can emit beep or milestone speech.
4. User can:
   - keep counting on the main surface
   - open `Next Set` to confirm the visible counter value against the target
   - open `Log Set` to manually enter a set using target-based defaults instead of the live counter value
   - use `Previous Set` to remove the last saved set from the in-progress session
5. Confirming `Next Set` writes a new set into `currentSession`, resets the visible counter to `0`, updates progress, optionally announces comparison to the previous session, and flashes log feedback.
6. `Log Set` does the same, except the user can edit the values before the set is written.
7. `Finish Session` is blocked until at least one set exists.
8. Notes and optional backdate happen only after finish.
9. Saving enqueues first, updates local history immediately, returns to picker, and refreshes adherence immediately.

#### Hold exercise

1. User taps an exercise from the picker.
2. Tracker creates `currentSession`, enters logger view, and opens timer mode with a per-rep countdown and `Rep 1 of N`.
3. Starting the timer counts down from the target seconds, with countdown beeps near zero.
4. On countdown completion, static tracker pauses automatically.
5. If the hold set is still mid-set, static tracker advances the rep counter, resets the timer display back to the target duration, and announces milestone reps-left only at key thresholds.
6. A full set is not written to `currentSession` on each timed rep. The user is still progressing toward one completed set.
7. Manual `Log Set` for a hold exercise is different from timer progression:
   - it opens a modal with both reps and seconds inputs
   - it uses target reps and target seconds as defaults
   - saving can create a complete set directly without stepping through rep-by-rep countdown
8. Pocket Mode can mirror this same timer flow and also supports long-press partial logging.

#### Duration exercise

1. User taps an exercise from the picker.
2. Tracker opens timer mode labeled as a duration exercise instead of per-rep hold progress.
3. Start begins a single countdown from target time.
4. When the timer completes, static tracker treats the completed run as one rep with captured seconds for the later set record.
5. `Next Set` summarizes the elapsed seconds against the target seconds.
6. Manual `Log Set` uses `Seconds performed` and hides the extra hold-time input.

### 1i. Modal contracts should be explicit

The docs should preserve the actual difference between the two logger modals:

- `Next Set` is a confirmation modal for what the app just recorded from the live logger surface
- `Log Set` is a manual-entry modal that uses target-based defaults, not the current counter value
- `Next Set` summary shows current captured value against target
- `Next Set` can show current side for sided exercises
- `Next Set` offers cancel, edit, and confirm behavior; `Edit` routes into `Log Set`
- `Log Set` pre-fills required form parameters from last-used values and can scope those defaults by side
- `Log Set` side picker shows sided progress counts for left and right inside the modal
- both modals ultimately write into the same `currentSession`

### 1k. Session-writing rules should be explicit

The docs should preserve the exact distinction between "live progress" and "accepted set":

- changing the counter display does not itself create a set
- completing part of a hold countdown does not itself create a set
- `Next Set` confirmation writes an app-recorded set into `currentSession`
- `Log Set` writes a manual set into `currentSession`
- `Previous Set` removes only the most recently accepted set from `currentSession`
- `Finish Session` never creates a set; it only opens finalization
- `Save Session` persists the whole accumulated session, not a single set

### 1l. Form-parameter behavior is part of parity

Static tracker behavior around form parameters is richer than a plain text field:

- form parameters are rendered in both `Log Set` and `Next Set` flows when required by the exercise
- defaults come from last-used values, preferring current-session history first and prior saved history second
- historical choices are not exercise-static; they can draw from prior logged values so mutable parameter vocabularies keep working
- side-aware exercises can scope parameter defaults by side
- saved history cards summarize form parameters inline using the first set's normalized data
- edit-session maintenance exposes form parameters per set, not just session-wide notes

### 1j. The state model needs named invariants

The docs should call these out directly so agents do not have to infer them:

- `currentExercise` means the exercise currently being logged in the logger view
- `currentSession` means the unsaved session being assembled for that `currentExercise`
- `currentSession.sets` contains only sets the tracker has already accepted, not the live counter value or the currently running timer
- live counter state can diverge from saved sets until `Next Set` or `Log Set` writes a new set
- timer rep progress for hold exercises can diverge from saved sets until the set is completed or manually logged
- `currentSide` is only meaningful for sided exercises; bilateral exercises deliberately use `null`
- `logSetSelectedSide` is modal-local state that can temporarily differ from the main tracker side until the set is saved

### 1d. Static shell invariants should be written as facts

These are source-backed static behaviors that belong in the docs as concrete facts:

- exercise tap creates `currentSession` immediately, before any final save happens
- `currentSession` starts with an empty `sets` array and a session timestamp
- the logger is a dedicated shell view, not just a modal over the picker
- finish does not save directly; it opens the notes modal
- save always writes to the offline queue first, then attempts network sync
- local history is updated immediately after save so adherence changes right away
- tracker-owned messages are entered from shell actions, not by leaving the tracker route
- opening messages also updates local read time and triggers server-side mark-as-read
- therapist viewing context changes both the visible banner and the patient id used for programs, history, cache hydration, and message fallback
- side selector appears only for sided exercises; bilateral exercises deliberately clear side tracking instead of offering a “both” choice in the main tracker flow
- manual-entry and app-recorded next-set flows both inherit the active side when the exercise is sided
- backing out of logger to picker abandons the in-progress session instead of saving it
- cancelling from the notes modal asks for confirmation before discarding the session
- online return does not blindly interrupt an active logger flow; static index refreshes UI only when the picker is active and otherwise hydrates cache silently

### 1f. Logging execution rules should be stated behavior-first

From the static source, the main logger surface behaves like this:

- counter exercises open a rep counter with `0` showing immediately
- each counter tap increments the visible count right away
- counter decrement only works when the visible count is above zero
- timer exercises open timer mode immediately on selection
- Pocket Mode does not create a second session; it is an alternate control surface for the current logger session
- history editing is whole-session maintenance after save, not part of active logger progression

These are easy to miss if the docs stay implementation-shaped because the function boundaries make them look like separate helpers rather than one user flow.

### 1g. Pocket Mode needs its own contract

Pocket Mode is not just a stylistic overlay. In static `index.html` it is an alternate full-screen interaction surface with mode-specific behavior:

- it can only activate when an exercise session is already in progress
- entering it does not leave logger state; it mirrors the same `currentExercise` and `currentSession`
- timer mode changes the pocket label to the current timer display and changes the hint between start and pause behavior
- counter mode shows the current counter value, remaining reps, and the `Tap to count` hint
- the pocket overlay refreshes continuously while active so timer state stays visually synchronized
- the overlay has its own close affordance and does not implicitly finish or cancel the session
- timer exercises support a 700ms long press on the pocket pad to log a partial rep and advance, with a distinct confirmation beep
- short tap and long press are different behaviors; finger release before the long-press threshold falls back to the normal tap path

### 2. Sound and announcement behavior is likely a distinct parity domain

The static app appears to use different feedback rules for different execution modes rather than one universal rule:

- reps counter: per-tap beep plus milestone speech at 5, 3, 1, and set completion
- timer countdown: countdown beeps near zero and spoken start or pause only for longer timers
- hold timer: completion of each timed rep affects rep-left announcements
- side selection: static app includes a spoken side-switch announcement
- session progress: static app includes "All sets complete" and prior-session comparison announcements

The current Next.js tracker also has split feedback logic:

- `hooks/useTimerSpeech.js` handles counter-mode beeps and milestone speech
- `hooks/useExerciseTimer.js` handles countdown beeps and timer completion speech

This suggests the feedback rules should be governed as behavior, not left as implementation detail. The exact pattern of which exercise types announce what is still under investigation and should be treated as an explicit parity-capture task rather than guessed from one path.

### 3. Behavioral capture must stay separate from implementation structure

The code structure rules are still useful for implementation routing, but the parity artifact must describe runtime process first. Otherwise migration work will keep preserving code shape while missing user-visible timing and flow behavior.

### 4. UX feedback is part of functional parity, not visual garnish

The static tracker uses visible and audible feedback to tell the user what just happened and what to do next:

- adherence badges such as `Done today` and `X days ago`
- empty-state copy for exercises and history
- transient success or error toasts
- the brief log feedback flash after a set is recorded
- spoken progress cues such as side switch, rep countdown, set completion, and all-sets-complete

These feedback elements are part of the user workflow because they confirm whether logging advanced, whether work was saved, and whether the user should keep going or finish the session.

Some of these are concrete static copy/response patterns that deserve direct mention:

- empty history state: `No history yet. Start logging exercises!`
- no-adherence state: `Never done`
- blocked finish state: `Please log at least one set before finishing`
- undo-without-sets state: `No sets to undo`
- offline fallback states: `Offline mode` and `Using cached data`
- failed exercise load state: `Failed to load exercises. Check your connection.`
- failed history load state: `Failed to load history.`

### 4a. Hints, labels, and badges are also functional

For this tracker, not all important feedback is a toast. The docs should also preserve:

- Pocket Mode hints such as `Tap to count` and timer start or pause hints
- the patient banner that tells therapists whose tracker they are viewing
- unread message badge clearing when the messages modal opens
- sync badge changes when sessions are queued or cleared
- empty-state labels like `No sets logged` inside edit-session maintenance

### 4b. Message copy and maintenance copy matter too

The static tracker also uses concrete copy in supporting flows that should be preserved in docs:

- empty messages state: `No messages yet. Send a message to your PT!`
- failed messages load state: `Failed to load messages`
- sent-message read state begins as `Delivered` and can later become `Read ...`
- message actions include `Hide` and, when recent enough, `Undo Send`
- delete-message confirmation is explicit because it removes the message for both participants

### 4c. Progress copy should be reconstructable

The tracker also uses concrete progress wording that changes how the flow feels:

- side switch speaks and labels `Working left side` or `Working right side`
- hold timer uses `Rep X of N`
- duration timer uses `Duration Exercise`
- timer target label uses `Target: N seconds`
- sided next-set summary shows `Side: Left` or `Side: Right`
- next-set summary shows `logged value (target value)` in the current unit
- undo success toast identifies the removed set number
- hold-rep midpoint success toast uses `Rep N complete` when the set is not yet fully complete

### 5. The save model is session-oriented in static index

The static tracker keeps an in-progress `currentSession` at route scope. Sets are accumulated into that session first, then the user explicitly finishes the session, optionally adds notes and a backdate, and only then saves the session to the offline queue and local history.

That is a materially different mental model from a flow that treats each modal submission as the final persisted action. The parity artifact should therefore distinguish:

- in-progress session state
- per-set logging actions
- final session save behavior
- immediate local history and adherence refresh after save

### 6. Time semantics must be captured explicitly

The static tracker uses concrete time rules that should be written down rather than inferred:

- `Done today` is computed by comparing the current local date and the most recent `performed_at` after both are normalized to local midnight
- recency buckets are:
  - `0 days` -> `Done today`
  - `1-3 days` -> green `X day(s) ago`
  - `4-7 days` -> orange `X days ago`
  - `8+ days` -> red `X days ago`
- history cards render `performed_at` with `formatDateTimeWithZone(...)`
- a backdate defaults to the current session start time when the backdate UI is opened
- the backdate warning appears when the chosen date differs from the session start by more than two minutes
- when a backdate is applied, both the session date and each set's `performed_at` are rewritten to the chosen ISO timestamp

These rules are easy to lose in migration because they look like copy or display details, but they materially change:

- which exercises appear complete "today"
- which adherence color bucket is shown
- what timestamp the user later sees in history
- whether the session feels like it was logged when it happened or when it was entered

The static save order is also specific and should be documented in order:

1. trim and store notes
2. apply backdate if present
3. push the session into the offline queue
4. update sync badge
5. attempt immediate sync
6. prepend the saved session into local history
7. reset tracker state and return to picker
8. re-render the exercise list so `Done today` updates immediately
9. show `Saved (with notes)` or `Saved (no notes)` toast

### 7. The highest-risk late-discovery zones are now known

These are the places where the docs need the strongest scenario coverage because they have already shown a pattern of being noticed only after interactive walkthroughs:

- shell context resolution: who the tracker is operating on, whether a therapist banner appears, and whether data, cache, and message flows target the viewing patient or the signed-in auth user
- session finalization: the static tracker is session-oriented, so notes, backdate, save blocking, queueing, and local refresh must be described together rather than spread across separate paragraphs
- tracker-owned messaging: entry point, recipient fallback, and role-sensitive target selection must be captured from index itself, not assumed from `/pt-view`
- temporal semantics: local-midnight adherence, fixed recency buckets, and backdate timestamp rewriting must be written as rules, not examples
- user feedback: toasts, status copy, and spoken progress cues need enough detail that a reviewer can tell when the Next.js flow has become technically functional but behaviorally wrong

### 7a. Concrete static edge cases that should be named directly

If these are missing from the docs, agents will keep learning them late:

- `today` means local calendar day after both dates are normalized to midnight, not the last 24 elapsed hours
- therapists do not operate on their own tracker data on index; they operate on resolved patient context and see a patient banner
- admin behavior can split depending on whether an assigned therapist exists
- `finish session` with zero sets is an error flow, not a no-op
- side tracking exists only for sided exercises; bilateral tracking clears side instead of treating “both” as an explicit tracker-side value
- the history surface is editable and deletable from index itself, not just view-only
- backdate changes both the session date and each set timestamp, not just a display label
- messages from index are not generic; recipient fallback depends on thread context, therapist assignment, and role
- save feedback is immediate even if sync later fails, because queue and local history update before network success is known
- opening the messages modal includes a paint-separation step after closing the hamburger menu, which is part of the static UX contract
- going back to picker from logger clears the in-progress session immediately
- cancelling from the notes modal discards the in-progress session only after explicit confirmation
- offline return triggers a toast and sync-status update immediately, but full UI refresh is suppressed during active logging or history browsing
- failed server loads may still fall back to cache, but only when cached programs or logs exist for the resolved patient context
- history edit mode can show `No sets logged` even for an existing session shell if its set array is empty

### 8. Source review should happen before browser walkthroughs

Playwright is still valuable, but this design change is specifically trying to reduce how often runtime testing is the first time anyone notices a broken flow. The intended order is:

1. compare static source to the relevant Next.js files using the source-map in the spec
2. confirm that the documented states, transitions, and edge cases exist in code
3. use browser testing to validate the documented behavior, not to discover the behavior from scratch
