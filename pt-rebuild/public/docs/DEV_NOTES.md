# PT Tracker Rebuild - Public Dev Notes

This file summarizes notable rebuild milestones for the public docs bundle.
For internal development history, see `/pt-rebuild/DEV_NOTES.md`.

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
