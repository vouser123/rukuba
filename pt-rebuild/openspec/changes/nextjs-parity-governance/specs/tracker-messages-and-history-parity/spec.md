## ADDED Requirements

### Requirement: Tracker-owned messages MUST remain an index-shell flow
The tracker SHALL preserve messages as a shell-owned flow entered from tracker actions rather than by leaving the tracker route.

#### Scenario: User opens messages from the tracker shell
- **WHEN** the user triggers the tracker messages action
- **THEN** the shell MUST preserve tracker-owned messages entry, close the hamburger first, yield a frame, and only then open the messages modal

### Requirement: Messages modal MUST preserve static load and read behavior
The messages flow SHALL preserve the static modal-open sequence and read-state side effects.

#### Scenario: Messages modal opens successfully
- **WHEN** the user opens the messages modal while signed in
- **THEN** the tracker MUST sync the email-notification toggle to current preference, load the conversation, update local `lastReadMessageTime`, best-effort mark received messages as read server-side, and clear the unread badge

### Requirement: Messages open sequence MUST preserve the static paint-separation step
The tracker SHALL preserve the explicit separation between closing the hamburger and painting the messages modal.

#### Scenario: User opens tracker-owned messages
- **WHEN** the shell transitions from hamburger menu to messages modal
- **THEN** the tracker MUST preserve the static close-menu, yield-a-frame, then-open-modal sequence instead of replacing those UI states in one undifferentiated step

### Requirement: Message unread badge MUST preserve static local-time semantics
The shell SHALL preserve the static badge model used outside the messages modal.

#### Scenario: Shell checks for new messages
- **WHEN** the tracker performs immediate or polled message freshness checks
- **THEN** it MUST compare incoming messages from the other participant against local `lastReadMessageTime`, infer the unread count from that comparison, and show or hide the badge accordingly

### Requirement: Message recipient routing MUST preserve static role-aware fallback
The messages flow SHALL preserve the same recipient resolution logic as the static tracker.

#### Scenario: User sends a message from tracker-owned flow
- **WHEN** the tracker chooses the recipient for an outgoing message
- **THEN** it MUST prefer the current thread participant first, fall back to assigned therapist for patient or admin patient-mode, and fall back to the viewed patient for therapist mode

### Requirement: Message send guards MUST preserve static blocked states
The messages flow SHALL preserve static send validation and its visible failure states.

#### Scenario: User attempts an invalid send
- **WHEN** the user tries to send an empty message, send while unauthenticated, send without recipient context, or send to self
- **THEN** the tracker MUST preserve the same blocked behavior and visible failures such as `Please enter a message`, `Please sign in to send messages`, `No therapist assigned. Cannot send message.`, and `Cannot send a message to yourself.`

### Requirement: Messages modal MUST preserve static visible content states
The messages flow SHALL preserve the same message-list states and copy used by the static tracker.

#### Scenario: Messages list renders conversation state
- **WHEN** the messages modal renders empty, failed, sent, received, hidden, or recently sent states
- **THEN** it MUST preserve empty-state copy `No messages yet. Send a message to your PT!`, failed-load copy `Failed to load messages`, sender labels `You → PT` and `PT → You`, `Delivered` state for unread sent messages, `Read ...` state when a read timestamp exists, and the `Hide` and `Undo Send` affordances

### Requirement: Messages modal composition MUST preserve static shell grouping
The messages flow SHALL preserve the visible structure of the tracker-owned messages surface.

#### Scenario: Messages modal is reconstructed from readable docs
- **WHEN** the messages modal is rebuilt
- **THEN** it MUST remain a modal with a scrollable message list, composer textarea, email-notification checkbox row, and cancel/send actions rather than an arbitrary alternate layout

### Requirement: Email-notification checkbox MUST preserve direct change behavior
The tracker SHALL preserve that the email-notification preference is updated from a direct checkbox change path instead of a separate submit action.

#### Scenario: User toggles email notifications from messages
- **WHEN** the email-notification checkbox changes
- **THEN** the tracker MUST preserve the direct change-driven save path, including immediate preference update attempt, success or failure feedback, and checkbox revert on failure

### Requirement: Message state inventory MUST preserve thread and read-cutoff meaning
The messages contract SHALL preserve the local state that makes unread badges and recipient fallback work.

#### Scenario: Agent reconstructs tracker-owned message state
- **WHEN** a migration agent rebuilds message behavior from the readable parity package
- **THEN** the contract MUST preserve the meanings of `threadRecipientId` as the current thread counterpart when known and `lastReadMessageTime` as the local unread cutoff updated when the messages modal opens

### Requirement: Undo send and hide MUST preserve static destructive behavior
The messages flow SHALL preserve the static difference between hide and undo-send actions.

#### Scenario: User hides or undoes a sent message
- **WHEN** the user chooses `Hide` or `Undo Send`
- **THEN** `Hide` MUST archive the message and refresh the modal, while `Undo Send` MUST remain limited to the recent undo window, ask for confirmation, delete the message for both participants, and show the same success or failure feedback as the static tracker

### Requirement: Undo-send confirmation copy MUST preserve static destructive intent
The messages flow SHALL preserve the explicit confirmation guidance used before removing a sent message for both participants.

#### Scenario: User chooses `Undo Send`
- **WHEN** the tracker asks the user to confirm message deletion
- **THEN** the confirmation MUST preserve the static destructive intent that the message will be removed for both the user and the PT, not hidden only locally

### Requirement: Undo-send confirmation wording MUST remain close to static guidance
The messages flow SHALL preserve the specific destructive-confirmation wording direction used before deleting a sent message.

#### Scenario: User is shown the undo-send confirmation dialog
- **WHEN** the tracker prompts for confirmation before removing a sent message
- **THEN** the wording MUST preserve the exact static confirmation copy `Delete this message? It will be removed for both you and your PT.`

### Requirement: Undo-send availability MUST preserve static recent-window behavior
The tracker SHALL preserve that `Undo Send` is not universally available for all sent messages.

#### Scenario: Sent message is rendered in the conversation
- **WHEN** the shell decides whether to show `Undo Send`
- **THEN** the affordance MUST remain limited to the recent static undo window rather than appearing for older sent messages

### Requirement: Message API method usage MUST preserve static request patterns
The messages flow SHALL preserve the same request types used by the static tracker for different message actions.

#### Scenario: Tracker performs message operations
- **WHEN** the tracker loads, sends, archives, marks read, or deletes messages
- **THEN** it MUST preserve GET for load and polling, POST for send, PATCH for read/archive updates, and DELETE for undo-send behavior

### Requirement: Email-notification toggle MUST preserve static preference behavior
The tracker SHALL preserve the messages modal's email-preference workflow.

#### Scenario: User toggles email notifications
- **WHEN** the user changes the email-notification checkbox inside the messages modal
- **THEN** the tracker MUST PATCH `/api/users`, keep the checkbox synchronized with the locally resolved `currentEmailNotifyEnabled` value on success, show success or failure feedback, and revert the checkbox on failure rather than refetching preference state first

### Requirement: Message polling MUST preserve static cadence
The tracker SHALL preserve the message freshness cadence tied to signed-in tracker use.

#### Scenario: User remains signed in on the tracker shell
- **WHEN** authenticated tracker bootstrap completes
- **THEN** the tracker MUST check messages immediately and continue polling every 30 seconds while signed in

### Requirement: History cards MUST preserve maintenance-entry behavior
The history surface SHALL preserve static history cards as the entry point for session maintenance.

#### Scenario: User selects a history card
- **WHEN** the user opens a saved session from history
- **THEN** the tracker MUST open edit-session maintenance with that session's date, notes, set data, and exercise context rather than treating history as read-only

### Requirement: History summary copy MUST preserve static preview behavior
The history surface SHALL preserve the summary-style copy that lets the user understand a session before opening maintenance.

#### Scenario: User scans history cards from the list view
- **WHEN** history cards are rendered
- **THEN** the tracker MUST preserve set summary text, first-set parameter preview when available, performed timestamp, exercise title, and optional notes preview so the list remains informative without opening edit mode

### Requirement: Edit-session modal MUST preserve static field composition
The edit-session flow SHALL preserve the same editable fields and empty-state behavior as the static tracker.

#### Scenario: Edit-session modal renders a session
- **WHEN** the edit-session modal opens
- **THEN** it MUST preserve exercise identity, datetime field, notes field, editable set rows, add-set entry, delete-session action, and `No sets logged` when the session shell exists but the set list is empty

### Requirement: Edit-session field set MUST preserve exercise-type sensitivity
The edit-session flow SHALL preserve which per-set fields appear for different exercise types.

#### Scenario: Edit-session renders set fields
- **WHEN** the edit-session modal renders the set list for reps, hold, duration, distance, and sided exercises
- **THEN** it MUST preserve `Reps` for all sets, `Seconds` or `Seconds/rep` for hold or duration sets, `Distance (ft)` for distance sets, `Side` only for sided sets, and set-level form-parameter editing only when `form_data` exists, with sided detection preserved from either the exercise definition or the saved set data

### Requirement: Edit-session maintenance MUST preserve static session-shell oddities
The history maintenance flow SHALL preserve edge cases visible in the static tracker even when they are uncommon.

#### Scenario: Existing session opens with no remaining sets
- **WHEN** the edit-session modal opens for a session shell whose set array is empty
- **THEN** the tracker MUST preserve the explicit `No sets logged` maintenance state instead of hiding the modal or assuming the session cannot exist

### Requirement: Added and deleted edit-session sets MUST preserve static defaults
The edit-session flow SHALL preserve how the static tracker seeds and renumbers maintained sets.

#### Scenario: User adds or deletes a set during session maintenance
- **WHEN** the user adds or deletes a set in the edit-session modal
- **THEN** newly added sets MUST be seeded from exercise defaults, default sided sets to right, stamp a fresh `performed_at`, and deleted sets MUST trigger `set_number` renumbering before rerendering

### Requirement: Edit-session save MUST preserve whole-session patch behavior
The edit-session flow SHALL preserve the static patch model that saves whole-session changes together.

#### Scenario: User saves from edit-session maintenance
- **WHEN** the user saves an edited session
- **THEN** the tracker MUST PATCH `/api/logs?id=...`, save the session timestamp, notes, and edited sets together as one save action, show the success feedback `Session updated`, and reload history afterward

### Requirement: Edit-session delete MUST preserve explicit destructive confirmation
The history maintenance flow SHALL preserve the static destructive delete guard for full-session removal.

#### Scenario: User deletes a saved session
- **WHEN** the user chooses delete inside the edit-session modal
- **THEN** the tracker MUST ask for explicit confirmation before deleting the entire session, DELETE `/api/logs?id=...`, preserve the success or failure feedback used by the static tracker including `Session deleted` success feedback, and reload history after a successful delete

### Requirement: Session-delete confirmation copy MUST preserve static destructive intent
The history maintenance flow SHALL preserve the explicit confirmation guidance that whole-session deletion cannot be undone.

#### Scenario: User confirms deletion of a saved session
- **WHEN** the tracker prompts for whole-session delete confirmation
- **THEN** the confirmation MUST preserve the static destructive intent that the entire session will be removed and cannot be undone

### Requirement: Session-delete confirmation wording MUST remain close to static guidance
The history maintenance flow SHALL preserve the specific destructive-confirmation wording direction used before removing a whole saved session.

#### Scenario: User is shown the delete-session confirmation dialog
- **WHEN** the tracker asks for confirmation before deleting a saved session
- **THEN** the wording MUST preserve the exact static confirmation copy `Are you sure you want to delete this entire session? This cannot be undone.`

### Requirement: Messages modal close MUST preserve static return behavior
The messages flow SHALL preserve the concrete close semantics of the tracker-owned messages modal.

#### Scenario: User closes messages without sending or changing anything
- **WHEN** the user triggers `close-messages-modal`
- **THEN** the tracker MUST dismiss the modal opened by `showMessagesModal()` and return the user to the same underlying tracker shell state without changing the current picker, logger, or history ownership

### Requirement: Edit-session modal close MUST preserve static return behavior
The history maintenance flow SHALL preserve the concrete close semantics of the edit-session modal.

#### Scenario: User closes edit-session maintenance without saving
- **WHEN** the user triggers `close-edit-session-modal`
- **THEN** the tracker MUST dismiss the maintenance modal, return the user to the underlying history view without applying edits, and leave the previously rendered history list in place until an explicit save or delete occurs

### Requirement: Source-anchor helper names MUST remain visible for messages verification
The messages parity package SHALL preserve the exact static helper anchor used to locate the tracker-owned messages flow in source.

#### Scenario: Later parity review cross-checks message-flow ownership
- **WHEN** a later conversation needs to trace tracker-owned messages behavior back to the static source
- **THEN** the canonical messages package MUST keep the source-anchor name `showMessagesModal()` visible as the owner of the modal-open flow rather than reducing it to unnamed modal behavior

### Requirement: Message delete and undo flows MUST preserve both-participant impact
The messages contract SHALL keep explicit that destructive message actions affect the shared conversation, not only the local sender view.

#### Scenario: User sees or confirms destructive message behavior
- **WHEN** the tracker shows hide or undo-send behavior for a recent outgoing message
- **THEN** the package MUST preserve that destructive message actions are explained as affecting both participants, including wording close to `Delete this message? It will be removed for both you and your PT.`

### Requirement: Message API contract MUST preserve exact endpoint signatures
The messages contract SHALL keep the tracker-owned message request surfaces readable to later migration work.

#### Scenario: Later migration planning maps message API work
- **WHEN** a later conversation turns messages parity into implementation or Beads work
- **THEN** the canonical messages package MUST continue surfacing `GET /api/logs?type=messages`, `POST /api/logs?type=messages`, `PATCH /api/logs?type=messages&id=...`, `DELETE /api/logs?type=messages&id=...`, and `PATCH /api/users` for email preferences as the baseline request signatures

### Requirement: Message send success MUST preserve toast-and-refresh behavior
The messages flow SHALL preserve that a successful send both confirms success and refreshes the rendered thread.

#### Scenario: User sends a tracker-owned message successfully
- **WHEN** the send request succeeds
- **THEN** the tracker MUST preserve both the static send-success toast behavior and the immediate message-list refresh that shows the outgoing message in context

### Requirement: Email preference syncing MUST preserve static local-source behavior
The messages flow SHALL preserve where the checkbox state comes from after a successful preference update.

#### Scenario: User toggles email notifications
- **WHEN** the email-notification update succeeds
- **THEN** the tracker MUST keep the checkbox synchronized from the locally resolved `currentEmailNotifyEnabled` state rather than requiring a separate refetch before the UI can trust the new value

### Requirement: Edit-session sided detection MUST preserve exercise-and-set fallback
The history maintenance flow SHALL preserve the static rule that sidedness can be inferred from more than one source.

#### Scenario: Edit-session renders a saved set with side data
- **WHEN** edit-session maintenance decides whether side fields should render
- **THEN** the tracker MUST preserve sided detection from either the exercise definition or the saved set data rather than relying on only one of those signals

### Requirement: Session delete success MUST preserve named toast feedback
The history maintenance flow SHALL preserve the named success feedback used after removing a session.

#### Scenario: User deletes a saved session successfully
- **WHEN** the delete request succeeds
- **THEN** the tracker MUST preserve the `Session deleted` success toast followed by history reload
