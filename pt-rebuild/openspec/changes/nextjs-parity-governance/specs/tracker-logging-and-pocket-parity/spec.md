## ADDED Requirements

### Requirement: Exercise selection MUST create an in-progress logger session immediately
The tracker SHALL create the active logging session at exercise selection time, before any set is saved or any final session persistence occurs.

#### Scenario: User selects an exercise from the picker
- **WHEN** the user selects an exercise card
- **THEN** the tracker MUST set `currentExercise`, derive the activity type, create `currentSession` with named fields including `sessionId`, `exerciseId`, and `exerciseName` plus empty `sets` and an initial session timestamp, and transition into the dedicated logger view

### Requirement: Logger state inventory MUST preserve static meanings and clear points
The logger SHALL preserve the named state meanings and lifecycle boundaries used by static `index.html`.

#### Scenario: Agent reconstructs active logging state
- **WHEN** a migration agent rebuilds the active logger model
- **THEN** the readable contract MUST preserve the meaning and lifecycle of `currentExercise`, `currentSession`, `currentSide`, `logSetSelectedSide`, and `timerState`, including that `logSetSelectedSide` is created by `show-log-set-modal`, updated by modal side selection, and cleared on modal close or a new modal open, and that `timerState` covers live timer-mode progress and is initialized, updated, paused, reset, or cleared by timer lifecycle changes and logger exit paths

### Requirement: Logger MUST preserve static shell ownership
The tracker SHALL preserve that the logger is its own shell view, not merely a modal layered over the picker.

#### Scenario: User enters active logging
- **WHEN** an exercise is selected
- **THEN** the tracker MUST preserve the logger as a dedicated owned shell view with its own actions, progress state, and exit behavior rather than treating logging as a lightweight picker overlay

### Requirement: Mode selection MUST preserve static activity-type behavior
The logger SHALL choose its execution surface from the selected exercise's dosage and pattern-modifier rules.

#### Scenario: Logger initializes for selected exercise
- **WHEN** the tracker enters logger view for a selected exercise
- **THEN** reps-style exercises MUST open the counter surface directly, while hold and duration exercises MUST open timer mode directly with the appropriate target configuration

### Requirement: Side behavior MUST preserve static sided-versus-bilateral rules
The logger SHALL preserve the same side model as static `index.html`.

#### Scenario: Logger initializes side state
- **WHEN** the selected exercise is sided versus bilateral
- **THEN** sided exercises MUST show side controls and default the active side to right, while bilateral exercises MUST hide side controls and set `currentSide` to `null`

### Requirement: Counter mode MUST preserve live-count behavior
The counter logger SHALL preserve the static live counter behavior and progress feedback.

#### Scenario: User logs reps from the counter surface
- **WHEN** the user taps or decrements the counter controls
- **THEN** the visible count MUST increment immediately on tap, MUST not decrement below zero, and MAY emit the same milestone feedback and progress cues used by the static tracker

### Requirement: Counter mode MUST preserve the main tap-surface interaction model
The logger SHALL preserve the static counter logger as a large primary tap surface rather than only as a small stepper-like control.

#### Scenario: User uses the primary counter interaction
- **WHEN** the selected exercise is in counter mode
- **THEN** the main logger interaction MUST remain a giant tap surface whose primary purpose is to increment the visible rep count immediately

### Requirement: First pointer interaction MUST preserve static audio unlock behavior
The tracker SHALL preserve the one-time audio unlock path that enables later beeps and speech on touch devices.

#### Scenario: User first interacts with the page
- **WHEN** the first body-level pointer interaction occurs
- **THEN** the tracker MUST preserve the one-time audio-unlock behavior that allows later execution feedback to play reliably

### Requirement: Logger execution feedback MUST preserve static audible and visible cues
The logger SHALL preserve execution feedback that tells the user what just happened while logging.

#### Scenario: User progresses through reps or timer logging
- **WHEN** the user taps, changes side, completes timed progress, or finishes all sets
- **THEN** the tracker MUST preserve per-tap beep feedback, countdown cues near zero, side-switch announcement, milestone rep-left cues, set-complete cues, and all-sets-complete feedback, and MUST preserve the exact spoken cues `5 reps left`, `3 reps left`, `Last rep`, `Set complete`, and `All sets complete`, even when exact implementation helpers differ

### Requirement: Progress wording MUST preserve static execution phrasing
The logger SHALL preserve the concrete progress wording that shapes how execution feels to the user.

#### Scenario: Logger communicates active progress
- **WHEN** the logger or Pocket Mode shows active progress or accepted-set feedback
- **THEN** it MUST preserve exact progress wording including `Working left side`, `Working right side`, `Rep X of N`, `Duration Exercise`, `Target: N seconds`, sided next-set summaries, `logged value (target value)` summaries, undo success identification, and `Rep N complete` midpoint feedback

### Requirement: Session-complete feedback MUST preserve exact static announcement
The logger SHALL preserve the static behavior that session progress culminates in the explicit spoken completion cue `All sets complete` rather than silently stopping at the last set.

#### Scenario: User completes the planned session progress
- **WHEN** the tracker recognizes that all sets are complete for the active exercise
- **THEN** it MUST preserve the explicit session-complete feedback used by the static tracker, including the exact spoken completion cue `All sets complete`

### Requirement: Timer mode MUST preserve target-down countdown behavior
The timer logger SHALL preserve the static timer model rather than acting like a stopwatch.

#### Scenario: User runs a timer-based exercise
- **WHEN** the logger enters timer mode
- **THEN** the timer MUST count down from the configured target, support start or pause and reset controls, and preserve the static distinction between live timer progress and accepted set progress

### Requirement: Hold timer behavior MUST preserve rep-within-set progression
Hold exercises SHALL preserve the static rule that timed reps can advance live progress before a completed set is accepted.

#### Scenario: User completes timed reps for a hold exercise
- **WHEN** the user completes a timed hold rep while a set is still in progress
- **THEN** the tracker MUST advance live rep progress, reset the timer display for the next rep, and MUST NOT append a completed set until the configured reps for that set have been satisfied or the user manually logs the set

### Requirement: Duration timer behavior MUST preserve single-run semantics
Duration exercises SHALL preserve the static rule that a completed duration run becomes one accepted timed set rather than a multi-rep hold sequence.

#### Scenario: User completes a duration exercise
- **WHEN** the user completes and confirms a duration timer run
- **THEN** the tracker MUST treat it as one rep with captured seconds against the duration target

### Requirement: Live progress and accepted sets MUST remain separate concepts
The logger SHALL preserve the static distinction between current live progress and the `currentSession.sets` collection.

#### Scenario: Logger shows progress before set acceptance
- **WHEN** the user is still counting reps or progressing through a timer
- **THEN** the tracker MUST NOT treat live counter or timer progress as a saved set until `Next Set` or `Log Set` appends an accepted set into `currentSession`

### Requirement: `Next Set` MUST preserve static confirmation behavior
The tracker SHALL preserve `Next Set` as the confirmation flow for live logger output rather than a generic manual-entry modal.

#### Scenario: User opens `Next Set`
- **WHEN** the user opens `Next Set` from the active logger
- **THEN** the tracker MUST preserve that the static owner `showNextSetModal()` summarizes the currently captured live value against the configured target, preserves side summary when applicable, and allows the user to cancel, edit through `Log Set`, or confirm the app-recorded set

### Requirement: `Next Set` MUST write normalized app-recorded payloads
The tracker SHALL preserve the static payload shape written by `Next Set`.

#### Scenario: User confirms `Next Set`
- **WHEN** the user confirms `Next Set`
- **THEN** the tracker MUST append a set with `set_number`, normalized `reps` and `seconds`, `distance_feet: null`, the active main-tracker side, optional normalized `form_data`, `manual_log: false`, `partial_rep: false`, and a fresh `performed_at` timestamp

### Requirement: `Next Set` payload oddities MUST remain visible for migration review
The logger parity package SHALL preserve payload behaviors that may be suspicious or internally inconsistent rather than smoothing them away.

#### Scenario: Static logger writes a questionable payload field
- **WHEN** static `index.html` writes values such as `distance_feet: null` from `Next Set` even though distance exists elsewhere in the tracker data model
- **THEN** the canonical logging spec MUST preserve that observed behavior as a review-visible inconsistency instead of silently omitting it

### Requirement: `Next Set` value selection MUST preserve execution-mode rules
The tracker SHALL preserve how static `index.html` chooses values for `Next Set`.

#### Scenario: Logger builds `Next Set` values
- **WHEN** the tracker prepares the `Next Set` summary and payload
- **THEN** counter mode MUST use the visible counter as reps, duration mode MUST use one rep plus elapsed seconds, and hold mode MUST use the live hold-rep count plus target seconds-per-rep

### Requirement: Accepted-set feedback MUST preserve static comparison and progress cues
The logger SHALL preserve the static feedback that happens after a set is accepted into the in-progress session.

#### Scenario: User confirms or saves an accepted set
- **WHEN** `Next Set` or `Log Set` appends a set into `currentSession`
- **THEN** the tracker MUST preserve immediate progress updates, log feedback, and any static comparison-style cue to prior session performance that occurs after accepted-set writes

### Requirement: `Next Set` MUST reject empty live progress
The tracker SHALL preserve the static guard against confirming an empty live logger state.

#### Scenario: User confirms `Next Set` without live progress
- **WHEN** reps are `0` and there are no captured seconds to log
- **THEN** the tracker MUST block the save and preserve the zero-value guidance `Please enter a value greater than 0` instead of appending an empty set

### Requirement: `Log Set` MUST preserve target-prefill behavior
The tracker SHALL preserve `Log Set` as the manual-entry flow that uses target-derived defaults rather than current live counter state.

#### Scenario: User opens `Log Set`
- **WHEN** the user opens `Log Set`
- **THEN** the tracker MUST prefill duration exercises from target seconds, hold exercises from target reps plus target seconds-per-rep, and reps exercises from target reps rather than copying the currently displayed live counter value

### Requirement: Modal contracts MUST preserve static distinction between confirmation and manual entry
The tracker SHALL preserve the different meaning of `Next Set` and `Log Set`.

#### Scenario: User moves between logger modals
- **WHEN** the user opens `Next Set`, chooses edit, or opens `Log Set` directly
- **THEN** `Next Set` MUST behave as the confirmation modal opened by `showNextSetModal()`, `Edit` MUST route into the manual-entry flow opened by `showLogSetModal()`, and `Log Set` MUST remain the target-prefilled manual-entry surface rather than a copy of the current live logger state

### Requirement: `Log Set` MUST preserve hold-specific manual entry rules
The tracker SHALL preserve the static differences between direct manual hold entry and timer-driven hold progression.

#### Scenario: User manually logs a hold set
- **WHEN** the user saves a hold set through the fully manual path
- **THEN** the tracker MUST require both reps and seconds-per-rep, block save with `Please enter seconds per rep` when seconds are `0`, and append the completed hold set directly without rep-by-rep timer progression

### Requirement: `Log Set` MUST preserve timer-driven hold midpoint behavior
The tracker SHALL preserve the static rule that timer-driven hold logging may return early before a full set is appended.

#### Scenario: User saves through `Log Set` during timer-driven hold progression
- **WHEN** a hold set still has timed reps remaining
- **THEN** the tracker MUST increment live rep progress, show midpoint feedback `Rep N complete`, and return without appending a full set until the target rep count has been exceeded

### Requirement: `Log Set` MUST preserve normalized payload flags
The tracker SHALL preserve the static payload fields and `manual_log` semantics written by `Log Set`.

#### Scenario: User saves from `Log Set`
- **WHEN** the user saves a set from the manual-entry flow
- **THEN** the tracker MUST append a set with `set_number`, normalized `reps` and `seconds`, `distance_feet: null`, side from modal-local selection or current tracker side, optional normalized `form_data`, `partial_rep: false`, a fresh `performed_at`, and `manual_log` set according to whether the path was direct manual entry versus timer-driven confirmation

### Requirement: Form-parameter behavior MUST preserve static historical defaults
The logger SHALL preserve the static form-parameter model used by `Log Set` and `Next Set`.

#### Scenario: Tracker renders form parameters
- **WHEN** an exercise requires form parameters
- **THEN** the tracker MUST render parameter controls in both `Log Set` and `Next Set`, prefer current-session last-used values first, then exercise-local saved history, then global history for the same parameter name, and preserve side-aware filtering when applicable

### Requirement: Form-parameter input types MUST preserve static behavior
The logger SHALL preserve the special-case handling of `weight`, parameter `distance`, and `Other...` custom entry.

#### Scenario: User interacts with form-parameter controls
- **WHEN** form-parameter inputs are rendered and edited
- **THEN** `weight` and parameter `distance` MUST remain number-plus-unit inputs with remembered units, other parameters MUST use smart selects with historical options, and selecting `Other...` through the direct document-level `change` event on the form-parameter select MUST reveal a custom text input while hiding it again when `Other...` is no longer selected

### Requirement: Log-set modal close MUST preserve static dismissal and reset behavior
The logger SHALL preserve the concrete close behavior of the manual log-set modal rather than treating it as a generic dismiss action.

#### Scenario: User closes `Log Set` without saving
- **WHEN** the user triggers `close-log-set-modal`
- **THEN** the tracker MUST dismiss the modal opened by `showLogSetModal()`, return focus to the underlying logger session without appending a set, and clear modal-local state such as `logSetSelectedSide` so the next manual-entry open starts from static defaults

### Requirement: Form-parameter parity MUST preserve history and maintenance usage
The readable parity package SHALL preserve that form-parameter behavior affects more than just the active logger modal.

#### Scenario: Form-parameter data is shown after active logging
- **WHEN** history cards or edit-session maintenance render saved session data
- **THEN** the tracker MUST preserve first-set form-parameter summaries in history previews and per-set form-parameter editing during session maintenance when `form_data` exists

### Requirement: Manual side selection MUST preserve static sided-progress context
The logger SHALL preserve that the manual log-set modal can show side-specific progress context while choosing a side.

#### Scenario: User opens `Log Set` for a sided exercise
- **WHEN** the manual-entry modal is shown for a sided exercise
- **THEN** the tracker MUST preserve modal-local side selection together with sided progress context for left and right rather than treating side choice as a bare unlabeled toggle

### Requirement: Pocket Mode MUST preserve same-session overlay behavior
Pocket Mode SHALL preserve static `index.html` behavior as an alternate control surface for the active logger session.

#### Scenario: User enters and exits Pocket Mode
- **WHEN** the user opens and closes Pocket Mode
- **THEN** the tracker MUST preserve that the static owners `togglePocketMode()`, `updatePocketOverlay()`, `handlePocketTap()`, and `setupPocketLongPress()` require an active exercise session before entry, mirror the same `currentExercise` and `currentSession` while open, and return to the same logger session on close without finishing or cancelling it

### Requirement: Pocket Mode hints and labels MUST preserve static workflow guidance
Pocket Mode SHALL preserve the static hint text and mode labels that tell the user what tapping will do.

#### Scenario: Pocket Mode is rendered for the active session
- **WHEN** the overlay shows counter or timer state
- **THEN** the tracker MUST preserve exact mode-appropriate hints including `Tap to count` and paused timer hint `Tap to start`, together with the current timer display, current rep progress, and remaining set guidance that tells the user what action is available from the pad

### Requirement: Pocket Mode MUST preserve mode-specific displays and interactions
Pocket Mode SHALL preserve distinct counter and timer behavior.

#### Scenario: Pocket Mode is active
- **WHEN** Pocket Mode is open for a counter or timer exercise
- **THEN** counter Pocket Mode MUST show current count plus remaining reps and sets with `Tap to count`, while timer Pocket Mode MUST mirror the live timer display, running state, rep progress, and start/pause behavior for the same session

### Requirement: Pocket Mode refresh cadence MUST preserve live synchronization
Pocket Mode SHALL preserve the static rule that the overlay stays continuously synchronized with live timer state while active.

#### Scenario: Timer session remains active inside Pocket Mode
- **WHEN** Pocket Mode remains open during timer-based logging
- **THEN** the overlay MUST continue refreshing so the displayed timer state stays in sync with the same underlying logger session

### Requirement: Pocket Mode MUST preserve long-press partial logging
Pocket Mode SHALL preserve the static long-press hold behavior for timer exercises.

#### Scenario: User long-presses the pocket pad in timer mode
- **WHEN** a timer exercise is active in Pocket Mode
- **THEN** the tracker MUST use the same 700ms long-press threshold, preserve the partial-hold path for timer exercises only, and fall back to normal tap behavior when the finger is released before the threshold

### Requirement: Undo and reset MUST preserve static scope
The logger SHALL preserve static distinctions between removing accepted sets and resetting only live progress.

#### Scenario: User uses undo or reset controls
- **WHEN** the user triggers `Previous Set` or timer reset
- **THEN** `Previous Set` MUST remove only the most recent accepted set, show explicit blocked feedback `No sets to undo` when nothing can be undone, and preserve undo-success feedback that identifies the removed set number, while timer reset MUST clear live timer progress without deleting already accepted sets

### Requirement: Finish and finalization MUST preserve session-oriented flow
The tracker SHALL preserve the static session finalization model rather than collapsing finalization into set logging.

#### Scenario: User finishes a session
- **WHEN** the user selects `Done`
- **THEN** the tracker MUST block finish with `Please log at least one set before finishing` until at least one accepted set exists, open the notes modal rather than saving directly, and collect notes and optional backdate before final session persistence

### Requirement: Notes modal controls MUST preserve distinct close, backdate, and cancel semantics
The logger SHALL preserve that static notes-finalization controls do not all mean the same thing.

#### Scenario: User interacts with notes-modal controls
- **WHEN** the user triggers `close-notes-modal`, `toggle-backdate`, or `cancel-session`
- **THEN** `close-notes-modal` MUST dismiss the notes modal opened from `finishSession()` back to the active logger without discarding the in-progress session, `toggle-backdate` MUST preserve the dedicated backdate-toggle owner `toggleBackdate()` and reveal or hide the backdate controls and warning region as a dedicated UI action, and `cancel-session` MUST remain the destructive discard path that asks for confirmation before abandoning the in-progress session and returning to picker

### Requirement: Session-writing rules MUST preserve static accepted-set model
The logger SHALL preserve the static distinction between changing live logger state and writing accepted session data.

#### Scenario: Agent reconstructs how sets enter the active session
- **WHEN** the migration agent traces logger state changes
- **THEN** the tracker MUST preserve that live counter or timer progress alone does not create a set, `Next Set` and `Log Set` append accepted sets into `currentSession`, `Previous Set` removes only the most recently accepted set, `Done` does not create a set, and final save persists the whole accumulated session rather than a single set

### Requirement: Canonical logger walkthroughs MUST remain recoverable from the readable spec
The logging spec SHALL remain detailed enough that a later migration conversation can reconstruct reps, hold, and duration logging as end-to-end runtime stories.

#### Scenario: Later conversation needs to reason through a logger flow without source
- **WHEN** a migration agent needs to understand the active logger flow for reps, hold, or duration behavior
- **THEN** the logging spec MUST make it possible to reconstruct exercise selection, logger entry, live progression, modal transitions, accepted-set writes, finish blocking, notes/backdate, and final save order without reopening static source

### Requirement: Reps logger walkthrough MUST preserve static runtime choices
The logging contract SHALL preserve the specific runtime choices available during a reps exercise session.

#### Scenario: User logs a reps exercise from start to finish
- **WHEN** a reps exercise is selected and logged through completion
- **THEN** the tracker MUST preserve the path where the main surface begins at `0`, the user can keep counting, open `Next Set`, open target-prefilled `Log Set`, undo the last accepted set, confirm a set which resets the visible count to `0`, and only then finish through notes and save

### Requirement: Hold logger walkthrough MUST preserve static rep-within-set runtime
The logging contract SHALL preserve the specific runtime story for hold exercises.

#### Scenario: User logs a hold exercise from start to finish
- **WHEN** a hold exercise is selected and logged
- **THEN** the tracker MUST preserve per-rep countdown behavior, automatic pause on countdown completion, rep advancement inside the same in-progress set, timer reset back to target duration for the next rep, manual hold logging with both reps and seconds inputs, and the rule that full set acceptance is deferred until the hold set is complete or manually logged

### Requirement: Duration logger walkthrough MUST preserve static timed-run runtime
The logging contract SHALL preserve the specific runtime story for duration exercises.

#### Scenario: User logs a duration exercise from start to finish
- **WHEN** a duration exercise is selected and logged
- **THEN** the tracker MUST preserve the single countdown run, duration labeling, completion path that produces one rep with captured seconds, `Next Set` summary against target seconds, and manual logging path that uses `Seconds performed` without the extra hold-time input

### Requirement: Notes cancel and logger back MUST preserve static discard rules
The tracker SHALL preserve the static difference between abandonment and finalization cancel.

#### Scenario: User leaves the logger without saving
- **WHEN** the user goes back to picker from the logger or cancels from the notes modal
- **THEN** logger back MUST immediately abandon the in-progress session, while notes cancel MUST ask for confirmation before discarding the in-progress session and returning to picker

### Requirement: Final save MUST preserve static queue-first ordering
The tracker SHALL preserve the static save order used by the logger finalization flow.

#### Scenario: User saves a completed session
- **WHEN** the user submits the notes modal
- **THEN** the tracker MUST preserve that the static final-save owner `saveSession()` trims notes, applies backdate when present, pushes the session into the offline queue, updates sync UI, attempts immediate sync, prepends the saved session into local history, clears active logger state, returns to picker, re-renders adherence immediately, and shows `Saved (with notes)` or `Saved (no notes)` feedback

### Requirement: Successful final save MUST preserve static return-to-picker behavior
The logger SHALL preserve the static rule that a successful save immediately exits the active logger session.

#### Scenario: Completed session save succeeds locally
- **WHEN** the tracker completes the queue-first save flow
- **THEN** it MUST return the user to the picker immediately and clear both `currentSession` and `currentExercise` rather than leaving the user inside the logger

### Requirement: Notes modal submit path MUST preserve static direct-save behavior
The logger SHALL preserve that the notes modal is the direct final save entry point for a completed session.

#### Scenario: User submits the notes modal
- **WHEN** the user saves from the notes and backdate surface
- **THEN** the tracker MUST preserve the direct modal-submit path into final session save rather than requiring an extra intermediate confirmation step

### Requirement: Backdate input change MUST preserve static warning behavior
The logger SHALL preserve that backdate warning visibility changes as the chosen datetime moves relative to session start.

#### Scenario: User edits the backdate field
- **WHEN** the backdate input value changes
- **THEN** the tracker MUST preserve warning visibility based on whether the chosen time differs from session start by more than two minutes

### Requirement: Backdate warning copy MUST preserve static guidance intent
The logger SHALL preserve the static warning guidance shown when the user materially changes the session timestamp.

#### Scenario: User changes the backdate enough to trigger a warning
- **WHEN** the chosen session datetime differs from session start by more than two minutes
- **THEN** the tracker MUST preserve the same warning-guidance intent as the static tracker, including that the session will be logged at the selected time rather than “now”

### Requirement: Backdate warning wording MUST remain close to static guidance
The logger SHALL preserve the specific warning-language direction used when session time is changed away from the current moment.

#### Scenario: User sees the backdate warning
- **WHEN** the backdate warning is shown
- **THEN** the user-facing warning wording MUST preserve the exact static copy `Date/time changed from now. Session will be logged at the selected time.`

### Requirement: Logger invariants MUST preserve static active-session meaning
The logger SHALL preserve the same meanings of `currentExercise`, `currentSession`, and side state as the static tracker.

#### Scenario: Agent reconstructs logger state model
- **WHEN** a migration agent uses the logger contract to rebuild state handling
- **THEN** `currentSession` MUST mean the unsaved session being assembled for the current exercise, `currentSession.sets` MUST contain only accepted sets, `currentSide` MUST be meaningful only for sided exercises, and modal-local side state MAY differ temporarily from the main tracker side until set save

### Requirement: Pocket long-press feedback MUST preserve static confirmation intent
The logger SHALL preserve the distinct feedback intent attached to successful timer-mode Pocket long press behavior.

#### Scenario: Pocket long press successfully triggers partial hold logging
- **WHEN** a timer-mode Pocket long press crosses the threshold and records its partial action
- **THEN** the tracker MUST preserve the distinct confirmation-style feedback associated with that successful long-press path

### Requirement: Timer speech behavior MUST preserve static longer-timer nuance
The logger SHALL preserve that timer-mode spoken feedback is not one undifferentiated rule across all timer lengths.

#### Scenario: User starts or pauses a timer-based exercise
- **WHEN** the tracker decides whether to speak start or pause feedback for a timer interaction
- **THEN** the readable parity package MUST preserve the static nuance that spoken start or pause feedback is tied to longer-timer behavior rather than assumed for every timer interaction

### Requirement: Countdown warning thresholds MUST preserve static near-zero behavior
The logger SHALL preserve that timer countdown warnings occur at specific near-zero thresholds rather than as a vague generic effect.

#### Scenario: Timer approaches completion
- **WHEN** a timer-based logger path approaches zero
- **THEN** the tracker MUST preserve the static near-zero countdown-warning behavior, including the concrete threshold pattern used by the original timer flow

### Requirement: Milestone speech cues MUST preserve static reps-count thresholds
The logger SHALL preserve that counter-mode milestone speech is tied to concrete progress thresholds rather than generic encouragement.

#### Scenario: User counts through a reps exercise
- **WHEN** the visible reps counter advances toward the configured target
- **THEN** the tracker MUST preserve the static milestone-speech pattern for `5 reps left`, `3 reps left`, `Last rep`, and `Set complete` instead of replacing it with a different threshold system

### Requirement: Source-anchor helper names MUST remain visible for logger and Pocket verification
The logging parity package SHALL preserve the exact static helper anchors used to locate the source owners of the major logger and Pocket flows.

#### Scenario: Later parity review cross-checks logger flow ownership
- **WHEN** a later conversation needs to trace the preserved logger behaviors back to the static source
- **THEN** the canonical logging package MUST keep the source-anchor names `selectExercise()`, `selectSide()`, `showLogSetModal()`, `showNextSetModal()`, `finishSession()`, `toggleBackdate()`, `saveSession()`, `togglePocketMode()`, `updatePocketOverlay()`, `handlePocketTap()`, and `setupPocketLongPress()` visible as verification anchors rather than reducing them to unnamed intent

### Requirement: Running Pocket timer hints MUST preserve the partial-log affordance
Pocket Mode SHALL keep the running timer hint explicit when long press and short tap have different results.

#### Scenario: Timer Pocket Mode is already running
- **WHEN** Pocket Mode is active for a running timer session
- **THEN** the tracker MUST preserve the exact static running-timer hint `Tap to pause · Hold for partial`

### Requirement: Logger surfaces MUST preserve named static parts
The logging contract SHALL preserve the named parts of the counter and timer surfaces instead of describing them only as generic controls.

#### Scenario: Later migration work reconstructs logger chrome
- **WHEN** the counter and timer surfaces are rebuilt from the readable specs
- **THEN** counter mode MUST preserve the counter label, large tappable display, and minus or undo button, and timer mode MUST preserve the rep-or-duration info line, timer display, target label, start/pause button, and reset button

### Requirement: Hold timer completion MUST preserve auto-pause and target reset
The logging contract SHALL preserve the exact hold-rep completion behavior used by the static timer path.

#### Scenario: Hold timer completes one rep before the set is finished
- **WHEN** a hold countdown reaches completion while additional reps remain in the same set
- **THEN** the tracker MUST auto-pause, advance the live hold rep count, reset the timer display back to the target duration, and keep the set unaccepted until the configured rep count is satisfied or the user manually logs it

### Requirement: Next-set acceptance MUST preserve counter reset and delayed comparison timing
The logging contract SHALL preserve the post-acceptance side effects that happen after a reps set is confirmed.

#### Scenario: User confirms a reps `Next Set`
- **WHEN** `Next Set` accepts a reps-based live counter value
- **THEN** the tracker MUST reset the visible counter back to `0`, update progress immediately, and preserve the static delayed comparison-speech behavior instead of firing comparison speech in the same instant as the acceptance click

### Requirement: Zero-value logging guards MUST preserve exact copy
The logging contract SHALL preserve the exact user-facing zero-value guard copy when manual or confirmation flows block an empty set.

#### Scenario: User attempts to save a zero-value set
- **WHEN** a logging flow tries to save with no valid reps or seconds value
- **THEN** the tracker MUST preserve the guard copy `Please enter a value greater than 0`

### Requirement: Undo feedback MUST preserve removed-set identification
The logger SHALL preserve that undo feedback identifies which set was removed instead of using a generic success message.

#### Scenario: User removes the previous accepted set
- **WHEN** the user activates `previous-set` and a set is actually removed
- **THEN** the tracker MUST preserve the static success feedback that identifies the removed set number
