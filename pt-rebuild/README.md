# PT Rebuild

## What This Is

PT Rebuild is the physical therapy session logging app for `pttracker.app`. It supports two active users in practice: an admin/patient user and a therapist user. The app is deployed on Vercel and uses Supabase for auth and data.

## Two Structures in This Folder

This folder currently contains two active application structures:

- The legacy vanilla JavaScript app lives in [`public/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public) and [`api/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api). The HTML pages in `public/` still exist and some remain live.
- The in-progress Next.js migration lives in [`pages/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages), [`components/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components), [`hooks/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks), and the Next.js-layer files in [`lib/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib).

The migration is incremental. Old HTML pages are retired one at a time after the Next.js replacement is checked and accepted. The working migration branch is `nextjs`. For migration status, see [`docs/NEXTJS_MIGRATION.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_MIGRATION.md).

Current visible page mapping:

- [`pages/index.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/index.js) is the Phase 4 tracker page and is the Next.js replacement path for `public/index.html` on cutover.
- [`pages/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/pt-view.js) replaces `public/pt_view.html`.
- [`pages/rehab.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/rehab.js) replaces `public/rehab_coverage.html`.
- [`pages/program.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/program.js) is the exercise editor route; the legacy editor page is `public/pt_editor.html`.

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Folder Structure

This is the current top-level structure that matters for app work:

```text
pt-rebuild/
|- pages/        Next.js routes and page-level orchestration
|- components/   Reusable React UI pieces and modal/panel building blocks
|- hooks/        Shared React hooks for auth, data, logging, timers, and messaging
|- lib/          Pure helpers and page-domain adapters used by Next.js code
|- api/          Legacy and still-active API routes used by both old and new frontends
|- public/       Legacy HTML app, service worker, shared assets, and old JS/CSS
|- styles/       Global Next.js styles
|- supabase/     Local Supabase config, snippets, and migrations
|- docs/         Migration docs, workflow docs, testing notes, and tracker references
|- openspec/     Spec and parity documents used during the migration
|- tests/        Automated test assets
|- test/         Additional test helpers/assets
|- scripts/      Local project scripts
```

Important sub-areas:

- [`public/index.html`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/index.html), [`public/pt_view.html`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/pt_view.html), [`public/pt_editor.html`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/pt_editor.html), and [`public/rehab_coverage.html`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/rehab_coverage.html) are the legacy page baselines used for migration parity checks.
- [`public/manifest.json`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/manifest.json) remains the shared legacy/static-site manifest, while [`public/manifest-tracker.json`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/manifest-tracker.json) is the dedicated manifest for the Next.js tracker route at `/`.
- [`public/js/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/js) and [`public/shared/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/shared) hold legacy browser-side logic that still matters until each page is fully retired.
- [`api/logs.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api/logs.js), [`api/users.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api/users.js), [`api/roles.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api/roles.js), [`api/reference-data.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api/reference-data.js), and the `api/exercises/` and `api/programs/` folders are the existing server-side surface.
- [`styles/globals.css`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/styles/globals.css) is loaded by [`pages/_app.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/_app.js) and provides app-wide styling variables and resets for Next.js pages.

## Shared Components

Use these from `components/` when building or wiring Next.js pages. Prefer existing shared pieces before creating new page-local UI.

- [`components/AuthForm.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/AuthForm.js): Shared sign-in form. Use it on authenticated pages instead of writing an inline login form. Basic usage: `<AuthForm title="..." onSignIn={signIn} />`.
- [`components/NavMenu.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/NavMenu.js): Shared React navigation drawer. Use it instead of legacy hamburger globals or script tags.
- [`components/NativeSelect.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/NativeSelect.js): iOS-safe native select with optional "Other" text entry. Use it for app selects that need touch-safe behavior.
- [`components/ExercisePicker.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExercisePicker.js): Exercise search, sort, and select UI for the tracker. Use it when the user needs to choose an exercise from the active program list.
- [`components/SessionLoggerModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/SessionLoggerModal.js): Manual session/set entry and edit modal with per-set fields. Use it for history log maintenance and tracker-owned manual set entry flows; route-level final session notes/backdate still belong in [`pages/index.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/index.js).
- [`components/SessionNotesModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/SessionNotesModal.js): Tracker finish-session notes and optional backdate modal. Use it for the route-level finalization step after an in-progress tracker session has accepted at least one set.
- [`components/TimerPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/TimerPanel.js): In-panel execution UI for reps, hold, duration, and distance flows. Use it when the user is actively logging an exercise from the tracker.
- [`components/PocketModeOverlay.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PocketModeOverlay.js): Full-screen pocket interaction surface for timer-driven logging. Use it as the touch-first companion to `TimerPanel`.
- [`components/NextSetConfirmModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/NextSetConfirmModal.js): Confirmation step for app-recorded next-set logging. Use it when the timer flow has built a set patch that still needs user confirmation.
- [`components/HistoryPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/HistoryPanel.js): Tracker history tab panel. Use it on the tracker page instead of duplicating history-tab rendering.
- [`components/BottomNav.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/BottomNav.js): Fixed bottom tab bar for tracker page navigation between exercise and history views.
- [`components/HistoryList.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/HistoryList.js): Session history list grouped by date with expandable detail. Use it where the page needs read-only history rendering.
- [`components/MessagesModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/MessagesModal.js): Messaging modal used by migrated pages that surface conversation threads.
- [`components/ExerciseHistoryModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseHistoryModal.js): Exercise-specific history modal used by the history dashboard.
- [`components/PatientNotes.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PatientNotes.js): Patient notes panel with keyword highlighting and dismiss behavior.
- [`components/DosageModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/DosageModal.js): Shared dosage editor for patient exercise programs.
- [`components/ProgramRolesSection.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ProgramRolesSection.js): Standalone roles-management section for the `/program` editor page. Use it when the exercise editor needs roles outside the core exercise form.
- [`components/ExerciseForm.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseForm.js): Orchestrates the exercise editor form. Use it on the editor page instead of rebuilding exercise CRUD UI.
- [`components/ExerciseFormCore.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormCore.js), [`components/ExerciseFormCues.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormCues.js), and [`components/ExerciseFormLifecycle.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormLifecycle.js): Split sections of the exercise editor form. These support `ExerciseForm`; the form now owns exercise details, guidance, lifecycle, and read-only vocabulary reference, while `/program` handles roles and dosage as separate workspace sections.
- [`components/CoverageSummary.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageSummary.js), [`components/CoverageMatrix.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageMatrix.js), [`components/CoverageCapacity.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageCapacity.js), and [`components/CoverageExerciseCard.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageExerciseCard.js): Shared rehab coverage page renderers. Use them for the rehab page rather than embedding matrix logic in the page file.

### Timer And Sound Wiring

This is the current tracker execution stack for timer, audio, and speech behavior:

- [`components/TimerPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/TimerPanel.js): Renders the timer/counter UI and dispatches user intents such as side selection, start/pause, reset, and apply/open-manual actions.
- [`components/PocketModeOverlay.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PocketModeOverlay.js): Renders the pocket-mode interaction layer and forwards tap/long-press intents.
- [`hooks/useTimerSpeech.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerSpeech.js): The panel-facing execution hook. It combines exercise metadata, selected-side state, timer state, set-patch shaping, and cue dispatch for `TimerPanel`.
- [`hooks/useExerciseTimer.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useExerciseTimer.js): Thin timer adapter around the machine. It owns the running interval and dispatches timer events into the machine.
- [`hooks/useTimerAudio.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerAudio.js): Executes emitted effects such as beeps, countdown warnings, speech, and queue clearing. Use it for side effects, not business rules.
- [`hooks/useLoggerFeedback.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useLoggerFeedback.js): Tracker feedback hook for session-complete speech, exact save-success copy, and delayed comparison speech. Use it for tracker-wide feedback timing and spoken completion behavior that sits above the timer machine.
- [`lib/logger-timer-machine.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-timer-machine.js): Pure timer/cue transition core. This is the rule layer for state transitions and emitted effects.
- [`lib/timer-panel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/timer-panel.js): Pure helpers for exercise mode detection, target values, display formatting, rep labels, and set-patch construction.

If Claude is wiring the tracker page:

- `pages/index.js` owns the page flow and hands the selected exercise into `TimerPanel`.
- `TimerPanel` should stay UI-thin and call the hook API rather than hard-coding cue rules.
- `useTimerSpeech` is the current integration surface for the panel.
- `useExerciseTimer` and `useTimerAudio` are adapters/executors below that surface.
- `useLoggerFeedback` owns tracker-wide completion/save/comparison feedback above the timer stack.
- `logger-timer-machine.js` is the place for transition and cue logic, not the UI.

Current cue rules that matter for tracker work:

- Rep counter uses a soft tick on every tap.
- Standard rep milestone speech is `5 reps left`, `3 reps left`, `Last rep`, then `Set complete`.
- Low-rep activities under `5` reps announce every remaining rep after progress changes:
  - example for a `3`-rep activity: `2 reps left`, `Last rep`, `Set complete`
- Hold timers use countdown warning beeps at `3/2/1`, a completion triple-beep at each timed rep end, and rep milestone speech after each completed timed rep.
- Duration timers use countdown warning beeps at `3/2/1`, a completion triple-beep at timer end, and richer completion speech in the form `Set X of Y complete`, including side when relevant.
- Timer start uses a confirmation beep for targets `>= 5` seconds and does not speak `Start`.
- Timer pause speaks `Pause` when the target is `> 5` seconds or when Pocket Mode is open.
- Pocket Mode inherits the normal timer/counter cues and adds a partial-confirm beep for hold long-press.
- Delayed progress-comparison speech runs after successful `Next Set` confirmation, not during live counting/timing. The current model compares against the most recent comparable prior session before the panel opened, using:
  - best-set improvement first
  - then total-volume drop
  - then total-volume improvement

Known follow-up:

- Initial sided logger open still needs the spoken `Working left side` / `Working right side` cue. This is tracked in Beads as `pt-ryf.1`.

## Shared Utilities

Use these `lib/` files from Next.js pages and hooks when you need shared logic. These are the current Next.js-layer utility files.

- [`lib/supabase.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/supabase.js): Shared Supabase client for the Next.js app. Import `supabase` from here; do not create a new client elsewhere in Next.js pages/hooks.
- [`lib/text-format.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/text-format.js): Pure string-formatting helpers for typed values and labels. Commonly paired with `NativeSelect`.
- [`lib/date-utils.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/date-utils.js): Shared calendar-day date helpers. Use it when recency, `Done today`, or overdue timing must follow local-midnight semantics instead of rolling 24-hour math.
- [`lib/rehab-coverage.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/rehab-coverage.js): Pure coverage calculations and constants for the rehab page. Use it for data shaping, not UI rendering.
- [`lib/index-data.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-data.js): Fetch adapters for tracker exercises, programs, and history logs.
- [`lib/index-history.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-history.js): Tracker history/adherence helpers such as badge state and filtering.
- [`lib/index-offline.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-offline.js): Pure offline queue helpers for load/save/remove/build-payload behavior.
- [`lib/index-tracker-session.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-tracker-session.js): Pure helpers for index tracker draft-session state, optimistic local history insertion, and local datetime formatting used by finalization UI.
- [`lib/session-form-params.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/session-form-params.js): Helpers for history-derived and exercise-derived form parameter defaults.
- [`lib/session-logging.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/session-logging.js): Pure helpers for activity type inference, default set creation, set normalization, and create payload shaping.
- [`lib/timer-panel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/timer-panel.js): Pure timer/counter helpers used by the tracker execution stack.
- [`lib/logger-timer-machine.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-timer-machine.js): Pure timer/cue transition machine used by the current tracker execution stack.
- [`lib/logger-progress-comparison.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-progress-comparison.js): Pure helpers for delayed progress-comparison speech after set logging.
- [`lib/users.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/users.js): Shared API helpers for user data and email notification preferences (`fetchUsers`, `patchEmailNotifications`). Use it on any Next.js page that needs to look up user records or the current user's recipient ID for messaging. Extracted from `lib/pt-view.js` so it can be shared across `pages/index.js` and `pages/pt-view.js`.
- [`lib/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/pt-view.js): Page-domain helpers and fetch logic for the history dashboard. User/email helpers have moved to `lib/users.js`.
- [`lib/pt-editor.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/pt-editor.js): Page-domain helpers and fetch logic for the exercise editor.
- [`lib/vocab-options.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/vocab-options.js): Shared helper for turning vocabulary rows into `NativeSelect` option objects with consistent labels. Use it for vocab-backed editor controls instead of repeating mapping logic in components.

Legacy API layer in `lib/`:

- [`lib/auth.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/auth.js): Legacy API-layer auth helpers. Do not treat this as the shared Next.js auth surface.
- [`lib/db.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/db.js): Legacy API-layer database helpers. Do not import this into Next.js pages/components as a shared frontend utility.

## Shared Hooks

Use these from `hooks/` to keep page files thin and consistent with the current migration structure.

- [`hooks/useAuth.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useAuth.js): Shared authentication hook. Use it on any Next.js page that needs session, sign-in, or sign-out.
- [`hooks/useIndexData.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useIndexData.js): Loads tracker bootstrap data for exercises, programs, and logs.
- [`hooks/useIndexOfflineQueue.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useIndexOfflineQueue.js): Manages the tracker offline queue, queue persistence, sync, and sign-out cleanup.
- [`hooks/useManualLog.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useManualLog.js): Owns in-progress manual set logging state on the tracker page, including add/remove/edit handlers and modal submit/close behavior while a draft session is open.
- [`hooks/useTrackerSession.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTrackerSession.js): Owns the active tracker-session lifecycle for the index page, including selected exercise state, draft session state, timer/modal flow, optimistic history insertion, and finish-session save behavior.
- [`hooks/useSessionLogging.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useSessionLogging.js): Owns manual create/edit logging state and submit behavior for the session logger modal.
- [`hooks/usePanelSessionProgress.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/usePanelSessionProgress.js): Tracks per-exercise progress during the open tracker session so the panel and history filter stay aligned.
- [`hooks/useLoggerFeedback.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useLoggerFeedback.js): Owns tracker-wide spoken/text feedback such as `All sets complete`, delayed comparison speech, and exact `Saved (with notes)` / `Saved (no notes)` success copy.
- [`hooks/useExerciseTimer.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useExerciseTimer.js): Timer adapter for hold/duration flows built on the logger timer machine.
- [`hooks/useTimerAudio.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerAudio.js): Audio and speech side-effect executor for timer feedback.
- [`hooks/useTimerSpeech.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerSpeech.js): Panel-facing execution hook for the tracker timer flow.
- [`hooks/useMessages.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useMessages.js): Shared messaging hook used by migrated pages that open the messages modal.

## Key Docs

- [`docs/NEXTJS_MIGRATION.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_MIGRATION.md): Migration status, decisions, and phase context.
- [`docs/NEXTJS_STRUCTURE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_STRUCTURE.md): Authoring rules for file structure, split decisions, and size guidance.
- [`AGENTS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/AGENTS.md): Workflow and operating rules for agents in `pt-rebuild`.
- [`docs/BEADS_TEMPLATE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/BEADS_TEMPLATE.md): Required Beads issue template.

## Maintaining This Document

Update this README in the same change when any of these happen:

- A shared Next.js file is added, removed, renamed, or given a different responsibility
- A legacy HTML page is replaced, retired, redirected, or mapped to a different Next.js route
- Cleanup or refactor work changes which file owns a concern that another agent would need to find
- Timer/audio/logger wiring changes enough that the ownership notes would become outdated

How to update it:

- Keep it factual. Document what exists now, not planned future structure.
- Update the relevant section entry instead of leaving stale file names behind.
- For shared files, keep each entry to: what it does, when to use it, and any important boundary such as “UI only” or “pure helper”.
- Keep legacy API-layer files clearly separated from Next.js shared utilities.
- If the architecture changes substantially and this file would be overwritten rather than edited, create a backup first.

Recommended entry template for shared files:

```md
### `path/to/file.js`

- What it is: short ownership statement
- Use it when: the situations where an agent should reach for this file
- Do not use it for: nearby concerns that belong in a different file/layer
- Depends on: lower-level helpers/components/hooks it relies on when that matters
- Used by: main callers, pages, or shared surfaces that wire it in
- Notes: behavior rules or caveats that affect integration
```

Minimum bar for an entry:

- what the file owns
- when to use it
- where not to put adjacent logic if that boundary is important

## Deployment

- Vercel project: `pt-rehab`
- Production: [https://pttracker.app](https://pttracker.app)
- Preview for `nextjs` branch: [https://pt-rehab-git-nextjs-pt-tracker.vercel.app](https://pt-rehab-git-nextjs-pt-tracker.vercel.app)
- Supabase project: `zvgoaxdpkgfxklotqwpz`
