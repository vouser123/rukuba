# PT Tracker Rebuild - Public Dev Notes

This file summarizes notable rebuild milestones for the public docs bundle.
For internal development history, see `/pt-rebuild/DEV_NOTES.md`.

## 2026-01-31 (Audit Fixes)

### Deep Dive Audit - Critical Bug Fixes

Ran comprehensive audit using 3 parallel agents. Fixed critical issues:

1. **IndexedDB Transaction Bug** (`public/js/offline.js`)
   - **Problem:** `await tx.complete` doesn't exist - IndexedDB transactions use `.done` not `.complete`
   - **Fix:** Changed to `await tx.done` for proper transaction completion

2. **CSS File Reference Wrong** (`index.html`, `pt_view.html`, `rehab_coverage.html`)
   - **Problem:** Pages linked to `main.css` (16-line reset only) instead of `css/main.css` (526-line full stylesheet)
   - **Fix:** Updated all references to `/css/main.css`

3. **Missing PWA Meta Tags** (`pt_editor.html`, `pt_view.html`, `rehab_coverage.html`)
   - **Problem:** Pages missing manifest, favicon, apple-touch-icon, iOS web app meta tags
   - **Fix:** Added full PWA meta tag set to all pages

4. **requireTherapist() Missing accessToken** (`lib/auth.js`)
   - **Problem:** Unlike `requireAuth()` and `requirePatient()`, the `requireTherapist()` middleware didn't extract and attach `req.accessToken` for RLS context
   - **Fix:** Added accessToken extraction matching other middleware patterns

5. **Unhandled Async Errors** (`public/js/tracker.js`, `public/js/report.js`)
   - **Problem:** Event handlers with async operations had no try/catch - errors silently failed
   - **Fix:** Wrapped switch statements in try/catch with user-facing error messages

### New PT² Icon

- Created `public/icons/icon.svg` - Dark grey background (#333333) with white "PT" and powder blue superscript "2"
- Updated `manifest.json` to use SVG icon
- Added PWA meta tags to `index.html` with new icon

---

## 2026-01-31

### Simplified Lifecycle UI and Fixed Data Consistency (pt_editor.html)

- **Problem:** pt_editor had both a checkbox AND a dropdown for archived status, plus "deprecated" option nobody understood. Database had inconsistent data (some exercises had `lifecycle_status: null`, one had `archived: false` but `lifecycle_status: 'archived'`).
- **What I did:**
  - **Database fix:** Updated all exercises to have consistent `lifecycle_status` ('active' or 'archived') matching `archived` boolean
  - **UI simplification:** Removed redundant checkbox, removed "deprecated" option, kept only Active/Archived dropdown
  - **Code fix:** `lifecycle_status` now always defaults to 'active', never null
  - Added helper text explaining archived exercises are hidden from trackers and coverage

### Archived Exercises Showing in Rehab Coverage (rehab_coverage.html)

- **Problem:** Archived exercises (like "Wipers") were still appearing in the rehab coverage page.
- **What I did:** Updated `/api/roles` to filter out archived exercises.
  - Added `!inner` join to exercises table to enable filtering
  - Added `.eq('exercises.archived', false)` filter to the query
  - Now only active (non-archived) exercises appear in coverage analysis

### Sign Out Error "Auth Session missing" (pt_editor.html)

- **Problem:** After signing out from pt_editor.html hamburger menu on iOS, page reload showed "Token sign-in failed: Auth Session missing!" error.
- **What I did:** Fixed `signOut()` in `public/js/pt_editor.js` to clear stored auth tokens BEFORE calling `supabaseClient.auth.signOut()`.
  - Root cause: `index.html` stores auth tokens in `pt_editor_auth` localStorage key when navigating to pt_editor
  - On reload after sign out, `init()` found stale tokens and tried to use them with `setSession()`
  - Supabase returned "Auth Session missing" because the session was already invalidated
  - Fix: Call `clearStoredAuth()` before `signOut()` to remove stale tokens

### Form Parameters Not Showing in Log Set Modal (index.html)

- **Problem:** When logging sets, the fields for required form parameters (weight, band resistance, etc.) were not appearing.
- **What I did:** Fixed the priority order in `normalizeProgramPatternModifiers()` in `lib/handlers/programs.js`.
  - Root cause: RLS policies may block patients from reading `exercise_form_parameters` via nested Supabase joins
  - The nested query silently returns `[]`, but code was preferring it over the admin-fetched fallback
  - Changed logic to always prefer admin-fetched form params (RLS-safe) over nested query result
  - Added logging to help diagnose if form params are missing from database

### Rehab-Focused pt_view.html Overhaul

- **Problem:** pt_view.html was using gym-style metrics (Total Sessions, Total Sets, Top Exercises) inappropriate for physical therapy rehab tracking. Session notes from patients were buried and hard to find.
- **What I did:** Complete overhaul to make the page rehab-focused.
  - **Patient Notes Section:** Added prominent alert-styled section at TOP of page
    - Yellow/orange border-left styling to grab attention
    - Shows sessions with notes from past 7 days
    - Concerning words (pain, sharp, couldn't, etc.) are highlighted in red
    - Each note shows date, exercise name, and note text in quotes
  - **Rehab Metrics:** Replaced gym metrics with rehab-appropriate ones
    - "Days Active" (X/7) - emphasizes consistency over volume
    - "Exercises Covered" (X/Y) - breadth over depth
    - "Needs Attention" count - shows overdue exercises
  - **Needs Attention Section:** Replaced "Top Exercises" with exercises not done in 7+ days
    - Color-coded urgency: orange (7-10 days), red (11+ days)
    - Shows days since last done
    - Prioritizes HIGH contribution exercises

### PT Tracker Link in Hamburger Menu (pt_editor.html)

- **Problem:** Admin/therapist users who also have exercises assigned couldn't see the PT Tracker link in the hamburger menu.
- **What I did:** Updated HamburgerMenu module and pt_editor.js to check if user has programs assigned.
  - Added `showTrackerLink` option to HamburgerMenu.init() for explicit control
  - pt_editor.js now fetches user's programs and shows PT Tracker link if any exist
  - This allows therapists/admins who are also patients to access their tracker

### Coverage Legend & Metrics Display (rehab_coverage.html)

- **Problem:** Users couldn't understand what the bar colors, widths, and opacities meant.
- **What I did:** Added explanatory elements throughout the page.
  - Collapsible legend card explaining the THREE SIGNALS (width=7d density, color=recency, opacity=21d trend)
  - Exercise cards now show "7d: X · 21d: Y" session counts
  - Capacity bars show subtitle: "X% weekly • recency text • Y% trend"
  - Fixed 21-day trend summary to use average opacity (was incorrectly using binary "done once" count)

### Hamburger Menu for pt_editor.html

- **Problem:** pt_editor.html had no hamburger menu for navigation, unlike other pages.
- **What I did:** Added consistent hamburger menu with navigation links.
  - Created shared module `/js/hamburger-menu.js` for reusable menu functionality
  - Created shared styles `/css/hamburger-menu.css` for consistent appearance
  - Menu includes: PT Tracker (if patient), View History, Coverage Analysis, Reload, Sign Out
  - Displays signed-in user email
  - Uses `data-action` pattern for iOS Safari/PWA compatibility
  - HamburgerMenu.init() accepts config for currentUser, signOutFn, and custom action handlers

### Exercise Details Modal (index.html)

- **Problem:** Patients had no way to view exercise guidance, target muscles, or equipment info from the tracker.
- **What I did:** Added ℹ️ info button to each exercise card that opens a details modal.
  - Button positioned top-right of card with `data-stop-propagation` to prevent triggering exercise selection
  - Modal displays: description, pattern (sided/bilateral), primary/secondary muscles, equipment, and guidance sections (external cues, motor cues, compensation warnings, safety flags)
  - Uses `data-require-self` pattern for backdrop click-to-close
  - Follows pt_tracker.html detail display pattern for consistency
  - Added CSS for `.details-btn`, `.pill`, `.detail-section` classes

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
  - Fixed exercise list showing "Never done" for all exercises (loadHistory now runs before renderExerciseList)

### Rehab Coverage Improvements (rehab_coverage.html)

- **Dark Mode Support**
  - Added CSS custom properties for theming
  - Added `prefers-color-scheme: dark` media query
  - Styled cards, headers, and text for dark backgrounds

- **Visual Improvements**
  - Modernized card layout with shadow and rounded corners
  - Better typography hierarchy
  - Responsive grid layout for exercise cards
  - Meaningful coverage progress bar showing actual percentage (not always full)

- **Data Display Fixes**
  - Fixed null values showing as "null" - now defaults to descriptive text
  - Shows exercise canonical names instead of IDs
  - Grouped exercises by region → capacity → focus hierarchy

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
