# PT Tracker Rebuild — UI / UX Specification

This document defines **required UI surfaces** and **user-visible invariants** for the rebuild. The rebuilt UI must match current workflows while clarifying medical correctness and offline state. Any UI not listed here is out of scope.

---

## 1. Global UI Requirements
- **Auth gating**: all patient/therapist pages must present a blocking auth overlay until authentication succeeds.
- **Offline indicator**: every page must visibly indicate when there are unsynced changes.
- **Error disclosure**: any failure to save medical data must be shown as an explicit, actionable error.
- **Read-only states**: therapist dashboard and report views must clearly indicate read-only vs edit modes.
- **Accessibility**: modals must be keyboard navigable and screen-reader labeled.

---

## 2. Patient Tracker (`pt_tracker.html` equivalent)
### 2.1 Authentication & Header
- Sign-in modal with email/password, remember-me, password reset.
- Header must show:
  - current streak indicator,
  - notes badge,
  - quick exercise switcher,
  - navigation icons to weekly stats, exercise details, and menu.

### 2.2 Exercise Selection & Planning
- **Exercise picker modal** with:
  - search field,
  - tag filters (functional + format only),
  - recent exercises,
  - favorites/archived views and favorite toggles,
  - actions for plan creation and library browsing.
- **Plan session modal** to assemble the day’s exercise list and start the session.
- **Per-exercise dosage inputs** (sets/reps/seconds/distance) mapped to the session’s `exercise_spec` and patient assignment defaults.

### 2.3 Session Logging
- **Counter and timer modes** with progress bars, target labels, and next/previous/log actions.
- **Log set modal** must capture:
  - reps or seconds achieved,
  - distance (if distance-type),
  - side selector,
  - form parameters.
- **Next-set confirmation modal** must summarize the set and require explicit confirmation.
- **Session notes modal** at end of session; notes attach to the session record.
- **Edit session modal** must allow date/time correction, set edits, notes update, and delete (soft delete).

### 2.4 Timers
- Timer view for duration/timed reps with countdown, progress, and warnings on low time.
- Controls for start/pause/reset and “log this time.”
- Timer logs must capture `seconds_achieved` and `seconds_target` per set.

### 2.5 Session History & Stats
- History view grouped by `sessionId` with per-exercise details and set summaries.
- Weekly stats view: total sessions, total sets, streaks, and adherence metrics.
- Exercise detail view: session list for a specific exercise with date, notes, and totals.

### 2.6 Notes Access
- Notes badge in header; tap to open notes list.
- Patient can send notes from tracker and view therapist responses.
- Patient can archive their own notes; therapist archives are visible as hidden items.

### 2.7 Settings & App Management
- Settings modal with toggles for haptics and voice announcements.
- “About” section showing version + data storage note.
- Explicit “Sync Now” action for offline queue.

### 2.8 UI-Visible Invariants (Tracker)
- **Today/Yesterday** labels are computed in the **patient’s local timezone** and must match session `performed_at` values.
- **Set counts** displayed in the UI must match `session_sets` count for the session.
- **Exercise totals** must exclude archived exercises unless explicitly filtered.

---

## 3. Therapist Report & Editor (`pt_report.html` equivalent)
### 3.1 Authentication & Patient Selection
- Auth modal identical to tracker but scoped to therapist role.
- Patient selection list based on therapist mapping; must show patient identifiers and last activity.

### 3.2 Report View (Read-Only)
- Summary metrics: recent activity, session counts, adherence, and coverage summary.
- Latest patient note preview (most recent incoming patient note).
- Actions for:
  - toggle editor mode,
  - print/export,
  - navigate to coverage and dashboard.

### 3.3 Editor Mode (Full-Screen)
- Dedicated editor overlay with:
  - exercise search/select,
  - add-new exercise flow,
  - role assignments,
  - dosage adjustments.
- Vocabulary reference panel for roles and library semantics.
- Change history and undo-all controls.

### 3.4 Program Dosage & Roles
- Per-patient dosage editing (sets/reps/seconds/distance) with archived toggle.
- Role assignments must map to role definitions (region/capacity/focus/contribution).

### 3.5 Notes Workflow
- Therapist can send notes, mark read, archive, delete, and undo delete.
- Read state must be visible for both patient and therapist.

### 3.6 Import / Export
- Import PT_DATA / PT_MODIFICATIONS payloads (legacy compatibility only).
- Export payloads for sharing (email/copy/paste workflows).

### 3.7 UI-Visible Invariants (Report)
- **Coverage counts** must match role definitions × session history.
- **“Last 7 days”** must align with patient’s local timezone date boundaries.

---

## 4. Patient Dashboard (`pt_view.html` equivalent)
### 4.1 Overview
- Read-only dashboard with summary metrics and notes badge.
- “Refresh data” action and coverage analysis CTA.

### 4.2 Notes Inbox
- Modal with notes list, unread badge, filter (all vs unread).
- Patient can send notes directly from the modal.

### 4.3 Exercise History Drill-Down
- Searchable exercise history modal (filter by date or note text).

### 4.4 UI-Visible Invariants (Dashboard)
- Totals must match `sessions` and `session_sets`.
- Top exercises list must be deterministically sorted by total logged sets.

---

## 5. Coverage Analysis (`rehab_coverage.html` equivalent)
### 5.1 Coverage Matrix
- Region/capacity/focus accordion computed from roles and session history.
- Date range selection for coverage calculation.

### 5.2 Roles & Vocabulary Modals
- Roles editor modal for per-exercise role adjustments.
- Vocabulary browser with term definitions.

### 5.3 Debug Panel (Visible to Therapists Only)
- Diagnostics for role matching, session inclusion, and coverage calculations.

---

## 6. Notes-Only Surface
If a standalone notes surface is preserved, it must:
- show sent/received notes,
- expose read/archived/deleted state,
- preserve audit history (who sent/edited/deleted).

---

## 7. Explicit Exclusions
- **Body heatmap visualization is excluded** from the rebuild UI.
- **Legacy JSON import/export UIs** may be kept only for backup/restore flows.
