# Audit Tracker

Purpose: track every external audit finding against the canonical parity package so no detail is considered "probably covered" without an exact home.

Status values:
- `open`
- `patched-needs-verify`
- `closed`
- `non-canonical-reference-only`

## Claude Code 25-Finding Audit

### Shell / Context

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| CC-S1 | `formatDateTimeWithZone(...)` name preserved | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | history timestamp + adherence presentation requirements |
| CC-S2 | adherence color buckets `green/orange/red` preserved | `tracker-shell-and-context-parity/spec.md`, `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | adherence presentation / exact bucket color requirements |
| CC-S3 | `threadRecipientId` listed in signed-out clear behavior | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | auth-state clearing requirement |
| CC-S4 | editor-link clear on no-session startup | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | no-session startup + editor-link auth propagation requirements |
| CC-S5 | hamburger wiring order inside authenticated bootstrap / `loadData()` | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | authenticated startup + bootstrap ordering requirements |
| CC-S6 | search uses live `input` event | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | picker search requirement |
| CC-S7 | picker empty states are distinct conditions | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | picker search/empty-state requirement |

### Logging / Pocket

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| CC-L1 | hold timer auto-pauses on rep completion | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | hold timer completion requirement |
| CC-L2 | hold timer resets to target after each rep | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | hold timer completion requirement |
| CC-L3 | `Next Set` resets live counter | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | reps walkthrough / next-set acceptance requirement |
| CC-L4 | comparison speech is delayed, not immediate | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | next-set acceptance timing requirement |
| CC-L5 | duration `Log Set` hides hold-time input | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | duration walkthrough / log-set requirement |
| CC-L6 | exact zero-value copy `Please enter a value greater than 0` | `tracker-logging-and-pocket-parity/spec.md` | closed | next-set empty-progress requirement |
| CC-L7 | counter surface has 3 named elements | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | logger surfaces named-parts requirement |
| CC-L8 | timer surface has 5 named parts | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | logger surfaces named-parts requirement |
| CC-L9 | undo toast names removed set number | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | undo/reset requirement |

### Messages / History

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| CC-M1 | `Session deleted` toast named | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | session-delete success requirement |
| CC-M2 | sided detection from exercise OR saved set data | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | edit-session sided-detection requirement |
| CC-M3 | send success produces toast + list refresh | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | message send success requirement |
| CC-M4 | email toggle synced from `currentEmailNotifyEnabled` | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | email preference syncing requirement |

### Offline / Timing

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| CC-O1 | localStorage key `pt_offline_queue` | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | offline queue state + storage requirements |
| CC-O2 | field name `client_mutation_id` | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | sync identity + storage requirements |
| CC-O3 | post-sync history reload + cache hydration | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | successful sync follow-up requirement |
| CC-O4 | hold-bug collapse signature = null reps AND null seconds | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | hold-queue migration requirement |
| CC-O5 | toast lifecycle timing | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | toast lifecycle staging requirement |

## Thread A Audit

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| TA-1 | preserve `loadData()` and `pt_editor.html` anchors | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | authenticated startup + editor-link propagation |
| TA-2 | preserve logger/Pocket helper anchors (`selectExercise()`, `showLogSetModal()`, etc.) | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | source-anchor helper names requirement + specific flow requirements |
| TA-3 | preserve `showMessagesModal()` anchor | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | messages source-anchor requirement |
| TA-4 | preserve `syncOfflineQueue()` anchor | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | offline source-anchor requirement |
| TA-5 | preserve exact milestone speech `5 reps left`, `3 reps left`, `Last rep`, `Set complete` | `tracker-logging-and-pocket-parity/spec.md` | closed | logger execution feedback + milestone speech requirement |
| TA-6 | preserve exact completion speech `All sets complete` | `tracker-logging-and-pocket-parity/spec.md` | closed | session-complete feedback requirement |
| TA-7 | preserve exact Pocket paused hint `Tap to start` | `tracker-logging-and-pocket-parity/spec.md` | closed | Pocket hints requirement |
| TA-8 | preserve exact backdate warning copy | `tracker-logging-and-pocket-parity/spec.md` | closed | backdate warning wording requirement |
| TA-9 | preserve exact undo-send confirmation copy | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | undo-send confirmation wording requirement |
| TA-10 | preserve exact session-delete confirmation copy | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | session-delete confirmation wording requirement |

## Thread B Audit

Note: the archived baseline companion now lives at `archive/source-baseline-reference.md` and is retained only as historical source context. Findings against it are used to correct the split specs, not to restore it as part of the active planning package. `index-reconstruction-guide.md` remains the editable helper guide.

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| TB-1 | stale deleted spec link in `index-reconstruction-guide.md` | `index-reconstruction-guide.md` | patched-needs-verify | canonical spec list at top of guide |
| TB-2 | stale deleted spec link in archived baseline companion | `archive/source-baseline-reference.md` | patched-needs-verify | canonical spec list at top of archived baseline |
| TB-3 | guide says `PT Tracker Sign In` instead of titleless sign-in card | `index-reconstruction-guide.md` | patched-needs-verify | auth surfaces section in guide |
| TB-4 | baseline compresses queue restore + handler binding order | split specs only | patched-needs-verify | shell startup requirements already updated from design-extract/baseline |
| TB-5 | baseline modal inventory omits auth modals | split specs only | patched-needs-verify | shell full surface inventory requirement |
| TB-6 | guide abstracts away exact accepted-set payload fields | `index-reconstruction-guide.md` | closed | `Next Set` confirm behavior now names accepted-set payload fields and `manual_log` semantics |
| TB-7 | baseline abstracts accepted-set payload fields | split specs only | patched-needs-verify | logging payload requirements |
| TB-8 | guide says `Please sign in to view messages` | `index-reconstruction-guide.md` | patched-needs-verify | messages blocked-state line in guide |
| TB-9 | baseline compresses final save order | split specs only | patched-needs-verify | final save order requirements in canon |

## Thread 3 Inventory Audit

### Copy Inventory

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| T3-C1 | finish blocked copy must live in concrete finish requirement | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | finish/finalization requirement |
| T3-C2 | `No sets to undo` must live in concrete undo requirement | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | undo/reset requirement |
| T3-C3 | `Offline - changes will sync later` must live in concrete connectivity-loss scenario | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | connectivity-loss feedback requirement |

### Delegated Action Inventory

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| T3-D1 | `close-log-set-modal` needs concrete close behavior | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | log-set modal close requirement |
| T3-D2 | `close-notes-modal` / `toggle-backdate` need concrete behavior | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | notes modal controls requirement |
| T3-D3 | `close-messages-modal` needs concrete close behavior | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | messages modal close requirement |
| T3-D4 | `close-edit-session-modal` needs concrete close behavior | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | edit-session modal close requirement |
| T3-D5 | `toggle-hamburger` and `reload` need concrete semantics | `tracker-shell-and-context-parity/spec.md` | patched-needs-verify | hamburger utility semantics requirement |

### Core State Inventory

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| T3-S1 | `logSetSelectedSide` lifecycle row must be explicit | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | logger state inventory + modal close requirement |
| T3-S2 | `timerState` lifecycle row must be explicit | `tracker-logging-and-pocket-parity/spec.md` | patched-needs-verify | logger state inventory requirement |

### API Inventory

| ID | Finding | Target | Status | Exact Home |
|---|---|---|---|---|
| T3-A1 | explicit `POST /api/logs` for offline queue sync | `tracker-offline-and-timing-parity/spec.md` | patched-needs-verify | manual sync requirement |
| T3-A2 | explicit `PATCH /api/logs?id=...` for edit-session save | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | edit-session save requirement |
| T3-A3 | explicit `DELETE /api/logs?id=...` for session delete | `tracker-messages-and-history-parity/spec.md` | patched-needs-verify | edit-session delete requirement |

## Closeout Rule

No finding moves to `closed` until:
1. the exact target text exists in the canonical spec or allowed helper guide,
2. the landing location is recorded above, and
3. the wording is requirement-grade, not “such as”, “close to”, or example-style phrasing where exactness is required.
