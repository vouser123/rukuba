Purpose: define the reconstruction design for static `public/index.html` so migration work can be checked against one ordered, behavior-first contract.

## Design Goal

This design document is for agents who need to rebuild or delta-check the static tracker without relying on direct access to `public/index.html` or runtime discovery.

It is intentionally shorter and more ordered than the source harvest. The source harvest still exists and should be treated as supporting evidence:

- [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md)
- [index-reconstruction-guide.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/index-reconstruction-guide.md)
- [spec.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/specs/index-logging-parity/spec.md)

This file preserves the earlier baseline-focused design surface. `design-extract.md` is the large harvest record.

## Design Principles

- behavior first, not file structure first
- reconstruction order matters more than implementation ownership
- role and viewing context are part of tracker behavior, not background setup
- save, offline, timing, and copy are functional parity domains
- runtime testing should validate the docs, not discover missing flow truth

## Reading Order

Use this order when rebuilding the tracker:

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

The tracker boots as an auth-gated single-page shell.

### Required startup order

1. load Supabase config from `/api/env`
2. initialize offline manager
3. install online and offline listeners
4. inspect current auth session
5. if unauthenticated, show sign-in flow and stop authenticated tracker bootstrap
6. if authenticated, set user and token state
7. hide auth UI
8. update editor-link auth propagation
9. run tracker data bootstrap
10. check messages immediately
11. start 30-second message polling
12. load offline queue and bind interaction handlers

### Auth-state branches

- `PASSWORD_RECOVERY`
  - hide normal auth surfaces
  - show new-password flow
- `SIGNED_IN`
  - restore authenticated state
  - rerun tracker bootstrap
- `SIGNED_OUT`
  - clear user, token, role, profile, therapist, patient-thread, and related session state
  - return to sign-in surface

### Auth UX contract

- auth exists as three separate modal surfaces:
  - sign in
  - forgot password
  - new password
- pending button text is part of the behavior contract:
  - `Sending...`
  - `Updating...`
- inline success and error text is part of the behavior contract

## 2. Role And Viewing Context Resolution

Before exercise or history behavior can be trusted, the tracker resolves who the user is in app terms and whose data the shell is acting on.

### Blocking context resolution

- `/api/users` runs before programs or history are treated as valid
- the current app user is matched by auth id or email
- this lookup sets:
  - `currentUserProfileId`
  - `currentUserRole`
  - `viewingPatientId`
  - `therapistId`
  - email-notification preference state

### Role behavior

- patient
  - views own tracker data
  - may use assigned therapist as message fallback
- therapist
  - views a patient context, not therapist-self tracker data
  - shows patient banner
- admin
  - may behave like a patient if linked to a therapist
  - otherwise falls back to a patient-viewing context

### Design requirement

The shell must not proceed with ambiguous tracker ownership. Missing patient context is a startup failure, not a soft warning.

## 3. Shell Surfaces And Ownership

The static tracker is a single-page shell with three views and multiple modal subflows.

### Top-level shell

- header
  - title
  - connectivity indicator
  - sync badge
  - hamburger trigger
- patient banner
  - hidden by default
  - shown only for therapist patient-view mode
- nav tabs
  - `Exercises`
  - `History`

### Views

- `picker`
  - search
  - exercise list
- `logger`
  - exercise identity
  - dosage
  - side controls when sided
  - counter or timer surface
  - progress block
  - control row
  - `Done`
  - `Pocket Mode`
  - back-to-exercises action
- `history`
  - session list

### Modal and overlay subflows

- exercise details
- log set
- next set
- notes
- messages
- edit session
- Pocket Mode overlay

Pocket Mode remains part of logger flow. It is not a separate page.

## 4. Data-Loading Sequence

Authenticated data load follows a fixed sequence because picker adherence depends on it.

### Sequence

1. resolve role and patient context
2. fetch programs for the viewed patient
3. transform programs into exercise display records
4. load history
5. render history
6. render exercise list with adherence
7. hydrate offline cache in the background

### Design implication

History is not optional prework. It is part of first-render picker correctness because adherence labels depend on it.

## 5. Picker And History Rendering

### Picker design

Each exercise card must preserve:

- details button
- exercise name
- dosage text
- adherence text and bucket
- optional category tag

Archived exercises are not shown.

### History design

Each history card must preserve:

- date and time
- exercise name
- set summary
- first-set parameter preview when present
- inline notes preview when present

Each history card is also the entry point for session maintenance.

### Empty and failed states

These are part of functional behavior, not polish:

- no active exercises
- no exercises found
- no history yet
- failed to load exercises
- failed to load history

## 6. Logger Entry And Session Creation

Selecting an exercise is the point where the shell creates an in-progress session.

### On exercise selection

- set `currentExercise`
- derive `activityType`
- create `currentSession`
- write session id
- write exercise identity
- start with empty set list
- stamp initial session date
- configure side state
- choose counter or timer mode
- enter logger view

### Side model

- sided exercises:
  - show side controls
  - default to right
  - use left/right progress rows
- bilateral exercises:
  - hide side controls
  - set `currentSide = null`
  - use shared progress row

## 7. Active Execution Behavior

### Counter path

- main tap increments visible count immediately
- decrement is bounded at zero
- per-tap feedback and milestone speech are part of parity

### Timer path

- timer counts down from target
- start toggles into pause while running
- reset clears only live timer progress
- countdown warnings and completion sound are part of parity

### Hold vs duration

- hold uses timed reps inside a set
- duration uses one long timed run
- hold may advance live rep progress without yet creating a final set
- duration confirms as one set with captured seconds

### Side and audio behavior

- side switches update label and speech
- speech queue clearing matters for repeated announcements
- audio readiness is unlocked on first body interaction

## 8. Pocket Mode

Pocket Mode is an alternate interaction surface for the same active logger session.

### Entry and exit

- can only open when an exercise session is already active
- closes back to logger without saving or cancelling

### Counter Pocket Mode

- large tap pad increments counter
- shows current count
- shows reps left and sets left

### Timer Pocket Mode

- mirrors live timer display
- shows current rep, total reps, sets left, and running state
- tap starts or pauses timer

### Long press

- timer-only behavior
- 700ms threshold
- partial-hold path
- early release falls back to normal tap

## 9. Set Acceptance Flows

Accepted sets are explicit writes into `currentSession.sets`. Live progress alone is not enough.

### `Next Set`

- summarizes live logger value against target
- can display parameter summary
- can display side summary
- can cancel, edit, or confirm
- confirm writes the accepted set and resets live state for the next one

### `Log Set`

- manual-entry path
- prefilled from target dose, not live counter state
- can show dedicated side selector
- can show form parameter defaults from history
- enforces non-zero validation

### Parameters

- use exercise-local history
- use global history
- use most recent session-local override when present
- `Other...` reveals custom text input

### Undo

- removes most recent accepted set
- updates progress immediately
- must fail explicitly when nothing can be undone

## 10. Session Finalization

### Finish gate

- `Done` is blocked until at least one set exists

### Notes and backdate

- notes modal is the finalization step
- backdate defaults from session start time
- backdate warning appears only beyond the 2-minute threshold

### Save design

- queue first
- then attempt sync
- then update local history immediately
- then clear active session state
- then return to picker

### Cancel design

- notes cancel requires explicit confirmation
- confirmed cancel discards current session state

### Abandon design

- logger back-to-exercises abandons the active session
- no silent preservation

## 11. Messages And History Maintenance

### Messages

- opened from tracker-owned hamburger action
- menu closes before modal opens
- a frame yield separates menu close from modal open
- opening messages loads thread state, marks read locally, best-effort marks read server-side, and clears badge

### Recipient routing

- thread participant first
- therapist fallback for patient/admin patient-mode
- viewed patient fallback for therapist mode

### Message state contract

- empty state
- failed state
- delivered state
- read receipt state
- hide action
- undo-send action with explicit confirmation

### History maintenance

- history cards open edit-session modal
- edit-session supports:
  - datetime change
  - notes change
  - set field edits
  - add set
  - delete set
  - delete full session

## 12. Offline And Recovery Behavior

### Offline startup

- may render from cache
- must say so explicitly

### Sync badge

- reflects queue count and connectivity state

### Reconnect sequence

1. online state flips
2. queue sync runs if auth and patient context exist
3. if user is on picker, full load reruns
4. otherwise cache hydration runs silently

### Duplicate-safe sync

- duplicate response is treated as sync success
- duplicate item is removed from queue

### Queue migration

- old queue items are migrated on load
- old hold bug gets special collapse handling

## 13. Timing, Invariants, And Blocked States

### Time semantics

- `Done today` means same local calendar day after midnight truncation
- polling happens immediately after authenticated bootstrap, then every 30 seconds
- backdate rewrites session and set timestamps

### State invariants

- `currentSession` exists immediately after exercise selection
- bilateral exercises use `currentSide = null`
- sided exercises default right
- local history prepends immediately after save
- `currentSession` and `currentExercise` clear on abandon, confirmed discard, and successful save

### Blocked and failure states

- finish with zero sets
- no sets to undo
- missing patient context
- missing message recipient
- invalid manual value
- failed exercise load
- failed history load
- failed message load
- password mismatch
- unauthenticated data action attempts

## API Summary

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

- `PATCH /api/users`

## Source Anchor

This preserved baseline design is supported by:

- [design-extract.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/design-extract.md)
- [index-reconstruction-guide.md](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/openspec/changes/nextjs-parity-governance/index-reconstruction-guide.md)

The supporting harvest was taken from a full sequential read of the current static source in this checkout:

- `public/index.html`: `4590` lines
