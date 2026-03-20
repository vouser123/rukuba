# PT Tracker — Pre-Format History

This file is an archive of development notes from before the structured DN tracking system. It is not machine-processed and does not need to stay in sync with dev_notes.json.

## Legacy Entries (Pre-Format)

## 2026-01-19

- **2026-01-19** — **Progress:** Implemented core tracker features in rebuilt index.html. **What was done:** (1) Added timer mode with countdown display, beeps at 5 seconds and completion, and voice announcements ("5 seconds left", "4", "3", "2", "1", "Time"). Timer counts up to show elapsed time and auto-pauses at target but allows continuing beyond. (2) Created big tappable circle for reps counting (320px diameter, iOS-optimized with scale feedback on tap). Removed +/- buttons in favor of single tap-to-increment interface with undo button. (3) Added voice countdown for reps mode - announces "5 reps left", "4 reps left", etc. when approaching target. (4) Implemented pattern modifier detection to show timer mode for `duration_seconds` and `hold_seconds` exercises, counter mode for standard reps. (5) Created `formatDosage()` function to display exercise prescriptions as "3 × 10 reps", "3 × 30 sec", "20 feet", or "3 × 10 reps (5 sec hold)" based on patient_programs data. (6) Used CSS variables (--counter-color, --counter-bg, --timer-color) for future dark mode support. (7) All interactions use data-action with pointerup events per iOS PWA requirements (no onclick handlers). **Files:** `pt-rebuild/public/index.html`. **Notes:** Timer uses Web Audio API for beeps and Web Speech API for voice - both require user interaction on iOS to initialize. Set data is saved with either reps or seconds based on mode.

- **2026-01-19** — **CRITICAL FIX: Form parameters now use normalized SQL structure.** **Problem:** Initial implementation treated form_params like Firebase JSONB object. Supabase uses normalized table `patient_activity_set_form_data` with one row per parameter (activity_set_id + parameter_name + parameter_value + parameter_unit). **What I did:** (1) Updated API `/api/logs` GET to JOIN form_data table and return `form_data: [{parameter_name, parameter_value, parameter_unit}]` array per set. (2) Updated API POST to INSERT form parameters as separate rows in `patient_activity_set_form_data` table. (3) Fixed frontend `getHistoricalParamValues()` and `getLastUsedParamValue()` to read from `set.form_data` array instead of `set.form_params` object. (4) Fixed frontend `saveLoggedSet()` to send `form_data` as normalized array instead of object. Weight/distance split into value + unit fields. **Files:** `pt-rebuild/api/logs.js`, `pt-rebuild/public/index.html`. **Why critical:** This is the correct normalized SQL approach - "one row one thing" - not like Firebase where everything was nested objects. User was right to be concerned about Firebase-like structure being unsafe in SQL.

- **2026-01-19** — **Remaining work:** (1) Exercise detail/history view - modal showing all activity logs for a specific exercise with set-by-set details. (2) Warning indicators - show "⚠️ X days ago" for exercises not done recently. (3) Terminology fixes - change "Session" to "Activity Log" throughout UI. (4) Test all features on deployed Vercel site - verify form parameters save correctly to normalized tables. **Priority:** Test on deployed site to confirm form parameters actually save/load correctly.

- **2026-01-19** — **Architecture decisions:** (1) No Firebase or JSON fallbacks in rebuild - all data comes from Supabase API endpoints. (2) Server-authoritative - Supabase PostgreSQL is source of truth, client is advisory. (3) CSS prepared for dark mode with variables but implementation deferred. (4) Following iOS PWA patterns from original (data-action, pointerup, no onclick). (5) Pattern modifiers determine UI mode: duration_seconds/hold_seconds show timer, standard exercises show counter. **Constraints:** User has autism and requires "same same same" - app must work identically to original Firebase version. No changes to clinical workflows allowed.

## 2026-01-28

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-28

- Established rebuild-specific documentation set in `/pt-rebuild/docs` covering architecture, practices, and vocabularies.

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


- **2026-01-28** — **Maintenance:** Moved shared exercises/programs handlers into `pt-rebuild/lib/handlers` and updated API route wrappers to point at the shared modules to reduce serverless function duplication. **Docs:** Mirrored `/pt/docs` into `pt-rebuild/docs` for rebuild parity and added `pt-rebuild/agent.md` to summarize rebuild-specific guidance.

## 2026-01-28

- **2026-01-28** — **Docs:** Rewrote the public rebuild docs in `pt-rebuild/docs` to reflect Supabase/Vercel architecture instead of copying legacy Firebase documentation.

## 2026-01-30

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-30

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



- **2026-01-30** — **API:** Added exercise form parameter names to the programs payload by joining exercise form parameters and normalizing them into `form_parameters_required`, keeping the patient tracker data consistent with exercise metadata. **Files:** `pt-rebuild/lib/handlers/programs.js`.
- **2026-01-30** — **Messages:** Fixed message labeling/undo visibility by aligning client-side comparisons with `users.id` instead of auth IDs, and clarified sender/recipient labels in both patient (`index.html`) and therapist (`pt_view.html`) messaging UIs. **Also:** Ensured hidden messages are actually filtered per-user by excluding `archived_by_sender`/`archived_by_recipient` in the messages API response. **Files:** `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`, `pt-rebuild/api/logs.js`.

## 2026-01-31

### Legacy Public Notes (Merged on 2026-02-17)

#### Source: ## 2026-01-31 (Audit Fixes)

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


#### Source: ## 2026-01-31

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



- **2026-01-31** — **Deep dive audit and critical fixes.** **Problems found:** (1) IndexedDB transaction bug - `await tx.complete` doesn't exist, transactions use `.done`. (2) Unsafe destructuring of API responses could crash on undefined. (3) All 13 inline onclick handlers in pt_editor.html unreliable on iOS Safari/PWA. (4) Missing PWA meta tags on pt_editor, pt_view, rehab_coverage. (5) `requireTherapist()` in auth.js missing accessToken attachment. (6) Supabase SDK loaded from CDN caused tracking prevention warnings. **What I did:** (1) Fixed IndexedDB bug in offline.js line 132. (2) Added fallback patterns (`|| []`) to all unsafe destructuring in offline.js, report.js, index.html. (3) Converted all onclick/oninput/onchange handlers to data-action + pointerup pattern with bindPointerHandlers() and bindInputHandlers(). (4) Added PWA meta tags including new `mobile-web-app-capable` standard. (5) Fixed requireTherapist() and added requireTherapistOrAdmin() as separate function. (6) Self-hosted Supabase SDK to `/js/vendor/supabase.min.js` and created GitHub Action `.github/workflows/update-supabase-sdk.yml` to auto-update monthly. **Files:** `offline.js`, `report.js`, `index.html`, `pt_editor.html`, `pt_view.html`, `rehab_coverage.html`, `sw.js`, `lib/auth.js`.

- **2026-01-31** — **Voice announcements and UI improvements.** **What I did:** Added "Working left side" / "Working right side" voice announcement when selecting side for bilateral exercises. Added "All sets complete" announcement when finishing all sets (with flag to prevent repeat announcements). Fixed exercise list to show "Done today" immediately after logging by adding to allHistory array and re-rendering. **Files:** `pt-rebuild/public/index.html`.

- **2026-01-31** — **Cleanup:** Deleted unused files `tracker.html` and `pt_tracker.html` (legacy Firebase version still exists in `/pt`). Updated `sw.js` cache to v6 with correct asset list including self-hosted Supabase SDK.

- **2026-01-31** — **New icon:** Created PT² icon variant (dark grey background #333, white "PT", powder blue superscript "2") to distinguish rebuild from original `/pt` app on iOS home screen. **Files:** `icons/icon.svg`, `manifest.json`.

## 2026-02-01

- **2026-02-01** — **Problem:** Duration timer exercises logged 0 seconds instead of actual elapsed time when timer reached 0. **What I did:** When duration timer hits 0, the code was resetting `timerState.elapsedMs = 0`, so `confirmNextSet()` captured 0 instead of actual time. Fixed by setting `timerState.elapsedMs = timerState.targetSeconds * 1000` when duration completes, preserving the actual elapsed time for logging. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-01** — **Problem:** Form parameters (band_resistance, weight, etc.) and pattern modifiers (hold_seconds, duration_seconds, distance_feet) not displayed in history views. **What I did:** (1) Updated `renderHistory()` in index.html to show sets summary with reps/seconds/distance (e.g., "3 sets: 10r, 10r × 30s") and form params from first set. (2) Updated pt_view.html compact summary to show combined reps×seconds format and form params. (3) Updated pt_view.html expanded set details to include form_data with format "parameter_name: value unit". **Files:** `pt-rebuild/public/index.html`, `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** rehab_coverage.html calling non-existent `/api/users/me` endpoint causing 404 error. **What I did:** Instead of creating new API endpoint (Vercel function limit), added `user_role` field to existing `/api/roles` GET response since auth middleware already loads user role. Updated rehab_coverage.html to extract role from roles response in `loadData()` instead of separate API call. **Files:** `pt-rebuild/api/roles.js`, `pt-rebuild/public/rehab_coverage.html`.

- **2026-02-01** — **Problem:** pt_view.html showing incorrect "Exercises" count (16/16 instead of X/30) and "All exercises up to date" when exercises were overdue. Root cause: (1) `/api/programs` requires `patient_id` but pt_view wasn't passing it. (2) For therapists, `/api/logs` without `patient_id` defaults to therapist's own ID (no logs). **What I did:** (1) Added `viewingPatientId` variable set in `loadCurrentUserProfile()` - for therapists, finds their patient from users list; for patients, uses own ID. (2) Modified `loadData()` to pass `patient_id` to both `/api/logs` and `/api/programs`. (3) Fixed `calculateNeedsAttention()` to get exercise names from `program.exercises?.canonical_name` (nested API structure). **Files:** `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** Therapists and admins could only see their own user record due to restrictive RLS policy `users_select_own`. `/api/users` was returning only 1 user, so therapists couldn't find their assigned patients. **What I did:** (1) Updated `/api/users.js` to use admin Supabase client (bypasses RLS) with application-level filtering: admins see all users, therapists see themselves + patients where `therapist_id` matches their ID, patients see only themselves. (2) Created RLS migration `005_users_rls_policy_update.sql` with new policy `users_select_by_role` that allows therapists to see patients assigned to them and admins to see all users. **Files:** `pt-rebuild/api/users.js`, `pt-rebuild/db/migrations/005_users_rls_policy_update.sql`.

- **2026-02-01** — **Problem:** Archived exercises still appearing in exercise lists across all views. **What I did:** Added filter `.filter(p => !p.exercises?.archived)` when loading programs in pt_view.html. **Files:** `pt-rebuild/public/pt_view.html`.

- **2026-02-01** — **Problem:** rehab_coverage.html showing checkmarks for exercises done >7 days ago instead of warning icons. **What I did:** Updated status icon logic to show ⚠ warning symbol (orange) for exercises either never done or done 7+ days ago, checkmark (green) only for exercises done within 7 days. **Files:** `pt-rebuild/public/rehab_coverage.html`.

## 2026-02-04

- **2026-02-04** — **Problem:** Editing or deleting logged exercises returned 404 errors. The frontend was calling `/api/logs/${id}` with PATCH/DELETE methods, but the API only supported these methods for messages (`type=messages`), not for activity logs. **What I did:** (1) Added `updateActivityLog()` and `deleteActivityLog()` handlers to `/api/logs.js` that handle PATCH and DELETE requests when `id` query parameter is provided. (2) Updated frontend `saveEditSession()` and `deleteSession()` functions to use `/api/logs?id=X` query parameter format instead of path-based `/api/logs/${id}`. The update handler replaces all sets (deletes existing sets and form_data, then inserts new ones). **Files:** `pt-rebuild/api/logs.js`, `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** LOG SET for exercises with `hold_seconds` pattern modifier logged a single REP instead of a complete SET. The modal only asked for reps count, not hold time. **What I did:** (1) Added a second input field (`logSetTimeInput`) to the Log Set modal for entering seconds per rep. (2) Updated `showLogSetModal()` to show the time input and prefill it with target hold time when exercise has `hold_seconds`. (3) Updated `saveLoggedSet()` to detect manual hold entry (when time input is visible) and create a complete SET with both reps and seconds, bypassing the rep-by-rep timer flow. Manual entries are marked with `manual_log: true`. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** Edit Session modal didn't show seconds/time or distance fields for exercises with those pattern modifiers (`hold_seconds`, `duration_seconds`, `distance_feet`). Only showed reps and side. **What I did:** (1) Updated `renderEditSessionSets()` to detect exercise type and show appropriate fields: seconds input for hold/duration exercises, distance input for distance exercises. Labels adapt to context ("Seconds/rep" for hold, "Seconds" for duration). (2) Updated `saveEditSession()` to collect values from `.edit-set-seconds` and `.edit-set-distance` inputs. (3) Updated `addEditSessionSet()` to pre-fill default seconds/distance values based on exercise prescription. (4) Fixed history display format to always show reps/seconds/distance when present using compact format: "10r × 5s", "30s", "20ft". **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **Problem:** Exercise details modal only showed description and pattern, not equipment, muscles, or guidance/cues. Root cause: The `/api/programs` endpoint was trying to select `equipment`, `primary_muscles`, `secondary_muscles`, `guidance` as columns from the `exercises` table, but these don't exist as columns - they're stored in separate related tables (`exercise_equipment`, `exercise_muscles`, `exercise_guidance`). **What I did:** (1) Updated `/api/programs` query to use nested selects for the related tables: `exercise_equipment(equipment_name, is_required)`, `exercise_muscles(muscle_name, is_primary)`, `exercise_guidance(section, content, sort_order)`. (2) Updated `normalizeProgramPatternModifiers()` to transform these nested arrays into the format the frontend expects: `equipment: {required: [...], optional: [...]}`, `primary_muscles: [...]`, `secondary_muscles: [...]`, `guidance: {motor_cues: [...], compensation_warnings: [...], safety_flags: [...], external_cues: [...]}`. **Files:** `pt-rebuild/lib/handlers/programs.js`.

- **2026-02-04** — **Problem:** History display didn't show side information for sided exercises, and side selector wasn't shown if exercise wasn't found in allExercises. **What I did:** (1) Updated history `setsSummary` to append "(L)" or "(R)" for sets with side data. (2) Updated `openEditSessionModal()` to detect `isSided` from either exercise pattern OR presence of side data in existing sets, ensuring side selector appears even if exercise lookup fails. **Files:** `pt-rebuild/public/index.html`.

- **2026-02-04** — **PWA Offline Support Implementation.** **Problem:** App was intended to work offline as a PWA, but data didn't persist to IndexedDB. The `OfflineManager` class existed in `/js/offline.js` but wasn't wired up to `index.html`. **What I did:** (1) Fixed `offline.js` to use proper native IndexedDB patterns (added `_waitForTransaction()` helper, fixed transaction completion handling). (2) Wired up `OfflineManager` in `index.html`: imports module, initializes on app start, sets up online/offline event listeners. (3) Implemented offline-only cache: when offline, loads from IndexedDB; when online, fetches from API directly (no stale-then-refresh pattern which would cause jarring re-renders and scroll position loss). (4) Added auto-sync on reconnection: when coming back online, syncs pending queue items and refreshes cache. (5) Added `updateSyncStatusUI()` function showing sync badge states: red for pending items, gray for offline. (6) Updated `/api/sync.js` to write to `offline_mutations` table for server-side audit. (7) Cache hydration happens in background after successful API load. **Architecture:** Online: API fetch → render once → hydrate cache in background. Offline: IndexedDB cache → render once. Auto-sync: online event → sync pending queue → hydrate cache. **Files:** `pt-rebuild/public/js/offline.js`, `pt-rebuild/public/index.html`, `pt-rebuild/api/sync.js`.

## 2026-02-16

### Security Hardening (Low-Risk Only)

All changes are low-risk, non-breaking hardening. Medium/high-risk items deferred (see Remaining Work below).

- **2026-02-16** — **Removed hardcoded Supabase fallback credentials from `pt_editor.js`.** The client-side editor had `FALLBACK_SUPABASE_URL` and `FALLBACK_SUPABASE_ANON_KEY` constants used when `/api/env` failed. Removed these and replaced with an explicit `throw new Error(...)` so a config failure is visible rather than silently using stale credentials. **Files:** `pt-rebuild/public/js/pt_editor.js`.

- **2026-02-16** — **Restricted `/api/debug` endpoint to admin role only.** Previously any authenticated user could call `GET /api/debug` and see their full user context object. Now returns 403 for non-admins. **Files:** `pt-rebuild/api/debug.js`.

- **2026-02-16** — **Cached admin Supabase client as singleton in `db.js`.** The anon client was already cached, but `getSupabaseAdmin()` created a new `createClient()` instance on every call. Now uses `supabaseAdminClient` singleton matching the anon client pattern. **Files:** `pt-rebuild/lib/db.js`.

- **2026-02-16** — **Added error checks on delete operations in `logs.js` update path.** The `updateActivityLog()` PATCH handler deleted existing sets and form_data before inserting replacements, but never checked the delete results. If deletes failed silently, subsequent inserts would create duplicate sets. Now checks `formDeleteError` and `setsDeleteError` and throws on failure. **Files:** `pt-rebuild/api/logs.js` (lines 357-371).

- **2026-02-16** — **Stripped `error.message` from all 500 responses in production.** 25 instances across 8 API files were leaking internal error details (stack traces, DB error messages) to clients. Changed all to `details: process.env.NODE_ENV === 'development' ? error.message : undefined` so details only appear in dev mode. **Files:** `api/logs.js`, `api/vocab.js`, `api/roles.js`, `api/reference-data.js`, `api/users.js`, `lib/handlers/exercises.js`, `lib/handlers/programs.js`.

- **2026-02-16** — **Deleted dead code files `tracker.js` and `report.js`.** Verified zero HTML references and zero `import` statements across the entire `public/` directory. Removed from `sw.js` STATIC_ASSETS list and bumped service worker cache to v7 to force clients to drop the stale cached copies. **Files:** deleted `public/js/tracker.js`, deleted `public/js/report.js`, `public/sw.js`.

### Read Receipts Feature

- **2026-02-16** — **Added `read_at` timestamp column to `clinical_messages`.** Created migration `011_add_message_read_at.sql` (idempotent with `IF NOT EXISTS`). Column was also added directly to live Supabase DB by user, so migration is documentation/safety net only. Updated `schema.sql` to match live DB (also added `sent_at` column that existed in live DB but was missing from repo schema). **Files:** `db/migrations/011_add_message_read_at.sql`, `db/schema.sql`.

- **2026-02-16** — **Added `supabase_schema.sql` to repo.** User exported live Supabase schema and committed to main. Merged into feature branch. This file is the authoritative reference for live DB state. **Files:** `db/supabase_schema.sql` (from main).

- **2026-02-16** — **Wired up server-side read tracking in `logs.js` `updateMessage()`.** When `PATCH` is called with `{ read: true }`, the handler now also sets `read_at` to the current timestamp — but only on first read (never overwritten, never cleared). The existing `read_by_recipient` boolean still gets set/unset normally. **Files:** `api/logs.js` (lines 661-667).

- **2026-02-16** — **Wired up read receipts in both frontend views.** (1) **Mark as read server-side:** When messages modal opens, `markReceivedMessagesAsRead()` fetches all messages, finds unread ones where current user is the recipient, and fires PATCH `{ read: true }` for each (fire-and-forget, non-blocking). (2) **Display read status on sent messages:** Each sent message now shows "Read [local datetime]" in green (using existing `formatMessageDateTime()` which uses local timezone) or "Delivered" in grey if unread. Read receipt appears bottom-right of the message card. **Files:** `public/index.html`, `public/pt_view.html`.

---


### Reference: Live DB vs Repo Schema

The file `db/supabase_schema.sql` is the authoritative live DB export. The file `db/schema.sql` is the repo's CREATE TABLE script (used for documentation and fresh deploys). These should be kept in sync. As of 2026-02-16 they match, including the `read_at` and `sent_at` columns on `clinical_messages`.

- **2026-02-17** — **Documentation:** Added `docs/API_SLOT_STRATEGY_2026-02-17.md` to preserve a risk-weighted API slot allocation analysis (current endpoint usage, callsite mapping, and cost-vs-benefit recommendations for merges/splits under Vercel free-tier limits) so future local Codex runs can reuse findings without repeating discovery.
- **2026-02-17** — **API slot consolidation + debug removal.** Consolidated route wrappers by removing `api/programs/[id].js` and `api/exercises/[id].js`, keeping `api/programs/index.js` and `api/exercises/index.js` as single entry points backed by shared handlers. Updated frontend update callsites to use query-param IDs (`/api/programs?id=...`, `/api/exercises?id=...`) so PUT/DELETE continue to resolve through handler ID fallback (`req.query.id` / body `id`). Removed `api/debug.js` to reclaim another function slot. **Validation:** confirmed no remaining `/api/programs/` or `/api/exercises/` path-param callsites in `public/`, and no `/api/debug` app callsites. **Files:** `pt-rebuild/public/js/pt_editor.js`, `pt-rebuild/api/programs/[id].js` (deleted), `pt-rebuild/api/exercises/[id].js` (deleted), `pt-rebuild/api/debug.js` (deleted), `pt-rebuild/docs/DEVELOPMENT.md`.



- **2026-02-17** — **Offline queue write integrity fix.** `addToQueue()` now resolves on IndexedDB transaction completion and only reports success after commit. **Files:** `pt-rebuild/public/js/offline.js`.
