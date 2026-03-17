Purpose: provide a single ordered reconstruction guide for static `public/index.html` without rewriting the canonical OpenSpec artifacts in place.

## How To Use This Document

This is a companion document, not a replacement for the canonical OpenSpec artifacts.

Use it when you need one clear reading order for rebuilding static `index.html` behavior. Use the canonical files for full evidence, scenario requirements, and governance:

- [proposal.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/proposal.md)
- [design.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design.md)
- [legacy-parity-governance/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/legacy-parity-governance/spec.md)
- [tracker-shell-and-context-parity/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/tracker-shell-and-context-parity/spec.md)
- [tracker-logging-and-pocket-parity/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/tracker-logging-and-pocket-parity/spec.md)
- [tracker-messages-and-history-parity/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/tracker-messages-and-history-parity/spec.md)
- [tracker-offline-and-timing-parity/spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/tracker-offline-and-timing-parity/spec.md)

Read this guide top to bottom if `public/index.html` is unavailable. It is organized in the order an implementation agent would need to reconstruct the page.

## Reconstruction Order

1. startup and auth bootstrap
2. role and viewing-context resolution
3. shell surfaces and ownership
4. data-loading sequence
5. picker and history rendering
6. logger entry and session creation
7. active execution behavior
8. set acceptance flows
9. session finalization
10. messages and history maintenance
11. offline and recovery behavior
12. timing, invariants, and blocked states

## 1. Startup And Auth Bootstrap

- `init()` loads Supabase config from `/api/env`.
- `init()` initializes the offline manager before normal tracker use.
- `init()` installs online and offline listeners before session-dependent work.
- `init()` checks `supabaseClient.auth.getSession()`.
- if there is no session, the sign-in modal stays visible and tracker data does not load.
- if a session exists, startup sets `currentUser`, `authToken`, and `refreshToken`, hides auth UI, updates the editor link, then runs authenticated data bootstrap.
- authenticated startup runs `loadData()`, checks for new messages immediately, then starts recurring message polling every 30 seconds.
- `SIGNED_IN` repeats the authenticated bootstrap path.
- `SIGNED_OUT` clears signed-in user state, role state, patient context, therapist fallback, and thread recipient state, then returns the shell to auth.
- `PASSWORD_RECOVERY` hides normal sign-in UI and opens the new-password modal.

### Auth surfaces

- sign-in is a titleless auth card rather than a titled modal
- forgot-password modal title: `Reset Password`
- new-password modal title: `Set New Password`
- forgot-password submit text changes to `Sending...` while pending
- new-password submit text changes to `Updating...` while pending
- forgot-password success copy: `Check your email for the reset link.`
- password mismatch copy: `Passwords do not match.`
- password update success toast: `Password updated successfully!`

## 2. Role And Viewing Context Resolution

- `/api/users` is the blocking role-resolution step before tracker behavior can be trusted.
- the signed-in person is matched by `auth_id` first, then by email.
- `currentUserProfileId` and `currentUserRole` are derived from this lookup.
- `currentEmailNotifyEnabled` is also derived here and syncs the email-toggle UI.

### Role rules

- patient:
  - views their own data
  - may inherit `therapistId` from profile for message fallback
- therapist:
  - resolves a patient from assigned patients
  - loads that patient’s tracker data
  - shows the patient banner
- admin:
  - if `therapist_id` exists, behaves like a patient with therapist fallback
  - otherwise falls back to viewing some patient context

### Patient banner

- hidden by default
- shown only in therapist patient-view mode
- text begins `Viewing exercises for:`

### Missing context rule

- if no patient context can be resolved, normal authenticated tracker bootstrap does not continue

## 3. Shell Surfaces And Ownership

The static tracker is a three-view shell:

- `picker`
- `logger`
- `history`

Only `picker` and `history` own top nav-tab state. `logger` is outside the tab navigation model.

### Header

- title: `PT Tracker`
- connectivity indicator
- sync badge
- hamburger trigger

### Primary views

- picker:
  - search input with placeholder `Search exercises...`
  - exercise list container
- logger:
  - exercise name
  - dosage summary
  - side-tracking block
  - counter or timer surface
  - progress block
  - control row with `Previous`, `Log Set`, `Next Set`
  - `Done`
  - `Pocket Mode`
  - back-to-exercises button
- history:
  - history list container

### Modal and overlay surfaces

- auth modal
- forgot-password modal
- new-password modal
- exercise-details modal
- log-set modal
- next-set modal
- notes modal
- messages modal
- edit-session modal
- Pocket Mode overlay

Pocket Mode is a fullscreen overlay, not a separate route.

## 4. Data-Loading Sequence

Authenticated shell bootstrap follows this order:

1. resolve user/profile/role/patient context from `/api/users`
2. configure role-sensitive hamburger actions
3. fetch programs from `/api/programs?patient_id=...`
4. transform program data into exercise display data
5. load history from `/api/logs?include_all=true&limit=1000&patient_id=...`
6. render history first
7. render exercises second so adherence is correct on first picker paint
8. hydrate offline cache in the background

### Offline-first exceptions

- if the browser is offline and IndexedDB cache exists, the tracker renders from cache instead of pretending live data is available
- offline cached startup shows `Offline mode`
- if online API load fails but cache exists, the tracker falls back to cache and shows `Using cached data`
- if no live data and no cache exist, the exercise shell shows a failed-load state

## 5. Picker And History Rendering

### Exercise cards

- archived exercises are filtered out
- each card contains:
  - details button
  - exercise name
  - dosage summary
  - adherence summary
  - optional category tag

### Exercise details modal

May include:

- description
- pattern pill
- primary muscles
- secondary muscles
- required equipment
- optional equipment
- external cues
- motor cues
- compensation warnings
- safety flags

Fallback copy when no details exist:

- `No additional details available for this exercise.`

### Adherence rules

- adherence uses local-midnight day bucketing, not rolling hours
- zero prior sessions: `Never done`
- same local calendar day: `Done today`
- 1 to 3 days: green `N day(s) ago`
- 4 to 7 days: orange warning `N days ago`
- more than 7 days: red warning `N days ago`

### History cards

Each card shows:

- performed date and time
- exercise name
- set summary
- first-set form-parameter summary when present
- inline quoted notes preview when present

Cards are clickable maintenance entry points into edit-session flow.

### Important empty and failed states

- exercise picker empty: `No active exercises.`
- search empty: `No exercises found.`
- history empty: `No history yet. Start logging exercises!`
- exercise load failure: `Failed to load exercises. Check your connection.`
- history load failure: `Failed to load history.`

## 6. Logger Entry And Session Creation

Selecting an exercise immediately creates an in-progress session before any final save.

### `currentSession` creation

`currentSession` starts with:

- generated `sessionId`
- `exerciseId`
- `exerciseName`
- derived `activityType`
- empty `sets`
- session timestamp in ISO format

### Activity type derivation

- `distance_feet` modifier or `dosage_type === 'distance'` => distance
- `hold_seconds` modifier or `dosage_type === 'hold'` => hold
- `duration_seconds` modifier or `dosage_type === 'duration'` => duration
- otherwise => reps

### Side defaults

- sided exercise means `pattern === 'side'`
- sided exercises:
  - show side controls
  - default active side to right
  - show left/right progress rows
- bilateral exercises:
  - hide side controls
  - set `currentSide = null`
  - show single combined progress row

### Mode selection

- hold and duration exercises open timer mode directly
- reps-style exercises open counter mode directly

## 7. Active Execution Behavior

### Counter mode

- opens with visible count `0`
- main tap surface increments visible reps immediately
- decrement never goes below zero
- every tap produces a soft beep
- milestone speech mirrors old-app thresholds:
  - `5 reps left`
  - `3 reps left`
  - `Last rep`
  - `Set complete`

### Timer mode

- counts down from the target, not up from zero
- start button becomes pause while running
- reset returns the display to full target time
- reset clears only live timer progress, not already accepted sets
- countdown beeps happen at 3, 2, 1

### Hold behavior

- hold tracks rep progress inside timer mode
- completing a timed rep advances `timerState.currentRep`
- hold completion speech mirrors counter thresholds at key remaining counts
- hold does not create a completed set until the configured rep count for that set is satisfied or the user manually logs it

### Duration behavior

- duration uses one long timer
- completion becomes one set with `reps = 1` and captured seconds

### Side switching

- updates active side button state
- updates visible label to `Working [side] side`
- speaks the same side change aloud

## 8. Pocket Mode

- only opens when an exercise session is active
- controls the same `currentSession`, not a separate session
- closes back to the normal logger without saving, cancelling, or replacing the session

### Counter Pocket Mode

- large tap pad
- label shows current count
- meta shows sets left and reps left
- hint says `Tap to count`

### Timer Pocket Mode

- label mirrors the live timer display
- meta shows current rep, total reps, sets left, and running or paused state
- hint says:
  - `Tap to start` when paused
  - `Tap to pause · Hold for partial` when running

### Pocket interactions

- tap in counter mode => increment counter
- tap in timer mode => start or pause timer
- timer-mode long press uses a 700ms threshold
- long press is partial-hold behavior only
- releasing early cancels long-press behavior and falls back to normal tap
- successful long press emits a distinct confirmation beep

## 9. Set Acceptance Flows

Live counter or timer state is not the same thing as an accepted set. A set is only accepted when one of the set-writing flows appends it to `currentSession.sets`.

### `Next Set`

- summarizes the live logger value against the target
- can show form parameters that will be logged
- can show side summary for sided exercises
- offers:
  - cancel
  - edit
  - confirm

Confirm behavior:

- timer duration => one rep with captured seconds
- timer hold => reps equal current hold progress and seconds equal target seconds
- counter => reps from current visible counter
- writes a new set into `currentSession.sets`
- accepted-set payload keeps:
  - `set_number`
  - normalized `reps`
  - normalized `seconds`
  - `distance_feet: null`
  - side from modal-local choice or active tracker side when sided
  - optional normalized `form_data`
  - `partial_rep: false`
  - fresh `performed_at`
  - `manual_log` set according to whether the write came from live confirmation versus manual entry
- resets timer or counter live state for the next set
- updates progress immediately
- may schedule delayed comparison speech against prior history

### `Log Set`

- manual-entry path
- prefills from target dose, not from live counter display
- sided exercises show a dedicated side selector inside the modal
- form parameters are populated from history-aware defaults

Manual validation rules:

- zero value blocks save with `Please enter a value greater than 0`
- manual hold entry also requires seconds-per-rep or blocks with `Please enter seconds per rep`

Manual hold behavior:

- if hold modal is used with reps and time fields visible, it creates a complete set directly

Timer-mode manual hold behavior:

- if user logs a timed rep before full hold set completion, the timer can advance rep progress without creating the final set yet
- mid-hold progress toast uses `Rep N complete`

### Undo

- `Previous` removes the most recent accepted set
- updates progress immediately
- if there is nothing to undo, shows `No sets to undo`

## 10. Session Finalization

### Finish gate

- `Done` is blocked until at least one set has been accepted
- blocked finish copy: `Please log at least one set before finishing`

### Notes modal

- opens after `Done`
- contains notes textarea
- contains `Change Date/Time`
- contains cancel and save actions

### Backdate behavior

- hidden by default
- when opened, defaults to the session start time in local datetime format
- warning appears only when selected time differs from session start by more than 2 minutes
- warning copy: `Date/time changed from now. Session will be logged at the selected time.`

### Cancel behavior

- cancelling from notes requires confirmation
- confirmed cancel discards the active session and returns to picker

### Save behavior

- save is queue-first, even when online
- session is pushed into offline queue first
- queue UI updates immediately
- sync is attempted after queue update
- backdate rewrites `currentSession.date`
- backdate also rewrites each set `performed_at`
- local history is prepended immediately after save so picker adherence can show `Done today` right away
- save clears notes UI, closes notes modal, clears `currentSession`, clears `currentExercise`, and returns to picker

Save toast copy:

- `Saved (with notes)`
- `Saved (no notes)`

### Explicit abandon path

- using the logger back-to-exercises action abandons the active session
- it clears `currentSession` and `currentExercise`
- it does not silently keep the session alive

## 11. Messages And History Maintenance

### Messages entry

- messages is a tracker-owned hamburger action
- opening messages closes the hamburger first
- then yields one animation frame before opening the modal
- then loads messages
- then marks received messages as read in two places:
  - locally via `lastReadMessageTime`
  - best-effort server PATCH for unread received messages
- then clears the badge

### Recipient fallback

- first choice: existing thread participant
- patient or admin-in-patient-mode fallback: `therapistId`
- therapist fallback: `viewingPatientId`

Blocked states:

- no signed-in user trying to send => `Please sign in to send messages`
- blank message => `Please enter a message`
- missing recipient => `No therapist assigned. Cannot send message.`
- self-send block => `Cannot send a message to yourself.`

### Messages modal behavior

- empty state: `No messages yet. Send a message to your PT!`
- failed load state: `Failed to load messages`
- sent messages show `Delivered` or `Read ...`
- messages can be hidden with `Hide`
- recent sent messages can be deleted with `Undo Send`
- undo-send requires confirmation:
  - `Delete this message? It will be removed for both you and your PT.`

### History maintenance

- history cards open edit-session modal
- modal shows:
  - exercise name
  - sided indicator when applicable
  - editable datetime
  - editable sets list
  - add-set action
  - notes
  - delete-session action
- set editor shape depends on exercise type:
  - reps
  - seconds
  - distance
  - side
  - form parameters
- empty set list copy: `No sets logged`

### Edit-session persistence

- save uses PATCH `/api/logs?id=...`
- save success feedback: `Session updated`
- delete uses DELETE `/api/logs?id=...`
- delete requires confirmation:
  - `Are you sure you want to delete this entire session? This cannot be undone.`

## 12. Offline And Recovery Behavior

### Queue model

- unsaved or unsynced sessions live in localStorage queue `pt_offline_queue`
- sync badge reflects unsynced count
- empty manual sync shows `Nothing to sync!`

### Automatic recovery

- when browser returns online:
  - connectivity state updates first
  - queue sync runs if auth and patient context exist
  - only if user is on picker does full `loadData()` rerun
  - otherwise cache hydration happens silently in background

### Sync semantics

- sync posts sessions to `/api/logs`
- `client_mutation_id` is the session id
- `409` duplicate response counts as success and removes the queued session
- after sync, history reloads and cache hydration runs

### Migration logic in queue load

- old queue entries are migrated on load
- special legacy hold bug:
  - multiple old sets with null reps and seconds are collapsed into one hold set
- migrated queue is saved back to localStorage

## 13. Timing, Invariants, And Blocked States

### Time semantics

- `Done today` means same local calendar day after midnight truncation
- it is not based on rolling elapsed hours
- authenticated startup message polling happens immediately, then every 30 seconds
- toasts animate in after a short timeout and remove after duration plus fade-out delay

### Important state invariants

- `currentSession` exists as soon as an exercise is selected
- `currentExercise` and `currentSession` clear on:
  - explicit logger abandonment
  - confirmed notes cancel
  - successful save
- bilateral exercises use `currentSide = null`
- sided exercises default to right until changed
- local history mutates immediately after save, before any eventual server refetch is required for picker adherence

### Important blocked and failure states

- finish with zero sets
- no sets to undo
- missing patient context
- missing message recipient fallback
- failed exercise load
- failed history load
- failed messages load
- zero or invalid manual entry
- password confirmation mismatch
- authless attempts to use authenticated tracker flows

## 14. API Contract Summary

### Startup and shell

- `GET /api/env`
- `GET /api/users`
- `GET /api/programs?patient_id=...`
- `GET /api/logs?include_all=true&limit=1000&patient_id=...`

### Sessions and history

- `POST /api/logs`
- `PATCH /api/logs?id=...`
- `DELETE /api/logs?id=...`

### Messages

- `GET /api/logs?type=messages`
- `POST /api/logs?type=messages`
- `PATCH /api/logs?type=messages&id=...`
- `DELETE /api/logs?type=messages&id=...`

### User preferences

- `PATCH /api/users` for email notification toggle

## 15. Source Coverage Anchor

This guide was organized from a full sequential read of the current static file in this checkout.

Current source length used for this companion guide:

- `public/index.html`: `4590` lines

For contiguous source-chunk evidence and live carry-forward mapping, see:

- [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md)
- [coverage-matrix.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/coverage-matrix.md)
