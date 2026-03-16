## ADDED Requirements

### Requirement: Offline startup MUST preserve static shell behavior
The tracker SHALL preserve the static differences between online startup, offline cached startup, and unrecoverable startup failure.

#### Scenario: Tracker starts without usable network
- **WHEN** the tracker boots without network or when online loads fail
- **THEN** it MUST preserve offline fallback from cache when suitable cached tracker data exists, show explicit feedback such as `Offline mode` or `Using cached data`, and preserve explicit failed-load behavior when cache cannot reconstruct the tracker shell

### Requirement: Offline queue MUST preserve static queue-first save semantics
The tracker SHALL preserve the static rule that session save succeeds locally first and sync happens after.

#### Scenario: User saves a session while online or offline
- **WHEN** the user completes final session save
- **THEN** the tracker MUST push the session into the offline queue first, update sync UI immediately, and only then attempt network sync instead of treating network success as the first visible save event

### Requirement: Final save order MUST preserve the full static session-write sequence
The tracker SHALL preserve the exact user-visible save ordering that static `index.html` uses during completed-session save.

#### Scenario: User confirms notes modal save
- **WHEN** the tracker performs the completed-session save flow
- **THEN** it MUST preserve this order: trim notes, apply backdate when present, queue the session, update sync badge, attempt immediate sync, prepend the session into local history, clear active tracker state, return to picker, rerender adherence, and finally show `Saved (with notes)` or `Saved (no notes)` feedback

### Requirement: Sync badge MUST preserve shell-visible queue state
The tracker SHALL preserve static sync-status feedback tied to queue size and connectivity.

#### Scenario: Queue contents or connectivity changes
- **WHEN** the offline queue grows, shrinks, or connectivity changes
- **THEN** the shell MUST preserve the same visible sync-status behavior used by the static tracker rather than hiding queue state until a later reload

### Requirement: Manual sync MUST preserve static shell behavior
The tracker SHALL preserve the same shell-visible behavior for manual sync.

#### Scenario: User triggers manual sync from tracker actions
- **WHEN** the user chooses manual sync
- **THEN** the tracker MUST run the static sync owner `syncOfflineQueue()` by POSTing queued sessions to `/api/logs` from the current queue state and preserve explicit empty-queue feedback `Nothing to sync!` instead of silently doing nothing

### Requirement: Queue sync MUST preserve duplicate-safe semantics
The tracker SHALL preserve the static queue rule that duplicate submissions are treated as sync success for queue-clearing purposes.

#### Scenario: Sync receives duplicate response
- **WHEN** queued session sync encounters a duplicate submission response such as `409`
- **THEN** the tracker MUST clear the duplicated session from the queue and treat it as sync success instead of leaving the queue stuck

### Requirement: Online recovery MUST preserve static refresh ordering
The tracker SHALL preserve the static ordering of reconnect-side effects.

#### Scenario: Browser returns online
- **WHEN** connectivity returns after offline or failed-online work
- **THEN** the tracker MUST update connectivity state and sync UI immediately, attempt queue sync when authenticated state and tracker context exist, and refresh full tracker data only when the picker is active

### Requirement: Cache hydration MUST preserve static background behavior
The tracker SHALL preserve the static distinction between blocking data load and background cache hydration.

#### Scenario: Online tracker data has loaded successfully
- **WHEN** the tracker has enough online data to render interactive shell state
- **THEN** any cache write or hydration work MUST remain a background follow-up rather than blocking the first trustworthy interactive tracker render

### Requirement: Active logging MUST not be interrupted by reconnect refresh
The tracker SHALL preserve static behavior that avoids disrupting the active logger or history flows during online recovery.

#### Scenario: Queue sync succeeds while user is not on picker
- **WHEN** reconnect-side sync succeeds while the user is in logger or history view
- **THEN** the tracker MUST avoid replacing the current surface with a full picker refresh and instead hydrate cache or defer refresh behavior

### Requirement: Offline queue load MUST preserve static migration behavior
The tracker SHALL preserve the queue-migration behavior static `index.html` uses when older offline session records are encountered.

#### Scenario: Tracker loads an older offline queue entry
- **WHEN** the stored offline queue contains older session formats
- **THEN** the tracker MUST preserve the static migration behavior that normalizes those records, including the special collapse path where multiple old sets with both `reps` and `seconds` null are collapsed into one hold set

### Requirement: Adherence timing MUST preserve static local-midnight semantics
The tracker SHALL preserve the static definition of `today` and the associated recency buckets.

#### Scenario: Tracker computes exercise adherence
- **WHEN** the tracker compares the current time to a session `performed_at`
- **THEN** it MUST normalize both dates to local midnight, treat `0 days` as `Done today`, preserve the `1-3`, `4-7`, and `8+` day bucket ranges, and preserve the same visible outputs and color buckets used by static `index.html`: green for `1-3 days`, orange warning for `4-7 days`, and red warning for `8+ days`

### Requirement: Backdate timing MUST preserve static rewrite behavior
The tracker SHALL preserve the same time behavior used when backdating a finished session.

#### Scenario: User applies a backdate
- **WHEN** the user saves a session with a chosen backdate
- **THEN** the tracker MUST default the backdate field from session start time, show the warning only when the chosen time differs by more than two minutes, and rewrite both the session timestamp and each set `performed_at` to the chosen value before queueing and local-history update

### Requirement: Polling cadence MUST preserve static freshness timing
The tracker SHALL preserve the static cadence for message freshness and other timing-sensitive shell behavior.

#### Scenario: User stays signed in on the tracker
- **WHEN** authenticated tracker bootstrap completes
- **THEN** the tracker MUST preserve immediate post-bootstrap message freshness checking plus the recurring 30-second polling cadence that static `index.html` uses

### Requirement: API timing notes MUST preserve startup-versus-recurring-versus-deferred differences
The tracker SHALL preserve which timing class each important request belongs to when that timing affects parity.

#### Scenario: Future migration work reasons about request timing
- **WHEN** a migration conversation uses the parity package to decide when API calls should happen
- **THEN** the package MUST preserve the distinction between blocking startup calls, immediate post-bootstrap calls, recurring polling calls, and deferred queue-driven calls instead of flattening them into one generic “data load” concept

### Requirement: User-action sequencing MUST preserve immediate versus deferred effects
The readable parity package SHALL preserve the difference between what happens immediately on a user action and what follows later as a side effect.

#### Scenario: Future migration work traces an action through the tracker
- **WHEN** a migration agent reasons about selecting an exercise, switching side, tapping counter, starting a timer, opening a modal, finishing a session, saving a session, opening messages, syncing, or editing history
- **THEN** the canonical specs MUST preserve both the immediate state or UI change and the deferred or follow-on effect instead of describing only the starting action

### Requirement: Feedback timing MUST preserve static user trust model
The tracker SHALL preserve which feedback happens immediately versus later.

#### Scenario: User performs a save or sync-relevant action
- **WHEN** the tracker saves, syncs, falls back to cache, blocks an action, or updates progress
- **THEN** it MUST preserve the same immediate-versus-later feedback contract used by the static tracker, including immediate save feedback before later sync results are known

### Requirement: Functional hints and progress copy MUST preserve static wording domains
The tracker SHALL preserve the non-toast text that tells the user what state they are in and what happens next.

#### Scenario: Tracker communicates progress or mode
- **WHEN** the shell or logger shows progress, context, or guided next action
- **THEN** the tracker MUST preserve functional text domains such as `Working left side`, `Working right side`, `Rep X of N`, `Duration Exercise`, `Target: N seconds`, `Side: Left`, `Side: Right`, and midpoint or undo feedback that explains what just changed

### Requirement: Blocked states MUST preserve static visible failures
The tracker SHALL preserve the same blocked, empty, and failure states that static `index.html` exposes to the user.

#### Scenario: User hits an invalid or unavailable state
- **WHEN** the tracker encounters finish-with-zero-sets, no sets to undo, missing patient context, failed exercise load, failed history load, failed message load, or invalid manual entry
- **THEN** it MUST preserve explicit visible blocked or failure behavior instead of collapsing those states into silent no-ops or generic placeholders

### Requirement: Supporting-copy and hint behavior MUST preserve static functional guidance
The tracker SHALL preserve static copy and non-toast hints when they materially guide user action or context.

#### Scenario: Tracker communicates current state to the user
- **WHEN** the tracker shows progress, context, empty states, or blocked states
- **THEN** it MUST preserve the functional guidance carried by static labels, hints, badges, and toasts, including patient banner context, Pocket Mode hints, progress labels, and maintenance empty-state text

### Requirement: Behaviorally important copy MUST preserve static wording domains
The readable parity package SHALL surface the concrete copy that tells the user what state the tracker is in or what to do next.

#### Scenario: Future migration review checks copy-driven behavior
- **WHEN** a later conversation verifies empty states, blocked states, offline states, and save feedback
- **THEN** the canonical package MUST continue surfacing the exact copy `No active exercises.`, `No history yet. Start logging exercises!`, `Never done`, `Please log at least one set before finishing`, `No sets to undo`, `Offline mode`, `Using cached data`, `Failed to load exercises. Check your connection.`, `Failed to load history.`, `Nothing to sync!`, `Offline - changes will sync later`, `Rep N complete`, `Saved (with notes)`, and `Saved (no notes)`

### Requirement: Connectivity-loss feedback MUST preserve exact static copy
The offline contract SHALL preserve the concrete shell feedback shown when the tracker loses online durability.

#### Scenario: Tracker falls back to queued local durability after connectivity loss
- **WHEN** the user saves or continues using the tracker while network connectivity is unavailable
- **THEN** the shell MUST preserve the exact static feedback `Offline - changes will sync later` rather than paraphrasing or omitting the delayed-sync warning

### Requirement: Source-anchor helper names MUST remain visible for offline verification
The offline parity package SHALL preserve the exact static helper anchor used to locate sync behavior in source.

#### Scenario: Later parity review cross-checks sync ownership
- **WHEN** a later conversation needs to trace queue sync behavior back to the static source
- **THEN** the canonical offline package MUST keep the source-anchor name `syncOfflineQueue()` visible as the owner of manual and reconnect sync behavior rather than reducing it to unnamed sync intent

### Requirement: Observed static inconsistencies MUST be preserved as explicit review items
The transitional parity package SHALL preserve likely-static inconsistencies as explicit review requirements rather than silently turning them into normative migration rules.

#### Scenario: Static behavior appears internally inconsistent
- **WHEN** the preserved evidence shows a static behavior that may be defective or incomplete, such as logger-side set creation continuing to write `distance_feet: null` while distance exists elsewhere in the data model
- **THEN** the canonical parity package MUST preserve that observation as a migration review item so later tasks and Beads work can decide whether to preserve, fix, or flag it explicitly

### Requirement: Late-discovery parity zones MUST remain visible in the readable spec
The readable parity package SHALL preserve known late-discovery zones so later migration work checks them deliberately rather than rediscovering them in Playwright.

#### Scenario: Team plans a migration slice or parity review
- **WHEN** later work is scoped from the parity package
- **THEN** the package MUST continue surfacing shell context resolution, session finalization, tracker-owned messaging, temporal semantics, user feedback, and reconnect behavior as explicit high-risk review zones

### Requirement: Concrete static edge cases MUST remain named directly
The readable parity package SHALL preserve the concrete edge cases that have historically been learned too late.

#### Scenario: Later migration work reviews subtle tracker behavior
- **WHEN** a migration conversation checks the parity package for edge cases
- **THEN** it MUST continue surfacing rules such as local-midnight `today`, therapist patient-context ownership, admin split behavior, finish-with-zero-sets as an error flow, sided-versus-bilateral side semantics, editable history from index, backdate rewriting both session and set timestamps, role-sensitive message recipient fallback, immediate save feedback before sync outcome, paint-separated messages open, logger back clearing the in-progress session, confirmation before notes discard, picker-only refresh on online return, cache fallback only when relevant cached patient data exists, and `No sets logged` maintenance behavior for an existing session shell

### Requirement: Online return MUST preserve immediate status feedback before deferred refresh
The tracker SHALL preserve the static rule that reconnect feedback appears immediately even when full UI refresh is suppressed.

#### Scenario: Browser returns online during non-picker activity
- **WHEN** connectivity returns while the user is in logger or history view
- **THEN** the tracker MUST preserve immediate online-status and sync-status feedback while still suppressing full picker refresh during the active non-picker flow

### Requirement: Cache fallback MUST preserve resolved-patient scoping
The tracker SHALL preserve the static rule that cache fallback is only valid when relevant cached tracker data exists for the resolved patient context.

#### Scenario: Network load fails after role and context resolution
- **WHEN** the tracker attempts cached fallback for programs or history
- **THEN** it MUST preserve the rule that cached recovery only succeeds when matching cached tracker data exists for the resolved patient context instead of treating any cached data as acceptable

### Requirement: Offline queue state MUST preserve named lifecycle meaning
The offline contract SHALL preserve `offlineQueue` as a named collection with a stable lifecycle rather than an incidental implementation detail.

#### Scenario: Agent reconstructs offline save and sync behavior
- **WHEN** a migration agent reasons about queue-first save and later sync
- **THEN** the parity package MUST preserve that `offlineQueue` holds unsynced sessions locally, is stored under the localStorage key `pt_offline_queue`, updates immediately on save, and is cleared item by item on sync success or duplicate-safe sync handling

### Requirement: Offline sync identity MUST preserve static duplicate-tracking intent
The offline contract SHALL preserve the static intent that queued-session sync uses a stable client mutation identity derived from the session itself.

#### Scenario: Queued session is posted during sync
- **WHEN** the tracker posts a queued session to the server during offline sync
- **THEN** the migration contract MUST preserve the same duplicate-tracking intent used by the static tracker, including the field name `client_mutation_id` and the stable mutation identity tied to the saved session id

### Requirement: Duplicate-safe sync MUST preserve static success treatment for conflict responses
The offline contract SHALL preserve that some server conflict responses still count as successful queue drain outcomes.

#### Scenario: Sync receives a duplicate session response
- **WHEN** offline queue sync receives a `409` duplicate response for a queued session
- **THEN** the tracker MUST preserve the static rule that this response counts as success and removes the queued session instead of leaving it stuck in the queue

### Requirement: Offline queue storage MUST preserve named static keys and identifiers
The offline contract SHALL preserve the exact storage and mutation identifiers named in the static baseline.

#### Scenario: Later migration work rebuilds queue persistence
- **WHEN** queue save and sync behavior are implemented in Next.js
- **THEN** the readable contract MUST preserve the localStorage key `pt_offline_queue` and the mutation field name `client_mutation_id` instead of reducing them to generic queue or identity descriptions

### Requirement: Successful sync follow-up MUST preserve history reload and cache hydration
The offline contract SHALL preserve the exact post-sync follow-up behavior used by static recovery.

#### Scenario: Queue sync succeeds after reconnect or manual sync
- **WHEN** one or more queued sessions are drained successfully
- **THEN** the tracker MUST preserve the static follow-up behavior of reloading history and hydrating cache after sync rather than stopping at queue removal alone

### Requirement: Hold-queue migration MUST preserve the exact bug-signature collapse rule
The offline contract SHALL preserve the specific old-data signature used when collapsing buggy hold-session records.

#### Scenario: Offline queue contains an older hold-session bug shape
- **WHEN** queue migration encounters legacy hold-session data
- **THEN** the tracker MUST preserve the collapse rule keyed on multiple old sets with both `reps` and `seconds` null before normalizing them into one hold set

### Requirement: Timing parity MUST preserve toast lifecycle staging
The offline-and-feedback contract SHALL preserve that tracker toasts are not just shown, but staged through the same visible timing pattern as the static shell.

#### Scenario: Tracker shows a toast
- **WHEN** the shell or logger shows success, failure, blocked-state, or sync feedback in a toast
- **THEN** the tracker MUST preserve the static staged lifecycle where the toast animates in after a short timeout and is removed only after its display duration plus fade-out delay rather than disappearing instantly

### Requirement: Adherence timing MUST preserve exact bucket colors
The timing contract SHALL preserve the visible color mapping of the static recency buckets, not only the numeric ranges.

#### Scenario: Tracker renders day-ago adherence
- **WHEN** an exercise is not in the `Done today` bucket
- **THEN** the tracker MUST preserve the static bucket colors of green for `1-3 days`, orange warning for `4-7 days`, and red warning for `8+ days`
