# PT Tracker Rebuild - Public Dev Notes

This file summarizes notable rebuild milestones for the public docs bundle.
For internal development history, see `/pt-rebuild/DEV_NOTES.md`.

## 2026-01-30

### Exercise Logging Enhancements (index.html)

- **My Exercises List Improvements**
  - Added adherence display: "X days ago · Y sessions total"
  - Color-coded indicators: green (≤3 days), orange (4-7 days + ⚠️), red (8+ days + ❗)
  - Category tags displayed as pills

- **Sets Tracking Display**
  - Shows sets progress for all exercises
  - Non-sided (both): "0/3 sets"
  - Sided exercises: "Left: 0/1 · Right: 0/1" with per-side tracking
  - Target dose display

- **Control Buttons (Always Visible)**
  - Previous - undo last logged set
  - Log Set - manual entry modal (for exercises done without counter/timer)
  - Next Set - confirmation modal (user taps when done with counter/timer)

- **Next Set Modal**
  - Shows what will be logged: "X reps (target Y)"
  - Displays form parameters that will be logged
  - Buttons: Cancel / Edit / Log & Next
  - Voice comparison: "X more/less reps than last time"

- **Log Set Modal Improvements**
  - Prefills with target dose (not counter value)
  - Prefills form parameters from last-used values in exercise_logs
  - Side selector for sided exercises with progress display

- **History Editing**
  - Click history items to open Edit Session modal
  - Editable date/time picker
  - Editable sets (reps, side, form parameters)
  - Add/delete individual sets
  - Delete Session button with confirmation
  - Save Changes commits to API via PATCH /api/logs/:id

- **Bug Fixes**
  - Added touch-action: manipulation to counter display (prevents iOS double-tap zoom)
  - Added setInterval for periodic message polling (30 seconds)
  - Added UUID validation to messages API functions

## 2026-01-28

- Established rebuild-specific documentation set in `/pt-rebuild/public/docs` covering architecture, practices, and vocabularies.

### Notes & Messages Implementation

- Added session notes modal to index.html (shows after exercise completion)
  - "Cancel" button with confirmation to discard
  - "Save & Finish" button allows saving with or without notes
  - Toast shows "Saved (with notes)" or "Saved (no notes)"
- Added clinical messages API endpoints to logs.js (merged to avoid Vercel function limit)
  - GET /api/logs?type=messages - list messages
  - POST /api/logs?type=messages - create message
  - PATCH /api/logs?type=messages&id=X - mark read/archive
  - DELETE /api/logs?type=messages&id=X - soft delete (1-hour undo window)
- Added messages modal to index.html and pt_view.html
  - Unread badge indicator
  - Time-ago formatting
  - Hide and Undo Send actions
- Enhanced pt_view.html:
  - Top Exercises section (top 10 by frequency)
  - Exercise History modal with search
  - Hamburger menu with navigation links
  - User info display (signed in as email)
  - Dark mode CSS support
  - iOS touch-action compatibility
