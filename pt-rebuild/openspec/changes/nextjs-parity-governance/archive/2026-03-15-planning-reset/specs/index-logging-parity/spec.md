Purpose: capture the static tracker index as a reconstruction-grade contract so an agent could rebuild `index.html` to look and behave identically even if the original source were unavailable.

## ADDED Requirements

### Requirement: Index parity docs must prove full-source coverage in top-down chunks
The tracker index parity contract SHALL show that `public/index.html` was harvested as contiguous source chunks, with explicit coverage notes for what each chunk establishes, so reviewers are not forced to trust sampled summaries or reopen the static file to learn whether an area was covered.

#### Scenario: Coverage is anchored to the real source file length
- **WHEN** an agent reviews the parity artifact as the baseline for migration delta work
- **THEN** the contract records the current `public/index.html` line count and tracks contiguous chunk ranges against that real source length instead of using rough estimates

#### Scenario: Earlier chunks cannot be silently skipped
- **WHEN** a later chunk has been harvested into the parity docs
- **THEN** the contract either shows the earlier contiguous chunks as already covered or marks them uncovered, rather than implying full coverage from a topic summary

#### Scenario: Chunk notes describe behavior, not implementation guesses
- **WHEN** the parity contract summarizes a source chunk
- **THEN** it records the user-visible shell structure, state changes, API timing, copy, and ordering rules that the chunk establishes instead of centering the summary on which future Next.js file might own that behavior

### Requirement: Index parity specs must map high-risk flows to static source behavior
The tracker index parity contract SHALL identify where each high-risk subflow lives in static `index.html` and what user-visible behavior it establishes, so reviewers can compare migrated code against the documented static behavior before relying on browser walkthroughs.

#### Scenario: Source review can trace a risky flow end to end
- **WHEN** an agent reviews a risky tracker behavior such as shell context resolution, session finalization, tracker-owned messaging, offline startup, or adherence timing
- **THEN** the parity artifact identifies where that behavior lives in `public/index.html` and what observable behavior or ordering rule the static source establishes

#### Scenario: Missing counterpart is visible early
- **WHEN** a parity artifact cannot describe the migrated equivalent of a documented static behavior
- **THEN** that gap is treated as an early parity risk instead of waiting for runtime testing to reveal it

### Requirement: Index parity docs must be sufficient to rebuild the static tracker shell
The tracker index parity contract SHALL describe the shell surfaces, user-visible controls, modal sequence, copy, ordering rules, and state transitions completely enough that an implementation agent could recreate the static tracker without direct access to `public/index.html`.

#### Scenario: Agent can rebuild shell surfaces from docs alone
- **WHEN** an implementation agent only has the OpenSpec artifacts and not the original static source
- **THEN** the parity contract provides enough information to recreate the picker, logger, history, modal, badge, banner, and Pocket Mode surfaces and their user-visible behavior

#### Scenario: Agent can rebuild important copy from docs alone
- **WHEN** an implementation agent recreates blocked states, empty states, save flows, and supporting modals from the parity contract
- **THEN** the parity contract provides the important user-visible copy and labels that materially affect workflow instead of leaving them as unspecified placeholders

#### Scenario: Agent can rebuild the top-level shell composition from docs alone
- **WHEN** an implementation agent reconstructs the static shell chrome
- **THEN** the parity contract makes explicit that the shell contains a header with title, connectivity indicator, sync badge, and hamburger trigger, a patient banner that is hidden by default, exactly two nav tabs (`Exercises` and `History`), and a three-view model where `logger` sits outside tab ownership

#### Scenario: Agent can rebuild modal ownership from docs alone
- **WHEN** an implementation agent reconstructs index-owned modal and overlay flows
- **THEN** the parity contract makes explicit which flows are separate surfaces rather than generic dialogs, including sign in, forgot password, new password, exercise details, log set, next set, notes, messages, edit session, and Pocket Mode overlay

#### Scenario: Agent can rebuild search and card-level shell behavior from docs alone
- **WHEN** an implementation agent reconstructs the picker shell
- **THEN** the parity contract makes explicit that the picker includes live search, card-level details access, archived-exercise filtering, and explicit empty-state differences between "no active exercises" and "no search results"

### Requirement: Index parity docs must include the auth and API interaction contract
The tracker index parity contract SHALL describe the auth-state transitions, startup sequence, recurring calls, and major API request timings that make the static shell function, so a rebuild preserves not only the same UI but also the same data-loading and state-transition behavior.

#### Scenario: Startup session flow is reconstructable from docs
- **WHEN** an implementation agent rebuilds tracker startup from the parity contract
- **THEN** the contract specifies that static index initializes offline support, checks for an existing auth session, opens auth UI when absent, and on session presence sets user and token state before loading tracker data and starting message freshness checks

#### Scenario: Auth-state events drive different shell behavior
- **WHEN** the auth layer emits `PASSWORD_RECOVERY`, `SIGNED_IN`, or `SIGNED_OUT`
- **THEN** the parity contract records the distinct shell response for each event, including which auth modals open or close, which runtime state is cleared or repopulated, and whether tracker data reloads

#### Scenario: Role resolution call is a blocking part of tracker bootstrap
- **WHEN** the tracker begins authenticated startup
- **THEN** the parity contract records that static index calls `/api/users` first to resolve the current profile, role, patient context, therapist fallback, and email-notification preference before program and history loading can proceed

#### Scenario: History load happens before exercise render for adherence
- **WHEN** the tracker has resolved the viewing patient and fetched programs
- **THEN** the parity contract records that static index loads history before rendering the exercise list so adherence state is correct on first picker render

#### Scenario: Message freshness polling is part of signed-in shell behavior
- **WHEN** the user is signed in
- **THEN** the parity contract records that static index checks messages immediately and then polls every 30 seconds, updating the unread badge from that recurring call cadence

#### Scenario: Auth forms preserve inline and pending-state behavior
- **WHEN** the user signs in, requests a reset email, or submits a new password
- **THEN** the parity contract records the inline error or success regions, pending button-text changes such as `Sending...` and `Updating...`, and the successful password-update toast because those states are part of the lived auth flow

#### Scenario: Auth modal copy and transitions stay explicit
- **WHEN** an implementation agent rebuilds the auth shell from the parity contract
- **THEN** the contract preserves the static labels and transitions for `Sign In`, `Forgot password?`, `Reset Password`, `Enter your email and we'll send you a reset link.`, `Send Reset Link`, `Back to sign in`, `Set New Password`, and `Update Password`, including the fact that forgot-password hides sign-in first and `Back to sign in` reopens it

#### Scenario: Password reset success and mismatch remain inline behaviors
- **WHEN** the user requests a reset email or submits mismatched new-password fields
- **THEN** the parity contract records that static index shows inline `Check your email for the reset link.` on reset success and inline `Passwords do not match.` on mismatch before any password-update call is made

#### Scenario: Authenticated startup order is preserved
- **WHEN** the tracker boots with an existing auth session
- **THEN** the parity contract records the startup order used by static index: offline-manager init, connectivity listener setup, auth session check, authenticated state assignment, auth-surface hide, editor-link update, tracker data bootstrap, first message check, recurring polling, offline-queue load, and event binding

#### Scenario: Data-load order is preserved before first picker render
- **WHEN** authenticated tracker bootstrap loads patient data
- **THEN** the parity contract records that static index resolves role and patient context first, fetches programs second, loads history third, renders history before picker cards, and only then hydrates offline cache in the background

### Requirement: Index parity must be governed by user interaction flow
The tracker index parity contract SHALL describe the user-visible interaction process of the original app, including what happens when the user selects an exercise, what screen or modal opens next, what actions are available from that state, what defaults are shown, and what is saved when the user confirms a step.

#### Scenario: Exercise selection opens the logging flow
- **WHEN** the user selects an exercise from the tracker list
- **THEN** the parity contract defines which execution surface opens first and what follow-up actions are available from that surface

#### Scenario: Exercise selection creates an in-progress session immediately
- **WHEN** the user selects an exercise from the tracker list
- **THEN** the parity contract records that static `index.html` creates a route-level `currentSession` right away with a session id, exercise identity, derived activity type, empty `sets`, and an initial session timestamp before any final save occurs

#### Scenario: Logging steps are ordered explicitly
- **WHEN** the user moves through timer, counter, manual entry, next-set confirmation, or edit flows
- **THEN** the parity contract records the order of those interactions so migration work is judged against runtime behavior rather than memory

#### Scenario: Manual-entry and next-set paths remain distinct
- **WHEN** the user is already inside the logger flow
- **THEN** the parity contract records the separate behavior of manual log-set entry versus app-recorded next-set confirmation, rather than collapsing both into a single generic “log set” step

#### Scenario: Shell views and modal ownership are explicit
- **WHEN** an implementation agent reads the parity contract
- **THEN** the contract makes clear which interactions belong to picker view, logger view, history view, a modal flow, or the Pocket Mode overlay so the rebuilt tracker preserves the same navigation model

#### Scenario: Direct-bound form and input events are preserved
- **WHEN** an implementation agent reconstructs the tracker interaction model
- **THEN** the parity contract records not only delegated `data-action` interactions but also direct form-submit, input, and change handlers whose timing affects auth, search, notes save, backdate warnings, parameter custom-entry, and email-notification behavior

#### Scenario: Hamburger-owned actions stay outside the document dispatcher
- **WHEN** an implementation agent reconstructs shell action handling
- **THEN** the parity contract records that `show-messages`, `manual-sync`, `show-debug`, `toggle-hamburger`, `sign-out`, and `reload` are owned by hamburger-menu handlers and do not travel through the document-level `data-action` dispatcher

### Requirement: Index parity must cover major subflows as separate behavioral domains
The tracker index parity contract SHALL capture the main tracker experience as coordinated subflows, including exercise browsing and selection, timer or counter execution, manual log-set entry, next-set confirmation, history filtering and editing, offline queue behavior, notes and backdate handling, tracker-owned messages access, and user feedback behaviors such as toasts or spoken progress cues when those originate from the index surface.

#### Scenario: Subflow belongs to index process
- **WHEN** a behavior originates from the tracker page and changes what the user can do next
- **THEN** it is treated as part of the index parity surface and captured in the appropriate index behavioral domain

#### Scenario: Cross-cutting concern is linked rather than hidden
- **WHEN** a tracker behavior depends on a cross-cutting rule such as offline handling, role rules, or message semantics
- **THEN** the index parity contract references that rule explicitly instead of assuming an agent will infer it from code structure alone

#### Scenario: Pocket Mode is treated as a first-class index subflow
- **WHEN** the static tracker exposes Pocket Mode from an active logger session
- **THEN** the parity contract records Pocket Mode as its own index subflow with entry, exit, tap behavior, long-press behavior, display rules, and relationship to the same in-progress session rather than treating it as optional visual garnish

#### Scenario: Supporting modals stay behaviorally distinct
- **WHEN** the tracker uses exercise details, log set, next set, notes, messages, or edit-session modals
- **THEN** the parity contract records what each modal is for, what it shows, and what returning or confirming from that modal does to tracker state

#### Scenario: Exercise-details flow stays behaviorally distinct from logging
- **WHEN** the user opens exercise details from an exercise card
- **THEN** the parity contract records that static index opens a read-only details modal rather than starting logging, and that closing the details modal returns the user to the picker without mutating `currentSession`

#### Scenario: Exercise-details content is reconstructable from docs alone
- **WHEN** the user opens exercise details for an exercise
- **THEN** the parity contract records that static index can show `Description`, a `Pattern` pill with sided-versus-bilateral wording, `Primary Muscles`, `Secondary Muscles`, `Equipment Required`, `Optional Equipment`, `External Cues`, `Motor Cues`, `Compensation Warnings`, and `Safety Flags`, and falls back to `No additional details available for this exercise.` when none of those sections exist

### Requirement: Index parity must capture tracker shell context and role-sensitive behavior
The tracker index parity contract SHALL describe how the static page resolves user role, viewing context, and message target context before the user starts logging, because those decisions affect what the tracker shows, whose data is being edited, and who receives index-owned messages.

#### Scenario: Therapist index is patient-scoped
- **WHEN** a therapist opens the tracker index
- **THEN** the parity contract records that the page resolves a patient to view, shows a patient banner, and uses that patient context for exercise, history, offline cache, and messaging behavior

#### Scenario: Shell data loads use viewing-patient context
- **WHEN** the tracker shell has resolved a `viewingPatientId`
- **THEN** the parity contract records that static index uses that patient context for programs, history loading, cache hydration, and therapist-side message fallback rather than assuming the signed-in auth user is the data target

#### Scenario: Admin index may resolve to patient mode or patient-viewing mode
- **WHEN** an admin opens the tracker index
- **THEN** the parity contract records how the static page decides whether the admin behaves like a patient with an assigned therapist or falls back to viewing a patient context, because that decision changes program loading, logging ownership, and message recipient fallback

#### Scenario: Patient and therapist message targets differ
- **WHEN** the user sends a message from index-owned tracker flow
- **THEN** the parity contract records how the recipient is chosen for patient and therapist roles so a migration does not preserve UI while changing who the conversation targets

#### Scenario: Role context affects navigation affordances
- **WHEN** the tracker shell resolves the signed-in role and viewing context
- **THEN** the parity contract records any resulting navigation affordances or restrictions that depend on that resolution, including whether admin-only links are shown and whether the tracker shell exposes role-specific context such as the patient banner

#### Scenario: Missing patient context blocks authenticated tracker startup
- **WHEN** auth succeeds but the tracker cannot resolve a patient context from the `/api/users` result
- **THEN** the parity contract records that static index does not continue normal tracker bootstrap with ambiguous ownership

### Requirement: Index parity must capture side-specific behavior as user-visible flow
The tracker index parity contract SHALL describe side behavior as the user experiences it, including when side controls appear, what default side is chosen, and how side values carry into manual and app-recorded logging flows.

#### Scenario: Side controls exist only for sided exercises
- **WHEN** the selected exercise uses `pattern === 'side'`
- **THEN** the parity contract records that the tracker shows side controls and defaults the active side to right

#### Scenario: Bilateral exercises clear side tracking
- **WHEN** the selected exercise is bilateral rather than sided
- **THEN** the parity contract records that the tracker hides side controls and clears side tracking instead of treating “both” as an explicit tracker-side value

#### Scenario: Active side carries into logging subflows
- **WHEN** the user opens manual log-set entry or next-set confirmation for a sided exercise
- **THEN** the parity contract records that those flows inherit the active tracker side rather than resetting to an unrelated default

#### Scenario: Side switch updates both label and announcement
- **WHEN** the user switches sides on the main logger surface
- **THEN** the parity contract records that static index updates the visible "Working [side] side" label and announces the same side change audibly

### Requirement: Index parity must model the logging flow as an in-progress session
The tracker index parity contract SHALL record that the static tracker accumulates work inside an in-progress session before final save, including how sets are added, how finish is blocked until at least one set exists, how notes and optional backdate are collected, and when the session is finally saved and reflected in local history.

#### Scenario: Finish requires at least one logged set
- **WHEN** the user tries to finish a session before any set has been recorded
- **THEN** the parity contract records that the tracker blocks the transition and shows an error state instead of saving or returning to the picker

#### Scenario: Notes and backdate occur after set logging but before final save
- **WHEN** the user finishes a session with at least one set logged
- **THEN** the parity contract records that notes and optional backdate are collected after logging and before the session is saved, queued, and reflected back into history and adherence state

#### Scenario: Save updates tracker state immediately
- **WHEN** a session is successfully saved or queued from the tracker
- **THEN** the parity contract records that the user returns to the picker flow with local history, adherence, and session state refreshed immediately rather than waiting for a later full reload

#### Scenario: Save is queue-first even when online
- **WHEN** the user saves a session from the tracker
- **THEN** the parity contract records that static index pushes the session into the offline queue first, updates queue UI, and only then attempts immediate network sync, so the user-visible save model is queue-first rather than network-first

#### Scenario: Undo is a visible session-progress behavior
- **WHEN** the user uses the previous-set action while a session is in progress
- **THEN** the parity contract records that the most recent set is removed, progress updates immediately, and the tracker shows an explicit error state when there are no sets to undo

#### Scenario: Leaving logger for picker abandons the active session
- **WHEN** the user uses the logger back action instead of finishing and saving
- **THEN** the parity contract records that static index clears the in-progress session and current exercise, returns to picker, and does not silently preserve or save the abandoned session

#### Scenario: Cancelling from notes requires explicit discard confirmation
- **WHEN** the user reaches the notes modal and chooses to cancel instead of save
- **THEN** the parity contract records that static index asks for confirmation before discarding the current session and returning to picker

#### Scenario: Accepted sets and live progress are not the same thing
- **WHEN** the user is still counting reps or progressing through a hold timer on the logger surface
- **THEN** the parity contract records that static index does not treat live counter or timer progress as a saved set until `Next Set` or `Log Set` accepts it into `currentSession`

### Requirement: Index parity must capture execution-mode behavior, not just the presence of controls
The tracker index parity contract SHALL describe how active logging behaves in counter mode, timer mode, Pocket Mode, manual set entry, and next-set confirmation, including what the primary tap does, what gets updated immediately, and when the user is advanced into another step.

#### Scenario: Counter mode opens with zeroed visible progress
- **WHEN** the user selects a reps-style exercise
- **THEN** the parity contract records that static index opens counter mode with the counter display at `0` and an active in-progress session already created

#### Scenario: Counter tap changes state immediately
- **WHEN** the user taps the main counter action
- **THEN** the parity contract records that the visible counter increments immediately, the same in-progress session remains active, and progress feedback can be emitted before final session save

#### Scenario: Counter decrement is bounded at zero
- **WHEN** the visible counter value is `0` and the user presses the decrement action
- **THEN** the parity contract records that static index does not take the displayed counter below zero

#### Scenario: Timer exercises open timer mode directly
- **WHEN** the user selects a duration or hold exercise
- **THEN** the parity contract records that static index opens timer mode immediately rather than starting in the counter surface

#### Scenario: Pocket Mode controls the same session instead of a separate one
- **WHEN** the user enters Pocket Mode during an active logger session
- **THEN** the parity contract records that Pocket Mode mirrors and controls the same `currentSession` and `currentExercise` rather than creating an isolated logging path

#### Scenario: Hold timer advances rep progress before creating a full set
- **WHEN** the user completes a timed rep in a hold exercise
- **THEN** the parity contract records that static index advances the hold rep counter, resets the timer display for the next rep, and only creates a full set after the configured reps for that set have been completed or manually logged

#### Scenario: Duration timer becomes a single timed set
- **WHEN** the user confirms a completed duration exercise
- **THEN** the parity contract records that static index treats it as one rep with captured seconds rather than a multi-rep hold sequence

#### Scenario: Reset clears live timer progress, not the whole session
- **WHEN** the user resets the active timer
- **THEN** the parity contract records that static index returns the timer display to the target duration and clears the live timer progress without deleting already accepted sets from `currentSession`

#### Scenario: Next Set summarizes live logger output against target
- **WHEN** the user opens `Next Set`
- **THEN** the parity contract records that static index summarizes the currently captured logger value against the configured target and lets the user either confirm it as app-recorded or route into manual editing

#### Scenario: Next Set writes a normalized app-recorded set payload
- **WHEN** the user confirms `Next Set`
- **THEN** the parity contract records that static index appends a set with `set_number`, normalized `reps` and `seconds`, `distance_feet: null`, the active main-tracker side, optional normalized `form_data`, `manual_log: false`, `partial_rep: false`, and a fresh `performed_at` timestamp

#### Scenario: Next Set value selection depends on execution mode
- **WHEN** static index builds the `Next Set` payload
- **THEN** the parity contract records that counter mode uses the visible counter as `reps`, duration timer mode writes `reps: 1` plus elapsed whole seconds, and hold timer mode writes the live hold-rep count plus target seconds-per-rep

#### Scenario: Next Set rejects empty live progress
- **WHEN** the user confirms `Next Set` with `0` reps and no captured seconds
- **THEN** the parity contract records that static index closes the modal and shows `Please perform at least one rep` instead of appending an empty set

#### Scenario: Manual Log Set uses target defaults instead of live logger value
- **WHEN** the user opens `Log Set`
- **THEN** the parity contract records that static index pre-fills the modal from the exercise target dose and required form-parameter defaults rather than copying whatever live counter value is currently shown

#### Scenario: Manual Log Set defaults differ by exercise type
- **WHEN** the user opens `Log Set`
- **THEN** the parity contract records that static index pre-fills duration exercises from target seconds and labels the field `Seconds performed`, pre-fills hold exercises from target reps plus target seconds-per-rep with both inputs visible, and pre-fills reps exercises from target reps with the extra seconds input hidden

#### Scenario: Manual Log Set writes normalized payload flags
- **WHEN** the user saves from `Log Set`
- **THEN** the parity contract records that static index appends a set with `set_number`, normalized `reps` and `seconds`, `distance_feet: null`, side from modal-local side selection or current tracker side, optional normalized `form_data`, `partial_rep: false`, a fresh `performed_at`, and `manual_log` set according to how the modal was reached

#### Scenario: Manual Log Set flagging differs between direct manual entry and timer completion
- **WHEN** static index saves a set from `Log Set`
- **THEN** the parity contract records that direct reps-style manual entry and hold-manual entry mark `manual_log: true`, while timer-driven save paths using the same modal keep `manual_log: false`

#### Scenario: Hold Log Set is split between partial progress and full set creation
- **WHEN** the logger is in hold-timer mode and the user saves through `Log Set`
- **THEN** the parity contract records that static index increments the live rep counter first, returns early with `Rep N complete` while more timed reps remain, and only appends a completed set after the live rep counter exceeds the target rep count

#### Scenario: Hold manual entry requires both reps and seconds
- **WHEN** the user uses `Log Set` for a hold exercise through the fully manual path
- **THEN** the parity contract records that static index blocks save when `Seconds/rep` is `0` and shows `Please enter seconds per rep`

#### Scenario: Manual Log Set blocks zero values
- **WHEN** the user saves `Log Set` with a main value of `0`
- **THEN** the parity contract records that static index blocks the save with `Please enter a value greater than 0`

#### Scenario: Form-parameter defaults merge session-local, exercise-local, and global history
- **WHEN** static index renders form-parameter controls for `Log Set` or `Next Set`
- **THEN** the parity contract records that it prefers the most recent value from the current in-progress session first, then exercise-local saved history, then global history for the same parameter name, with side-scoped filtering when the flow is side-specific

#### Scenario: Weight and distance parameters stay unit-aware while other parameters use smart selects
- **WHEN** static index renders required form parameters
- **THEN** the parity contract records that `weight` and form-parameter `distance` render as number-plus-unit controls with remembered units, while other parameters render smart dropdowns with historical options and an `Other...` branch that reveals a custom text field

#### Scenario: Collected form data is normalized before set write
- **WHEN** static index collects form parameters from `Log Set` or `Next Set`
- **THEN** the parity contract records that saved parameter entries use normalized objects shaped as `parameter_name`, `parameter_value`, and `parameter_unit`, omitting empty fields rather than storing placeholders

#### Scenario: Distance is present in the data model but not actively written by logger set creation
- **WHEN** an implementation agent rebuilds logger-side set creation
- **THEN** the parity contract records that static index currently preserves `distance_feet` in dosage, history rendering, queue sync, and edit-session maintenance, but active `Next Set` and `Log Set` creation still write `distance_feet: null` rather than capturing a logger-entered distance value

### Requirement: Index parity must capture Pocket Mode behavior as part of the logger contract
The tracker index parity contract SHALL describe Pocket Mode in user-facing terms, including how it is entered, what it shows for timer versus counter exercises, what tap and long-press do, how it exits, and how it relates to ongoing session progress.

#### Scenario: Pocket Mode requires an active exercise session
- **WHEN** Pocket Mode is toggled on
- **THEN** the parity contract records that static index only activates it when an exercise is already in progress

#### Scenario: Pocket Mode timer and counter displays differ
- **WHEN** Pocket Mode is active
- **THEN** the parity contract records that static index shows timer display and timer-state hints for timer exercises, but shows current count plus remaining reps and `Tap to count` for counter exercises

#### Scenario: Pocket Mode tap behavior depends on exercise mode
- **WHEN** the user taps the pocket pad
- **THEN** the parity contract records that static index routes timer exercises to start or pause behavior and routes counter exercises to counter increment behavior

#### Scenario: Pocket Mode long press is timer-only partial logging
- **WHEN** the user performs a long press on the pocket pad during a timer exercise
- **THEN** the parity contract records that static index uses a 700ms threshold, logs a partial rep, advances session progress, and emits a distinct confirmation beep

#### Scenario: Releasing before long-press threshold falls back to normal tap
- **WHEN** the user lifts their finger before the Pocket Mode long-press threshold is met
- **THEN** the parity contract records that static index cancels the long-press path and leaves the regular tap behavior to fire instead

#### Scenario: Exiting Pocket Mode does not finish or cancel the session
- **WHEN** the user closes Pocket Mode
- **THEN** the parity contract records that static index dismisses the overlay and returns to the normal logger surface without finishing, cancelling, or replacing the current session

#### Scenario: Pocket Mode continuously mirrors timer state while active
- **WHEN** Pocket Mode is open during a timer exercise
- **THEN** the parity contract records that static index refreshes the overlay continuously so countdown display, rep progress, and hints stay in sync with the live timer

### Requirement: Index parity must capture tracker-owned messages access
The tracker index parity contract SHALL treat messages opened from the tracker shell as an index-owned flow, including how the entry point appears, what user context it uses, and how recipient fallback is resolved.

#### Scenario: Tracker menu exposes messages as a shell action
- **WHEN** the user opens the tracker shell actions from index
- **THEN** the parity contract records whether messages entry exists there and what modal or panel is expected to open

#### Scenario: Message recipient uses tracker viewing context
- **WHEN** a message is sent from the tracker-owned messages flow
- **THEN** the parity contract records how recipient fallback is chosen from thread context, assigned therapist context, or viewing-patient context so role-correct routing can be reviewed from source

#### Scenario: Opening messages marks them read in two places
- **WHEN** the tracker-owned messages modal opens
- **THEN** the parity contract records that static index updates local last-read state and also performs server-side mark-as-read behavior, because both are part of the static flow

#### Scenario: Message open clears shell badge state
- **WHEN** the tracker-owned messages modal opens successfully
- **THEN** the parity contract records that the unread badge is cleared as part of the shell-visible result, not as a later unrelated refresh

#### Scenario: Message badge count uses locally tracked last-read time
- **WHEN** the shell checks for new messages outside the modal
- **THEN** the parity contract records that static index compares incoming message timestamps against locally stored `lastReadMessageTime`, counts only messages from the other participant, and shows or hides the badge based on that unread count

#### Scenario: Messages modal preserves empty, failed, and sent-state copy
- **WHEN** the messages flow is rebuilt from the parity contract
- **THEN** the contract preserves the static empty-state copy, failed-load state, sent-message `Delivered` state, later `Read ...` state, and the `Hide` and `Undo Send` affordances that shape the user experience

#### Scenario: Message rows preserve sender labels and undo window
- **WHEN** the tracker renders a message thread
- **THEN** the parity contract records that static index labels messages as `You → PT` or `PT → You`, timestamps each row, and shows `Undo Send` only for the sender's own messages within the one-hour undo window

#### Scenario: Message delete confirmation is explicit
- **WHEN** the user chooses `Undo Send`
- **THEN** the parity contract records that static index asks for confirmation before deleting the message for both conversation participants

#### Scenario: Message flow uses different request types for different actions
- **WHEN** the tracker loads, sends, archives, marks read, or deletes messages
- **THEN** the parity contract records which actions use GET, POST, PATCH, or DELETE against the messages API surface so a rebuild preserves both flow and server interaction pattern

#### Scenario: Email-notification toggle preserves its own state contract
- **WHEN** the user changes the email-notification checkbox inside the messages flow
- **THEN** the parity contract records that static index PATCHes the user preference, keeps the checkbox in sync with the saved preference on success, and reverts the checkbox plus shows a failure toast on error

#### Scenario: Message send guards remain explicit
- **WHEN** the user sends from the tracker-owned messages flow
- **THEN** the parity contract records that static index blocks empty-body sends, unauthenticated sends, missing-recipient sends with `No therapist assigned. Cannot send message.`, and self-send attempts with `Cannot send a message to yourself.`

### Requirement: Index parity must capture UX feedback as behavior
The tracker index parity contract SHALL treat feedback cues as functional behavior when they tell the user what happened, what remains, or whether an action succeeded, including adherence badges, empty states, toasts, inline save feedback, and spoken progress announcements.

#### Scenario: Exercise list reflects completion state
- **WHEN** exercise and history data load or a session is saved
- **THEN** the parity contract records how adherence text such as `Done today` or `X days ago` appears and refreshes on the exercise list

#### Scenario: Logging actions confirm progress
- **WHEN** the user records a set, changes side, nears set completion, or finishes all sets
- **THEN** the parity contract records the visible or spoken cues that confirm progress so migration work preserves the lived interaction process instead of just data writes

#### Scenario: Error and status toasts are reviewable behavior
- **WHEN** the tracker blocks an action, falls back to cache, changes connectivity state, syncs queued sessions, or completes a save
- **THEN** the parity contract records the corresponding toast or status feedback as behavior that should be checked from source instead of treated as optional polish

#### Scenario: Search and details affordances remain visible behavior
- **WHEN** the picker renders exercises and the user searches or opens details
- **THEN** the parity contract records the `Search exercises...` affordance, the distinct `No exercises found.` search-empty state, and the dedicated exercise-details entry point as user-visible behavior rather than implementation garnish

#### Scenario: Save toast includes note-state copy
- **WHEN** the tracker completes a save from the notes flow
- **THEN** the parity contract records that the success toast distinguishes `Saved (with notes)` from `Saved (no notes)` instead of using a single generic success message

#### Scenario: Empty states are part of tracker behavior
- **WHEN** the tracker has no history for the current context or no prior sessions for an exercise
- **THEN** the parity contract records the empty-state behavior and copy instead of treating those states as unspecified placeholders

#### Scenario: Non-toast hints are preserved as behavior
- **WHEN** the tracker uses labels, hints, badges, or banners to tell the user what to do or what context they are in
- **THEN** the parity contract records those cues as behaviorally important, including Pocket Mode hints, patient banner state, sync badge changes, and edit-session empty-set copy

#### Scenario: Progress labels are preserved as part of the logger contract
- **WHEN** the tracker reports current side, hold rep progress, timer target, next-set side, or next-set summary
- **THEN** the parity contract records those labels and formats so the rebuilt tracker guides the user the same way as static index

#### Scenario: Set logging produces both flash feedback and longer-running announcements
- **WHEN** the tracker accepts a new set into the current session
- **THEN** the parity contract records that static index shows brief visual log feedback immediately and can also announce comparison-to-last-session speech on a delayed cadence

### Requirement: Index parity must capture offline startup and sync behaviors that affect tracker flow
The tracker index parity contract SHALL describe the tracker behaviors that change when connectivity changes, including offline bootstrap, cached-data fallback, manual sync entry, and queue-driven state changes visible from the index shell.

#### Scenario: Offline startup changes the available tracker flow
- **WHEN** the tracker is opened without network
- **THEN** the parity contract records what data source is used, what feedback is shown, and which actions remain available from the shell

#### Scenario: Manual sync is part of the shell behavior
- **WHEN** the user triggers manual sync from the tracker shell
- **THEN** the parity contract records where that action appears, what state it operates on, and what success or failure feedback is expected

#### Scenario: Manual sync preserves empty-queue feedback
- **WHEN** the user triggers manual sync while there are no unsynced sessions
- **THEN** the parity contract records that static index shows `Nothing to sync!` rather than silently doing nothing

#### Scenario: Duplicate-safe sync is part of static queue behavior
- **WHEN** static index syncs queued sessions and encounters a duplicate submission response
- **THEN** the parity contract records that the duplicate is treated as success for queue-clearing purposes so replay-safe sync behavior is preserved

#### Scenario: Offline fallback can still populate the tracker shell
- **WHEN** network data load fails but cached programs or logs exist
- **THEN** the parity contract records that static index still renders the exercise and history surfaces from cached data and shows explicit offline fallback feedback rather than leaving the shell empty

#### Scenario: Missing cache keeps the shell from pretending data exists
- **WHEN** network data load fails and no cached tracker data is available for the resolved patient context
- **THEN** the parity contract records that static index cannot reconstruct the normal tracker shell from cache and must surface load failure instead of implying that exercises or history were recovered

#### Scenario: Returning online updates state before any full refresh
- **WHEN** the browser comes back online
- **THEN** the parity contract records that static index updates connectivity state and sync UI immediately, attempts queue sync when work exists, and only performs a full tracker reload when the picker view is currently active

#### Scenario: Active logging is not interrupted by online recovery
- **WHEN** queued data syncs successfully while the user is in logger or history view
- **THEN** the parity contract records that static index avoids replacing the active view with a full picker refresh and instead hydrates cache for later use

#### Scenario: Offline queue save and later sync are both visible parts of one flow
- **WHEN** the user saves a session while offline or during unreliable connectivity
- **THEN** the parity contract records both the immediate queue-first success behavior and the later sync-success or sync-failure feedback so the rebuilt tracker preserves the same trust model

#### Scenario: Cache hydration is background work after successful online load
- **WHEN** fresh online programs and history have already been loaded successfully
- **THEN** the parity contract records that static index hydrates the offline cache in the background rather than blocking the initial interactive render on cache write completion

#### Scenario: Online recovery mixes sync and refresh in a specific order
- **WHEN** connectivity returns and auth plus viewing context are already available
- **THEN** the parity contract records that static index first updates connectivity UI, then attempts queue sync when needed, then either reloads picker data or silently hydrates cache depending on which view is active

### Requirement: Index parity must define temporal semantics explicitly
The tracker index parity contract SHALL define date and time behavior in concrete terms, including how the static tracker identifies `today`, how recency buckets are computed for adherence, how history timestamps are displayed, and how backdate changes session and set timestamps.

#### Scenario: `Done today` is based on local calendar date, not elapsed hours
- **WHEN** the tracker computes adherence state for the most recent session
- **THEN** the parity contract records that the static app normalizes both the current time and the session `performed_at` to local midnight before computing day difference, so `Done today` follows local calendar date boundaries rather than a rolling 24-hour window

#### Scenario: Recency bucket boundaries are fixed
- **WHEN** the tracker labels an exercise by recency
- **THEN** the parity contract records the exact buckets used by static index: `0 days = Done today`, `1-3 days = green X day(s) ago`, `4-7 days = orange X days ago`, `8+ days = red X days ago`

#### Scenario: Backdate rewrites saved timestamps
- **WHEN** the user applies a backdate before final session save
- **THEN** the parity contract records that the chosen date defaults from session start time, warns when it differs from session start by more than two minutes, and rewrites both the session date and each set `performed_at` timestamp to the chosen ISO value before queueing and history refresh

#### Scenario: Message freshness polling is part of shell timing behavior
- **WHEN** the user is signed into the tracker shell
- **THEN** the parity contract records that static index checks for new messages immediately after load and then polls every 30 seconds, because that timing affects badge behavior and perceived message freshness

#### Scenario: Authenticated startup scheduling is part of shell timing behavior
- **WHEN** the tracker starts with an existing session
- **THEN** the parity contract records the order in which static index performs auth-derived setup, data load, first message check, and recurring polling because that ordering affects what the user sees first

### Requirement: Index parity must capture history maintenance behavior
The tracker index parity contract SHALL describe the session-history actions available from index itself, including edit entry, whole-session save behavior, and destructive delete behavior.

#### Scenario: History entries can be opened for maintenance
- **WHEN** the user activates a history session from the tracker
- **THEN** the parity contract records whether that action opens an edit-session flow and what session data is available there

#### Scenario: Delete is explicit and destructive
- **WHEN** the user deletes a session from index-owned history maintenance flow
- **THEN** the parity contract records that static index uses an explicit confirmation step before deleting the entire session

#### Scenario: Edit session can expose an empty set list
- **WHEN** a history maintenance flow opens a session whose set collection is empty
- **THEN** the parity contract records that static index renders an explicit `No sets logged` state inside the edit modal instead of hiding the session shell entirely

#### Scenario: History maintenance edits whole-session fields together
- **WHEN** the user saves from index-owned history maintenance
- **THEN** the parity contract records that static index patches the session timestamp, notes, and edited set collection together as one save action rather than treating those as separate maintenance workflows

#### Scenario: Edit-session field set depends on exercise type
- **WHEN** the edit-session modal renders a session
- **THEN** the parity contract records that static index shows `Reps` for all sessions, `Seconds` or `Seconds/rep` for hold or duration sessions, `Distance (ft)` for distance sessions, `Side` only for sided sessions, and editable form-parameter inputs only when set-level `form_data` exists

#### Scenario: Added and deleted edit-session sets preserve static defaults
- **WHEN** the user adds or deletes sets inside the edit-session modal
- **THEN** the parity contract records that static index seeds new sets from exercise defaults, defaults sided added sets to right, stamps a fresh `performed_at`, and renumbers `set_number` values after delete before rerendering

#### Scenario: History cards expose enough preview data to choose the right session
- **WHEN** the history view renders saved sessions
- **THEN** the parity contract records that static index shows date, exercise name, set summary, optional inline form-parameter summary, and optional notes preview on the card before the user opens edit mode

### Requirement: Index parity must capture blocked and failure states explicitly
The tracker index parity contract SHALL name the blocked, empty, and failure states that change user decisions, including zero-progress finish attempts, missing tracker context, failed data loads, empty history, unread-state transitions, and recipient-context failure.

#### Scenario: Missing patient context is a startup failure, not a soft warning
- **WHEN** the tracker shell cannot resolve a patient context during bootstrap
- **THEN** the parity contract records that static index refuses normal tracker startup rather than continuing with ambiguous ownership

#### Scenario: Failed exercise load has explicit shell feedback
- **WHEN** the tracker cannot load exercises and cannot recover from cache
- **THEN** the parity contract records the visible failure state instead of leaving exercise loading unspecified

#### Scenario: Failed history load has explicit history feedback
- **WHEN** history loading fails
- **THEN** the parity contract records the visible failed-history state instead of treating history as silently empty

#### Scenario: Search-empty and exercise-empty states stay distinct
- **WHEN** the picker has no renderable exercises because the program list is empty versus because the current search query filtered everything out
- **THEN** the parity contract records that static index uses different visible copy for those states instead of collapsing them into one generic empty screen

#### Scenario: Missing recipient fallback is treated as a reviewable risk
- **WHEN** a tracker-owned message flow cannot establish a thread recipient, therapist fallback, or viewing-patient routing as expected
- **THEN** the parity contract requires that gap to be documented as a blocked parity condition rather than silently assuming messaging still works

#### Scenario: Zero or invalid manual entry stays blocked
- **WHEN** the user tries to save a manual log set with `0` reps or missing required hold seconds
- **THEN** the parity contract records that static index blocks the save and shows explicit validation feedback instead of silently accepting an empty set

#### Scenario: Authless state blocks data APIs
- **WHEN** there is no active authenticated session
- **THEN** the parity contract records that static index does not proceed with authenticated tracker API flows and instead keeps the auth surface visible

#### Scenario: Password confirmation mismatch blocks reset completion
- **WHEN** the user enters different values in new-password and confirm-password fields
- **THEN** the parity contract records that static index blocks submission and shows an inline mismatch error before any password-update call is made

#### Scenario: Missing message auth or recipient blocks the messages flow explicitly
- **WHEN** the user tries to open or send from tracker-owned messages without the required auth or recipient context
- **THEN** the parity contract records the visible blocked states `Please sign in to view messages`, `Please sign in to send messages`, and `No therapist assigned. Cannot send message.` instead of leaving those branches implicit

### Requirement: Index parity review must happen before runtime parity testing
The tracker index parity contract SHALL be specific enough that an agent can perform a source-first parity review before opening a browser, especially for flows that have historically been discovered late.

#### Scenario: Reviewer can check shell, save, and timing flows from code
- **WHEN** an agent reviews the index migration before Playwright
- **THEN** the artifact provides enough source-mapped states, transitions, and edge cases for the reviewer to inspect shell context, logging finalization, tracker-owned messaging, offline startup, and adherence timing directly in code

#### Scenario: Browser testing validates rather than discovers
- **WHEN** Playwright or manual QA is run after the source review
- **THEN** the runtime pass is used to validate the documented behavior and catch implementation defects, not to discover undocumented baseline flow for the first time
