# PT Tracker Rebuild - Development Notes

This file tracks development progress on the Supabase/Vercel rebuild of the PT tracker app.

## 2026-01-19

- **2026-01-19** — **Progress:** Implemented core tracker features in rebuilt index.html. **What was done:** (1) Added timer mode with countdown display, beeps at 5 seconds and completion, and voice announcements ("5 seconds left", "4", "3", "2", "1", "Time"). Timer counts up to show elapsed time and auto-pauses at target but allows continuing beyond. (2) Created big tappable circle for reps counting (320px diameter, iOS-optimized with scale feedback on tap). Removed +/- buttons in favor of single tap-to-increment interface with undo button. (3) Added voice countdown for reps mode - announces "5 reps left", "4 reps left", etc. when approaching target. (4) Implemented pattern modifier detection to show timer mode for `duration_seconds` and `hold_seconds` exercises, counter mode for standard reps. (5) Created `formatDosage()` function to display exercise prescriptions as "3 × 10 reps", "3 × 30 sec", "20 feet", or "3 × 10 reps (5 sec hold)" based on patient_programs data. (6) Used CSS variables (--counter-color, --counter-bg, --timer-color) for future dark mode support. (7) All interactions use data-action with pointerup events per iOS PWA requirements (no onclick handlers). **Files:** `pt-rebuild/public/index.html`. **Notes:** Timer uses Web Audio API for beeps and Web Speech API for voice - both require user interaction on iOS to initialize. Set data is saved with either reps or seconds based on mode.

- **2026-01-19** — **Remaining work:** (1) Form parameters modal - needs to dynamically render fields based on exercise.form_parameters_required (weight, band_position, surface, etc.) and collect values when logging sets. (2) Exercise detail/history view - modal showing all activity logs for a specific exercise with set-by-set details. (3) Warning indicators - show "⚠️ X days ago" for exercises not done recently. (4) Terminology fixes - change "Session" to "Activity Log" throughout UI. (5) **CRITICAL: Verify sync** - confirm that logged sets actually save to patient_activity_logs and patient_activity_sets tables in Supabase (user reported current sync not working). (6) Test all features on deployed Vercel site. **Priority:** Sync verification is critical - features are useless if data doesn't save.

- **2026-01-19** — **Architecture decisions:** (1) No Firebase or JSON fallbacks in rebuild - all data comes from Supabase API endpoints. (2) Server-authoritative - Supabase PostgreSQL is source of truth, client is advisory. (3) CSS prepared for dark mode with variables but implementation deferred. (4) Following iOS PWA patterns from original (data-action, pointerup, no onclick). (5) Pattern modifiers determine UI mode: duration_seconds/hold_seconds show timer, standard exercises show counter. **Constraints:** User has autism and requires "same same same" - app must work identically to original Firebase version. No changes to clinical workflows allowed.

## 2026-01-28

- **2026-01-28** — **Maintenance:** Moved shared exercises/programs handlers into `pt-rebuild/lib/handlers` and updated API route wrappers to point at the shared modules to reduce serverless function duplication. **Docs:** Mirrored `/pt/docs` into `pt-rebuild/public/docs` for rebuild parity and added `pt-rebuild/agent.md` to summarize rebuild-specific guidance.

## 2026-01-28

- **2026-01-28** — **Docs:** Rewrote the public rebuild docs in `pt-rebuild/public/docs` to reflect Supabase/Vercel architecture instead of copying legacy Firebase documentation.

## 2026-01-30

- **2026-01-30** — **API:** Added exercise form parameter names to the programs payload by joining exercise form parameters and normalizing them into `form_parameters_required`, keeping the patient tracker data consistent with exercise metadata. **Files:** `pt-rebuild/lib/handlers/programs.js`.
