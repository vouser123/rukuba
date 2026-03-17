## ADDED Requirements

### Requirement: Tracker shell MUST preserve the top-level surface model
The static tracker shell SHALL preserve the same top-level surface model for migration planning: a header, a role-sensitive patient banner, exactly two nav-owned tabs, and a logger view that sits outside tab ownership.

#### Scenario: Agent reconstructs top-level tracker shell
- **WHEN** a migration agent rebuilds the tracker shell from the canonical artifacts
- **THEN** the shell MUST include a header with the title `PT Tracker`, connectivity indicator, sync badge, and hamburger trigger, a patient banner hidden by default whose text begins `Viewing exercises for:`, exactly two nav tabs named `Exercises` and `History`, and a three-view model where `logger` is separate from tab ownership

### Requirement: Auth surfaces MUST preserve static modal ownership and copy
The tracker SHALL preserve the same auth surface ownership, labels, and transitions as static `index.html`.

#### Scenario: User moves through auth surfaces
- **WHEN** the user signs in, opens forgot-password, returns to sign-in, or enters password recovery
- **THEN** the tracker MUST preserve distinct sign-in, forgot-password, and new-password modal surfaces, including the visible labels `Sign In`, `Forgot password?`, `Reset Password`, `Send Reset Link`, `Back to sign in`, `Set New Password`, and `Update Password`

### Requirement: Auth surface composition MUST preserve static field ownership
The tracker SHALL preserve the static composition of each auth surface, not just their existence.

#### Scenario: Agent reconstructs auth markup from the readable spec
- **WHEN** the sign-in, forgot-password, or new-password surface is rebuilt
- **THEN** sign-in MUST remain a titleless auth card with email input, password input, inline error area, submit button, and forgot-password link; forgot-password MUST keep its explanatory sentence plus inline success or error area; and new-password MUST keep both new-password and confirm-password inputs plus inline error handling

### Requirement: Direct auth events MUST preserve static flow switching
The tracker SHALL preserve the direct event paths that move users among auth surfaces.

#### Scenario: User interacts with auth links and submit flows
- **WHEN** the user submits sign-in, clicks forgot-password, returns to sign-in, or submits a password reset flow
- **THEN** the tracker MUST preserve the direct event split used by the static tracker: auth form submit for sign-in, forgot-password link click, back-to-login link click, forgot-password form submit, and new-password form submit, together with the same inline auth-error behavior on failed sign-in and inline success-or-error updates for reset flows

### Requirement: Auth shell MUST preserve static show-hide rules
The tracker SHALL preserve which auth surfaces are visible or hidden in signed-out, recovery, and signed-in states.

#### Scenario: Shell enters an auth-sensitive state
- **WHEN** no session exists, password recovery starts, or sign-in completes
- **THEN** the tracker MUST preserve the static rules for hiding the normal tracker shell behind auth surfaces, replacing normal sign-in with the reset-password surface during recovery, and restoring the tracker shell only after authenticated bootstrap begins

### Requirement: Auth flow MUST preserve pending, success, and blocked states
The tracker SHALL preserve the static auth flow's visible pending states, inline feedback, and blocking rules.

#### Scenario: Forgot-password and new-password forms are submitted
- **WHEN** the user submits reset or password-update forms
- **THEN** the tracker MUST preserve pending button states `Sending...` and `Updating...`, inline reset-success copy `Check your email for the reset link.`, inline mismatch copy `Passwords do not match.`, and success toast feedback for a completed password update

### Requirement: Password-update success copy MUST preserve static completion intent
The tracker SHALL preserve the explicit success-message intent used when password recovery finishes successfully.

#### Scenario: User successfully sets a new password
- **WHEN** the password-update flow completes successfully
- **THEN** the tracker MUST preserve the static success-toast wording `Password updated successfully!` rather than reducing password-recovery completion to a generic success state

### Requirement: Authenticated startup MUST preserve static order
Authenticated tracker bootstrap SHALL preserve the static startup ordering that determines what the user sees and when data becomes trustworthy.

#### Scenario: Existing auth session is present at startup
- **WHEN** the tracker boots with an existing authenticated session
- **THEN** it MUST initialize offline support, install connectivity listeners, inspect the auth session, set `currentUser`, `authToken`, and `refreshToken`, hide auth UI, update `pt_editor.html` auth propagation, run the authenticated bootstrap owner `loadData()`, restore offline queue state, perform the first message check, start 30-second polling, and only then bind interactive handlers in that order

### Requirement: Bootstrap prerequisites MUST preserve static env and queue setup
The tracker SHALL preserve the static startup prerequisites that happen before normal authenticated use can be trusted.

#### Scenario: Tracker initializes before or during auth bootstrap
- **WHEN** the tracker begins startup
- **THEN** it MUST preserve the static need to load runtime environment configuration from `/api/env`, initialize offline manager support, restore offline queue state, and delay global interaction-handler attachment until the authenticated bootstrap path has restored queue state and completed first-pass shell setup

### Requirement: No-session startup MUST preserve static data-loading block
The tracker SHALL preserve the static rule that unauthenticated startup does not proceed into normal tracker data bootstrap.

#### Scenario: Startup finds no authenticated session
- **WHEN** the session check returns no active session
- **THEN** the tracker MUST show auth UI, clear editor-link auth state, and avoid loading normal program or history data until authentication succeeds

### Requirement: Tracker shell MUST preserve the full static surface inventory
The tracker SHALL preserve the same major shell surfaces and overlays that static `index.html` owns.

#### Scenario: Agent reconstructs shell inventory from canonical docs
- **WHEN** a migration agent reads the shell contract
- **THEN** the tracker MUST be reconstructable as a header, patient banner, nav, picker, logger, history, auth modals, exercise-details modal, log-set modal, next-set modal, notes modal, messages modal, edit-session modal, and Pocket Mode overlay

### Requirement: Markup-level shell composition MUST preserve static element groupings
The tracker SHALL preserve the element-level shell groupings that shape the user’s mental model of each surface.

#### Scenario: Agent reconstructs visible shell composition
- **WHEN** the shell, picker, history, and modal surfaces are rebuilt from docs
- **THEN** the readable contract MUST preserve the grouped composition of the picker search-and-list area, logger header plus side-tracking block plus one active execution surface plus progress block plus control row plus `Done` and `Pocket Mode` actions, notes modal fields and backdate area, messages list plus composer plus email-toggle row, edit-session info banner plus editable sets plus notes plus destructive delete, and Pocket Mode close control outside the main tap zone

### Requirement: Shell state machine MUST preserve static UX checkpoints
The tracker SHALL preserve the static shell as a state machine with explicit user-visible checkpoints instead of an undifferentiated single-page surface.

#### Scenario: User moves through tracker shell states
- **WHEN** the user moves among signed-out auth, authenticated picker, active logger, history, modal overlays, and supporting shell flows
- **THEN** the canonical shell contract MUST preserve which surface owns the user at each step, what transitions are allowed from that state, and what visible context confirms the current state

### Requirement: Tracker shell parity MUST cover more than active logging
The shell parity contract SHALL preserve that static index behavior spans bootstrap, shell ownership, support flows, and feedback, not only the active exercise logger.

#### Scenario: Later conversation scopes tracker parity work
- **WHEN** a migration agent plans or reviews index-shell parity
- **THEN** the readable contract MUST treat bootstrap and auth, picker rendering, history rendering, messages flow, notes and backdate flow, offline queue behavior, and shell-level feedback as tracker subflows rather than optional polish around the logger

### Requirement: Auth state changes MUST drive distinct shell behavior
The tracker SHALL preserve the shell behavior attached to static auth state events.

#### Scenario: Supabase auth event fires
- **WHEN** the auth layer emits `PASSWORD_RECOVERY`, `SIGNED_IN`, or `SIGNED_OUT`
- **THEN** the shell MUST preserve the distinct static responses for each event, including which auth surfaces open or close, which runtime state is cleared, that `SIGNED_OUT` clears thread-recipient state along with user, token, role, profile, therapist, and viewing-context state, and whether authenticated tracker bootstrap restarts

### Requirement: Role and viewing context MUST be resolved before tracker data is trusted
The tracker SHALL resolve role, patient context, therapist fallback, and notification preference before treating exercise or history data as valid.

#### Scenario: Tracker begins authenticated bootstrap
- **WHEN** the tracker enters authenticated startup
- **THEN** it MUST call `/api/users` first, match the current user by auth id or email, set current profile and role state, determine `viewingPatientId`, determine therapist fallback, and sync the email-notification preference before continuing

### Requirement: Role-sensitive context MUST preserve static ownership rules
The tracker SHALL preserve the static meaning of patient, therapist, and admin tracker context.

#### Scenario: Role is resolved from `/api/users`
- **WHEN** the tracker identifies the signed-in role
- **THEN** patient mode MUST use self data with therapist fallback when assigned, therapist mode MUST resolve and use patient-viewing context plus show the patient banner, and admin mode MUST either behave like patient mode when therapist-linked or fall back to patient-viewing context

### Requirement: Tracker shell ownership MUST preserve “whose tracker this is” semantics
The shell SHALL preserve that index behavior is defined partly by whose data is being operated on, not just by what controls are visible.

#### Scenario: Later conversation reviews a role-aware shell flow
- **WHEN** a migration agent examines picker data, history data, message routing, or therapist-banner behavior
- **THEN** the shell contract MUST preserve the signed-in role, resolved profile identity, viewed patient identity, and therapist-recipient fallback semantics that make the page belong to a specific tracker context

### Requirement: Missing patient context MUST block normal bootstrap
The tracker SHALL not continue normal tracker startup when static ownership rules cannot establish a patient context.

#### Scenario: Patient context cannot be resolved
- **WHEN** `/api/users` succeeds but no valid patient context can be determined for the tracker
- **THEN** the tracker MUST block normal exercise and history bootstrap rather than continuing with ambiguous ownership

### Requirement: Data-loading MUST preserve static sequence before first picker render
The tracker SHALL preserve the static ordering of context resolution, programs load, history load, render steps, and background cache hydration.

#### Scenario: Online bootstrap loads tracker data
- **WHEN** authenticated tracker bootstrap runs in the online path
- **THEN** it MUST resolve role and patient context first, fetch programs second, transform exercises third, load history fourth, render history before picker cards, and only then hydrate offline cache in the background

### Requirement: API timing for shell bootstrap MUST preserve static call order
The tracker SHALL preserve the bootstrap API order that controls which data is available when.

#### Scenario: Tracker performs a successful authenticated online load
- **WHEN** the shell boots online
- **THEN** it MUST preserve the user-context-first call order of `/api/users`, then `/api/programs`, then `/api/logs`, and only after that perform background cache writes and ongoing message polling

### Requirement: Shell API timing classes MUST preserve static behavior
The tracker SHALL preserve the different timing classes that static `index.html` uses for startup, immediate follow-up, and background shell activity.

#### Scenario: Agent reconstructs when shell requests happen
- **WHEN** the migration contract describes shell-owned API calls
- **THEN** it MUST preserve that some requests are blocking startup prerequisites, some are immediate post-bootstrap follow-ups, some are recurring shell maintenance calls, and some happen only in deferred queue or cache workflows

### Requirement: Offline-first exceptions MUST preserve static fallback behavior
The tracker SHALL preserve the static differences between successful online load, offline cache fallback, and unrecoverable load failure.

#### Scenario: Network load fails during startup
- **WHEN** exercise and history data cannot be loaded from the network
- **THEN** the tracker MUST either render from cached data with explicit offline or cached-data feedback when suitable cache exists, or preserve explicit failed-load behavior instead of pretending tracker data was recovered

### Requirement: Picker shell MUST preserve card-level behavior and empty-state distinctions
The picker SHALL preserve the static search, filtering, card actions, and empty-state differences.

#### Scenario: Picker renders exercises
- **WHEN** the picker renders the current exercise list
- **THEN** it MUST preserve live search with `Search exercises...`, exclude archived exercises, show a dedicated details entry point on each card, distinguish `No active exercises.` from `No exercises found.`, and preserve visible adherence and dosage guidance on the cards

### Requirement: Picker cards MUST preserve static visible fields
The picker SHALL preserve the visible information hierarchy present on static exercise cards.

#### Scenario: Exercise card is rendered
- **WHEN** a picker card is shown for a non-archived exercise
- **THEN** the card MUST preserve exercise name, dosage formatting, adherence label, optional category tag, details affordance, and the card-level entry into active logging

### Requirement: Exercise-details flow MUST preserve static content sections
The tracker SHALL preserve the static exercise-details modal as a read-only supporting flow distinct from logging.

#### Scenario: User opens exercise details
- **WHEN** the user opens details from an exercise card
- **THEN** the tracker MUST open a read-only modal that can show description, pattern, muscles, equipment, cues, warnings, and safety flags, fall back to `No additional details available for this exercise.`, and return to the picker without mutating active logging state

### Requirement: History view MUST preserve preview information and maintenance entry
The tracker SHALL preserve the static history list as both a review surface and the entry point into session maintenance.

#### Scenario: History view renders saved sessions
- **WHEN** the history surface renders sessions
- **THEN** each history card MUST preserve performed date and time, exercise name, set summary, first-set parameter preview when present, optional notes preview, and the ability to open maintenance for that session

### Requirement: History view MUST preserve empty and failed states
The history surface SHALL preserve the visible copy and behavior for empty and failed history loads.

#### Scenario: History cannot show normal saved-session cards
- **WHEN** history is empty or load fails
- **THEN** the tracker MUST preserve explicit states such as `No history yet. Start logging exercises!` and `Failed to load history.` instead of showing a blank shell

### Requirement: Adherence rendering MUST preserve static recency semantics
The picker SHALL preserve the static adherence model and its visible outputs.

#### Scenario: Picker computes adherence status
- **WHEN** the tracker computes adherence for an exercise
- **THEN** it MUST preserve local-midnight day-difference semantics, visible outputs such as `Done today`, `Never done`, and `X days ago`, and the same recency bucket boundaries used by static `index.html`

### Requirement: Shell action ownership MUST preserve static dispatch boundaries
The tracker SHALL preserve which shell actions are handled by the hamburger layer versus the document-level action dispatcher.

#### Scenario: Shell action is triggered from tracker chrome
- **WHEN** the user triggers `show-messages`, `manual-sync`, `show-debug`, `toggle-hamburger`, `sign-out`, or `reload`
- **THEN** the migration contract MUST preserve that these are hamburger-owned shell actions rather than document-dispatched logger or picker actions

### Requirement: Delegated action dispatcher MUST preserve the static `pointerup` `data-action` map
The shell contract SHALL preserve the exact event-and-dispatch model used by the static document-level interaction graph.

#### Scenario: Later migration work reconstructs the main delegated interaction graph
- **WHEN** the canonical package describes how most tracker actions are dispatched
- **THEN** it MUST preserve that the central dispatcher is the delegated `data-action` map fired from document-level `pointerup`, not a generic click abstraction, while still naming the direct-event exceptions separately

### Requirement: Delegated shell actions MUST preserve static domain grouping
The tracker SHALL preserve the major delegated-action families used by static `index.html`.

#### Scenario: Agent reconstructs action routing from the readable spec
- **WHEN** the migration contract describes picker, logger, modal, history, and Pocket Mode interactions
- **THEN** it MUST preserve that actions are grouped into view switching, exercise selection and details, counter and timer execution, set-acceptance flows, finalization flows, messages flows, side selection flows, history maintenance flows, and Pocket Mode flows rather than flattening all controls into one undifferentiated event list

### Requirement: Shell copy and badges MUST preserve static functional guidance
The tracker SHALL preserve shell-level copy, badges, and labels when they help the user understand context or current state.

#### Scenario: Shell communicates context or status outside the logger
- **WHEN** the tracker shows patient context, unread state, sync state, adherence, or search results
- **THEN** the shell MUST preserve the functional guidance carried by the patient banner, unread badge, sync badge, search placeholder, adherence labels, and empty-state copy

### Requirement: History timestamp rendering MUST preserve static formatting intent
The history surface SHALL preserve the static rule that saved-session timestamps are rendered as formatted date-time values rather than raw database strings.

#### Scenario: History renders a saved session timestamp
- **WHEN** the history list shows `performed_at` for a saved session
- **THEN** the tracker MUST preserve the same user-facing formatted date-time intent used by the static tracker rather than exposing raw timestamp values, including the named `formatDateTimeWithZone(...)` formatting path

### Requirement: Picker shell MUST preserve static loading-state intent
The picker contract SHALL preserve that the exercise surface begins from an explicit loading state rather than an ambiguous blank shell.

#### Scenario: Picker is waiting for exercise data
- **WHEN** tracker data has not yet been resolved far enough to render the exercise list
- **THEN** the picker MUST preserve an explicit loading-state intent for the exercise list container rather than appearing empty or broken

### Requirement: Shell utility actions MUST preserve static intent
The tracker SHALL preserve the purpose of shell-level utility actions instead of collapsing them into generic menu buttons.

#### Scenario: User triggers a non-logging shell utility action
- **WHEN** the user uses hamburger-owned actions such as debug, reload, manual sync, or sign out
- **THEN** each action MUST preserve its distinct shell intent rather than being reduced to an unlabeled or behaviorally ambiguous placeholder

### Requirement: Debug surface intent MUST preserve static shell behavior
The shell contract SHALL preserve that the tracker exposes a debug-oriented shell action with its own diagnostic purpose.

#### Scenario: User opens shell debug behavior
- **WHEN** the user triggers the debug shell action
- **THEN** the migrated shell MUST preserve a distinct diagnostic/debug surface intent instead of silently dropping that capability from the tracker shell

### Requirement: Debug surface MUST preserve static info-surface ownership
The shell contract SHALL preserve that the debug action opens a tracker-owned debug information surface rather than a meaningless placeholder action.

#### Scenario: User activates the debug shell flow
- **WHEN** the user triggers `show-debug`
- **THEN** the tracker MUST preserve a distinct debug info surface owned by the shell, intended to expose current tracker diagnostic state, without turning the action into a route change, browser-level devtool shortcut, or meaningless placeholder that provides no tracker-visible diagnostic surface
- **AND** that surface MUST remain specific enough to show tracker-visible runtime context such as current auth or patient-context state, queue or connectivity state, and other tracker diagnostics the static shell exposes instead of collapsing the action into a token stub

### Requirement: Editor-link auth propagation MUST preserve static startup behavior
The shell SHALL preserve the static rule that tracker auth state is propagated to the linked editor surface during startup and auth changes.

#### Scenario: Authenticated or signed-out state updates the linked editor context
- **WHEN** startup or auth-state change updates tracker authentication state
- **THEN** the shell MUST preserve the corresponding editor-link auth propagation behavior for `pt_editor.html` instead of leaving that linked editor surface stale

### Requirement: Hamburger utility actions MUST preserve exact static shell semantics
The shell contract SHALL preserve what the static hamburger-only actions actually do, not just their names.

#### Scenario: User toggles or uses shell utility actions
- **WHEN** the user triggers `toggle-hamburger` or `reload`
- **THEN** `toggle-hamburger` MUST open or close the tracker menu without changing the current tracker view, and `reload` MUST rerun the current shell data-refresh path for the active tracker context rather than behaving like browser-level navigation or a generic placeholder

### Requirement: Shell state inventory MUST preserve named tracker context and collection state
The shell contract SHALL preserve the named state outside the active logger that determines what tracker data is shown and who it belongs to.

#### Scenario: Agent reconstructs non-logger tracker state
- **WHEN** a migration agent rebuilds shell-level tracker state
- **THEN** the readable contract MUST preserve the roles of `currentUser`, `authToken`, `refreshToken`, `currentUserRole`, `currentUserProfileId`, `viewingPatientId`, `therapistId`, `threadRecipientId`, `allExercises`, and `allHistory`, including that they are created or replaced during startup or reload rather than inferred ad hoc

### Requirement: Delegated action names MUST remain readable in the parity package
The shell contract SHALL preserve the concrete delegated action names that define the static interaction graph.

#### Scenario: Later conversation needs to cross-check action routing
- **WHEN** a migration agent compares static interaction wiring to a migrated shell
- **THEN** the readable contract MUST continue surfacing actions such as `show-view`, `select-exercise`, `showExerciseDetails`, `closeExerciseDetailsModal`, `counter-tap`, `counter-decrease`, `timer-start-pause`, `timer-reset`, `previous-set`, `show-log-set-modal`, `close-log-set-modal`, `save-logged-set`, `show-next-set-modal`, `close-next-set-modal`, `edit-next-set`, `confirm-next-set`, `finish-session`, `close-notes-modal`, `toggle-backdate`, `cancel-session`, `close-messages-modal`, `send-message`, `archive-message`, `undo-send-message`, `select-side`, `log-set-select-side`, `edit-session`, `close-edit-session-modal`, `save-edit-session`, `delete-session`, `add-edit-session-set`, `delete-edit-session-set`, `toggle-pocket-mode`, and `pocket-tap`

### Requirement: Hamburger-only action names MUST remain readable in the parity package
The shell contract SHALL preserve the concrete action names owned by the hamburger shell layer, not just their general purpose.

#### Scenario: Later conversation cross-checks hamburger behavior
- **WHEN** a migration agent compares the shell menu behavior to the static tracker
- **THEN** the readable contract MUST continue surfacing hamburger-owned actions such as `show-messages`, `manual-sync`, `show-debug`, `toggle-hamburger`, `sign-out`, and `reload` as a distinct shell-owned action group

### Requirement: Pointer-safe interaction model MUST preserve static PWA intent
The shell contract SHALL preserve that the tracker prefers pointer-safe interactions for touch and PWA reliability rather than assuming generic click handling is equivalent.

#### Scenario: Later migration work rebuilds interactive tracker controls
- **WHEN** the interaction model for shell and logger controls is reconstructed
- **THEN** the readable contract MUST preserve the pointer-safe interaction intent used by the static tracker, including the distinction between delegated `pointerup`-driven `data-action` actions and direct exceptions such as auth submit and click events plus `change`-driven exceptions such as the email-notification checkbox

### Requirement: Mobile and PWA shell posture MUST preserve static app-shell intent
The shell contract SHALL preserve that the static tracker was authored as a touch-safe PWA-style shell rather than as an unconstrained desktop-only document.

#### Scenario: Later migration work reconstructs the overall app shell
- **WHEN** the top-level tracker shell is rebuilt for web and installable use
- **THEN** the parity package MUST preserve the static mobile/PWA intent, including touch-safe interaction expectations and the no-surprise app-shell posture of the original document

### Requirement: Header shell MUST preserve static sticky-app intent
The shell contract SHALL preserve that the top header behaves like a persistent tracker app header rather than disposable page chrome.

#### Scenario: User navigates among picker, logger, and history
- **WHEN** the user remains inside the tracker shell across its major views
- **THEN** the header MUST preserve its persistent app-shell role, including title, connectivity state, sync state, and shell-menu entry without behaving like per-view incidental chrome

### Requirement: Shared modal-shell intent MUST preserve static ownership boundaries
The tracker SHALL preserve that supporting flows are owned by a shared modal or overlay system rather than ad hoc unrelated surfaces.

#### Scenario: User opens supporting tracker flows
- **WHEN** exercise details, log set, next set, notes, messages, or edit-session maintenance are opened
- **THEN** the migrated shell MUST preserve the shared modal or overlay ownership intent used by the static tracker so these flows still read as part of one app shell

### Requirement: Exercise-details entry affordance MUST preserve static card-placement intent
The picker SHALL preserve that exercise details are exposed as a dedicated secondary affordance on the exercise card rather than only through the main logging tap target.

#### Scenario: User wants details without starting logging
- **WHEN** the user is inspecting exercise cards from the picker
- **THEN** each card MUST preserve a dedicated details affordance separate from the main exercise-selection action, matching the static “details is not the same as start logging” intent

### Requirement: Visual theming intent MUST preserve explicit shell styling
The shell contract SHALL preserve that the static tracker intentionally styles its shell surfaces, tabs, modals, and dark-mode behavior rather than delegating appearance to browser defaults.

#### Scenario: Later migration work recreates the tracker look and feel
- **WHEN** the shell is rebuilt in Next.js
- **THEN** the parity package MUST preserve explicit shell styling for the auth shell, header, tabs, exercise cards, shared modal shell, badges, and alternate dark-mode behavior instead of treating those surfaces as generic framework defaults or leaving them to browser-native presentation

### Requirement: Shell layout MUST preserve static app-shell posture
The shell contract SHALL preserve the concrete layout obligations that make the tracker read as one touch-first app shell rather than as loosely arranged page sections.

#### Scenario: Later migration work reconstructs shell layout
- **WHEN** the shell, header, cards, modals, and overlays are rebuilt
- **THEN** the package MUST preserve the sticky top header posture, patient-banner placement under the main shell chrome, exactly two top-level tabs, exercise cards with top-right details affordance, shared modal overlay shell, and Pocket Mode as a full-screen overlay with its own close control instead of reducing these to generic layout freedom
- **AND** the package MUST preserve that dark mode is an explicitly styled alternate shell posture, not an incidental browser default

### Requirement: View switching MUST preserve single-shell tracker behavior
The shell contract SHALL preserve that picker, logger, and history are view changes inside one tracker shell rather than separate page navigations.

#### Scenario: User changes major tracker views
- **WHEN** the user moves between `Exercises`, `History`, and active logging
- **THEN** the migrated tracker MUST preserve the single-shell view-switching behavior of the static app instead of turning those transitions into unrelated page-level flows

### Requirement: Mobile viewport posture MUST preserve static no-surprise interaction intent
The shell contract SHALL preserve that the original tracker was authored to behave like a controlled mobile web app shell instead of a zoom-heavy generic document.

#### Scenario: Tracker is used on touch-first mobile devices
- **WHEN** the top-level shell is rebuilt for mobile and PWA use
- **THEN** the parity package MUST preserve the static intent around touch-first viewport behavior, reduced surprise zoom behavior, and app-like interaction posture, including the document-level expectation that the tracker is not authored as a zoom-heavy generic page

### Requirement: Head-level app-shell metadata MUST preserve static PWA intent
The shell contract SHALL preserve the head-level metadata choices that make the tracker behave like a touch-first installed web app rather than a generic document.

#### Scenario: Later migration work reconstructs shell metadata and viewport behavior
- **WHEN** the top-level tracker shell is rebuilt for browser and PWA use
- **THEN** the canonical package MUST preserve that the original document head establishes a PWA-style app shell with explicit mobile viewport control, including viewport behavior that suppresses surprise zooming, mobile-web-app style posture, and toast-capable root shell behavior rather than treating those concerns as optional browser defaults or leaving them implicit
- **AND** Beads or implementation work derived from this requirement MUST be able to name head or root-shell obligations concretely instead of collapsing them into a generic “metadata” placeholder

### Requirement: Shell API contract MUST preserve static startup and history endpoint signatures
The shell contract SHALL keep the exact startup and history request surfaces readable to later migration work.

#### Scenario: Later migration planning maps shell API work
- **WHEN** a later conversation turns shell parity into implementation or Beads work
- **THEN** the canonical shell package MUST continue surfacing `GET /api/env`, `GET /api/users`, `GET /api/programs?patient_id=...`, and `GET /api/logs?include_all=true&limit=1000&patient_id=...` as the baseline startup and history request signatures, along with their blocking-order meaning

### Requirement: Auth-state clearing MUST preserve exact shell state targets
The shell contract SHALL preserve the exact runtime fields cleared by unauthenticated and signed-out transitions.

#### Scenario: Tracker loses authenticated state
- **WHEN** startup finds no session or auth later emits `SIGNED_OUT`
- **THEN** the canonical package MUST preserve that editor-link auth is cleared on no-session startup and that signed-out handling clears `currentUser`, `authToken`, `refreshToken`, `currentUserRole`, `currentUserProfileId`, `therapistId`, `viewingPatientId`, and `threadRecipientId`

### Requirement: Bootstrap ordering MUST preserve hamburger and interaction binding placement
The shell contract SHALL preserve where global interaction wiring happens relative to authenticated data bootstrap.

#### Scenario: Later migration work rebuilds startup sequencing
- **WHEN** the startup order is translated into Next.js work
- **THEN** the package MUST preserve that interactive handler and menu wiring happen after the authenticated bootstrap path has established state, queue visibility, and first-pass data rather than being treated as a totally separate early concern

### Requirement: Adherence presentation MUST preserve exact bucket colors and formatter naming
The shell contract SHALL preserve the exact presentation details used by static adherence and history timestamps when those details change visible parity.

#### Scenario: Tracker renders picker adherence and history timestamps
- **WHEN** the shell shows `Done today`, `Never done`, or day-ago history and renders `performed_at`
- **THEN** the canonical package MUST preserve the static color buckets `1-3 days` green, `4-7 days` orange warning, and `8+ days` red warning, and MUST keep the named history formatting path `formatDateTimeWithZone(...)` visible in the readable contract

### Requirement: History and shell-feedback source anchors MUST remain visible for verification
The shell contract SHALL preserve the key static helper names that own history loading, adherence computation, view switching, and toast feedback.

#### Scenario: Later parity review cross-checks shell ownership against static source
- **WHEN** a later conversation needs to trace history, adherence, view, or feedback behavior back to the static source
- **THEN** the canonical package MUST keep the source-anchor names `loadHistory()`, `getDaysDiff()`, `getAdherenceInfo()`, `showView()`, and `showToast()` visible as verification anchors rather than reducing those behaviors to unnamed intent only

### Requirement: Picker search MUST preserve static live-input behavior and distinct empty conditions
The picker contract SHALL preserve that search filtering is immediate and that the two empty states are not the same condition.

#### Scenario: User types into exercise search
- **WHEN** the user types into the picker search field with placeholder `Search exercises...`
- **THEN** the tracker MUST preserve the static live `input` event behavior that filters cards immediately and MUST keep `No active exercises.` distinct from `No exercises found.` rather than collapsing them into one generic empty result
