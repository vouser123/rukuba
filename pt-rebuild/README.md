# PT Rebuild

## Repo Shape

PT Rebuild is the physical therapy session logging app for `pttracker.app`. It is deployed on Vercel and uses Supabase for auth and data.

This folder contains two active code surfaces that agents must distinguish before editing:

- Legacy surface: [`public/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public) and [`api/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/api). Some HTML pages in `public/` still define live or parity-relevant behavior.
- Next.js surface: [`pages/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages), [`components/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components), [`hooks/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks), and the Next.js-layer files in [`lib/`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib).

Default routing rule:

- Treat the legacy static surface as frozen for routine work.
- Only touch legacy/static files for user-approved work, security issues, or explicit migration/parity work that must read or preserve the static contract.
- Put normal feature work, cleanup, shared-pattern alignment, and modernization on the Next.js surface.

Use [`docs/NEXTJS_MIGRATION_STATUS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_MIGRATION_STATUS.md) only for migration-status context. Use this README for the current file-ownership map.

## Current Route And Legacy Surface Map

Current visible page mapping:

- [`pages/index.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/index.js) is the Next.js tracker route. Legacy parity baseline: [`public/index.html`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/public/index.html).
- [`pages/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/pt-view.js) replaces `public/pt_view.html`.
- [`pages/rehab.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/rehab.js) replaces `public/rehab_coverage.html`.
- [`pages/program.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/program.js) is the exercise editor route; the legacy editor page is `public/pt_editor.html`.

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

Pointers:

- For route-to-legacy ownership, see `Current Route And Legacy Surface Map` above.
- For shared Next.js file ownership, see `Shared Components`, `Tracker Execution Stack`, `Shared Utilities`, and `Shared Hooks` below.
- For canonical operating rules, see [`AGENTS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/AGENTS.md).

## Shared Styling

- [`styles/globals.css`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/styles/globals.css): Shared Next.js design tokens, global control typography floor, and readable-text defaults. Use it for app-wide typography tokens and global control behavior before adding page-local font-size fixes.
- Compact text is opt-in, not the default. Dense UI such as badges, timestamps, and compact metadata may use explicit compact tokens, but normal labels, helper text, and form controls should inherit the readable shared baseline.

## Shared Components

Use these from `components/` when building or wiring Next.js pages. Prefer existing shared pieces before creating new page-local UI.

- [`components/AuthForm.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/AuthForm.js): Shared sign-in form. Use it on authenticated pages instead of writing an inline login form. It now shows shared offline guidance when the browser is offline so the user knows fresh sign-in still needs network access. Basic usage: `<AuthForm title="..." onSignIn={signIn} />`.
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
- [`components/HistoryList.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/HistoryList.js): Session history list grouped by date with expandable detail. Use it where the page needs read-only history rendering. It also owns the inline history-note pill styling, including the dark-mode palette for notes shown inside session cards.
- [`components/Toast.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/Toast.js): Floating toast notification overlay. Use it with `useToast` for transient user feedback (save success, errors, sync status). Matches static app `#toastContainer` mechanics: `position:fixed`, slide-up from bottom, success/error variants.
- [`components/MessagesModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/MessagesModal.js): Messaging modal used by index and pt-view. Handles compose/send, roll-up (archive inline), restore (unarchive), and undo-send (delete within 1 hour). Requires `onSend`, `onArchive`, `onUnarchive`, `onRemove`, `onMarkRead`, `onEmailToggle`, `onOpened` props from `useMessages`.
- [`components/ExerciseHistoryModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseHistoryModal.js): Exercise-specific history modal used by the history dashboard.
- [`components/PatientNotes.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PatientNotes.js): Patient notes panel with keyword highlighting, dismiss behavior, and note-surface theming for light/dark mode on `/pt-view`.
- [`components/PtViewNeedsAttention.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PtViewNeedsAttention.js), [`components/PtViewSummaryStats.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PtViewSummaryStats.js), and [`components/PtViewFiltersPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PtViewFiltersPanel.js): Page-only rehab history panels extracted from `/pt-view`. Use them to keep the route page focused on composition instead of inline panel markup. `PtViewFiltersPanel` also owns the route's responsive filter-grid behavior, so medium-width layout fixes belong there rather than in [`pages/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/pt-view.js).
- [`components/DosageModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/DosageModal.js): Shared dosage editor for patient exercise programs.
- [`components/ProgramExerciseSelector.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ProgramExerciseSelector.js): Exercise-selection workspace for opening an existing exercise or starting a new one. Use it when an editor host needs the full selector/search/archive controls without rebuilding them inline in a route page.
- [`components/ExerciseRolesWorkspace.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseRolesWorkspace.js): Roles workspace shell with search/select controls and handoff into `ProgramRolesSection`. Use it when a route such as rehab coverage or the editor needs the full roles workspace, not just the add/remove table.
- [`components/ProgramRolesSection.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ProgramRolesSection.js): Standalone roles-management section for the `/program` editor page. Use it when the exercise editor needs roles outside the core exercise form.
- [`components/ProgramDosageWorkspace.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ProgramDosageWorkspace.js): Dosage workspace shell with patient-context banner, search/select controls, and dosage summary card. Use it when an editor host needs the full dosage workspace while leaving modal editing to `DosageModal`.
- [`components/ProgramVocabEditor.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ProgramVocabEditor.js): Standalone vocabulary-management section for the editor surface. Use it when controlled vocab terms need to be added, edited, or soft-deleted without leaving the current host route.
- [`components/ExerciseForm.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseForm.js): Orchestrates the reusable exercise editor form. Use it on any editor host route instead of rebuilding exercise CRUD UI inline.
- [`components/ExerciseFormCore.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormCore.js), [`components/ExerciseFormCues.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormCues.js), and [`components/ExerciseFormLifecycle.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/ExerciseFormLifecycle.js): Split sections of the exercise editor form. These support `ExerciseForm`; the form now owns exercise details, guidance, and lifecycle, while `/program` handles roles, dosage, and vocabulary management as separate workspace sections.
- [`components/CoverageSummary.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageSummary.js), [`components/CoverageMatrix.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageMatrix.js), [`components/CoverageCapacity.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageCapacity.js), and [`components/CoverageExerciseCard.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/CoverageExerciseCard.js): Shared rehab coverage page renderers. Use them for the rehab page rather than embedding matrix logic in the page file.

For tracker-specific timer/audio ownership boundaries, see `Tracker Execution Stack` below.

## Tracker Execution Stack

Use this section when working on tracker execution behavior, timer flow, cue wiring, or Pocket Mode. Keep specialized tracker behavior here rather than scattering it across the generic shared-file sections.

### UI Surfaces

- [`components/TimerPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/TimerPanel.js): Renders the timer/counter UI and dispatches user intents such as side selection, start/pause, reset, and apply/open-manual actions.
- [`components/PocketModeOverlay.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PocketModeOverlay.js): Renders the pocket-mode interaction layer and forwards tap/long-press intents.
- [`components/NextSetConfirmModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/NextSetConfirmModal.js): Confirmation step for app-recorded next-set logging after the execution stack has built a set patch.

### Hook Integration Layer

- [`hooks/useTimerSpeech.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerSpeech.js): The panel-facing execution hook. It combines exercise metadata, selected-side state, timer state, set-patch shaping, and cue dispatch for `TimerPanel`.
- [`hooks/useExerciseTimer.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useExerciseTimer.js): Thin timer adapter around the machine. It owns the running interval and dispatches timer events into the machine.
- [`hooks/useTimerAudio.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerAudio.js): Executes emitted effects such as beeps, countdown warnings, speech, and queue clearing. Use it for side effects, not business rules.
- [`hooks/useLoggerFeedback.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useLoggerFeedback.js): Tracker feedback hook for session-complete speech, exact save-success copy, and delayed comparison speech. Use it for tracker-wide feedback timing and spoken completion behavior that sits above the timer machine.

### Pure Rule And Helper Layer

- [`lib/logger-timer-machine.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-timer-machine.js): Pure timer/cue transition core. This is the rule layer for state transitions and emitted effects.
- [`lib/timer-panel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/timer-panel.js): Pure helpers for exercise mode detection, target values, display formatting, rep labels, and set-patch construction.

### Ownership Boundaries

- `pages/index.js` owns the page flow and hands the selected exercise into `TimerPanel`.
- `TimerPanel` should stay UI-thin and call the hook API rather than hard-coding cue rules.
- `useTimerSpeech` is the current integration surface for the panel.
- `useExerciseTimer` and `useTimerAudio` are adapters/executors below that surface.
- `useLoggerFeedback` owns tracker-wide completion/save/comparison feedback above the timer stack.
- `logger-timer-machine.js` is the place for transition and cue logic, not the UI.

### Current Cue Rules

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

## Shared Utilities

Use these `lib/` files from Next.js pages and hooks when you need shared logic. These are the current Next.js-layer utility files.

- [`lib/supabase.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/supabase.js): Shared Supabase client for the Next.js app. Import `supabase` from here; do not create a new client elsewhere in Next.js pages/hooks. Auth persistence uses the shared IndexedDB-backed storage adapter from `lib/offline-cache.js`.
- [`lib/offline-cache.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/offline-cache.js): Shared IndexedDB cache and storage adapter for offline-capable Next.js routes. Use it for cached route bootstrap data, including tracker exercises/programs/logs fallback, editor bootstrap caches (`/program` exercises/vocab/reference data), lightweight offline UI state, and Supabase auth storage instead of `localStorage`.
- [`lib/text-format.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/text-format.js): Pure string-formatting helpers for typed values and labels. Commonly paired with `NativeSelect`.
- [`lib/date-utils.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/date-utils.js): Shared calendar-day date helpers. Use it when recency, `Done today`, or overdue timing must follow local-midnight semantics instead of rolling 24-hour math.
- [`lib/rehab-coverage.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/rehab-coverage.js): Pure coverage calculations and constants for the rehab page. Use it for data shaping, not UI rendering.
- [`lib/index-data.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-data.js): Fetch adapters for tracker exercises, programs, and history logs.
- [`lib/index-history.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-history.js): Tracker history/adherence helpers such as badge state and filtering.
- [`lib/index-offline.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-offline.js): Pure tracker offline-queue helpers for IndexedDB-backed load/save/remove/build-payload behavior. Use it for queue persistence rules; page/hooks own the async hydration and sync flow.
- [`lib/index-tracker-session.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-tracker-session.js): Pure helpers for index tracker draft-session state, optimistic local history insertion, and local datetime formatting used by finalization UI.
- [`lib/session-form-params.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/session-form-params.js): Helpers for history-derived and exercise-derived form parameter defaults.
- [`lib/session-logging.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/session-logging.js): Pure helpers for activity type inference, default set creation, set normalization, and create payload shaping.
- [`lib/timer-panel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/timer-panel.js): Pure timer/counter helpers used by the tracker execution stack.
- [`lib/logger-timer-machine.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-timer-machine.js): Pure timer/cue transition machine used by the current tracker execution stack.
- [`lib/logger-progress-comparison.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/logger-progress-comparison.js): Pure helpers for delayed progress-comparison speech after set logging.
- [`lib/users.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/users.js): Shared API helpers for user data, email notification preferences, and resolved patient context (`fetchUsers`, `patchEmailNotifications`, `resolvePatientScopedUserContext`). Use it on any Next.js page that needs user records, patient-scoped route context, or the current user's recipient ID for messaging.
- [`lib/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/pt-view.js): Page-domain helpers and fetch logic for the history dashboard. Use [`lib/users.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/users.js) for shared user lookup, patient-context resolution, and email helpers.
- [`lib/pt-editor.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/pt-editor.js): Page-domain fetch and mutation helpers for the exercise editor, including controlled-vocab CRUD wrappers used by `/program`. `/program` now owns the network-or-cache bootstrap flow and uses `offlineCache` for read fallback rather than embedding cache logic here.
- [`lib/program-offline.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/program-offline.js): Pure `/program` offline mutation queue helpers. Use it for queue persistence keys, mutation merging, queue-summary labeling, local temporary IDs, and replay execution rules for exercise, role, dosage, and vocabulary writes.
- [`lib/program-optimistic.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/program-optimistic.js): Pure optimistic-state helpers for `/program` mutations. Use it when editor writes need local exercise/reference-data/dosage updates before queued sync completes.
- [`lib/vocab-options.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/vocab-options.js): Shared helper for turning vocabulary rows into `NativeSelect` option objects with consistent labels. Use it for vocab-backed editor controls instead of repeating mapping logic in components.

Legacy API layer in `lib/`:

- [`lib/auth.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/auth.js): Legacy API-layer auth helpers. Do not treat this as the shared Next.js auth surface.
- [`lib/db.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/db.js): Legacy API-layer database helpers. Do not import this into Next.js pages/components as a shared frontend utility.

## Shared Hooks

Use these from `hooks/` to keep page files thin and consistent with the current migration structure.

- [`hooks/useAuth.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useAuth.js): Shared authentication hook. Use it on any Next.js page that needs session, sign-in, or sign-out. It preserves warmed-session offline restore behavior and converts offline sign-in network failures into clearer user-facing guidance.
- [`hooks/usePtViewData.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/usePtViewData.js): Loads and caches the `/pt-view` bootstrap data for users, programs, and logs, including patient-context resolution, sign-out cleanup, and offline fallback. Use it to keep the history dashboard route at orchestrator level instead of embedding fetch and cache lifecycle logic in the page.
- [`hooks/usePtViewUiState.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/usePtViewUiState.js): Owns persisted `/pt-view` notes/filter UI state and note keyword-highlighting shaping. Use it when rehab history UI-state rules or note preprocessing change, instead of broadening [`pages/pt-view.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/pt-view.js).
- [`hooks/useRehabCoverageData.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useRehabCoverageData.js): Loads rehab coverage logs and roles, writes the rehab cache, and handles offline fallback/reload for `/rehab`. Use it for coverage bootstrap work instead of putting route fetch logic in [`pages/rehab.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/pages/rehab.js).
- [`hooks/useIndexData.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useIndexData.js): Loads tracker bootstrap data for exercises, programs, and logs. It now hydrates the shared IndexedDB cache after successful fetches, falls back to cached tracker bootstrap data on offline/network failure, exposes cached-data state for tracker shell feedback, normalizes failed-load copy, and clears the tracker read cache when auth signs out.
- [`hooks/useIndexOfflineQueue.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useIndexOfflineQueue.js): Manages the tracker offline queue, async IndexedDB hydration/persistence, sync, and sign-out cleanup.
- [`hooks/useProgramOfflineQueue.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useProgramOfflineQueue.js): Manages the `/program` offline mutation queue lifecycle, including IndexedDB hydration, online replay, queue-status reporting, failed-change recovery state, and replay refresh against the resolved patient context.
- [`hooks/useProgramMutationActions.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useProgramMutationActions.js): Owns optimistic `/program` mutation handlers for exercise saves, roles, and dosages while delegating queue lifecycle to `useProgramOfflineQueue`. Dosage writes must receive the resolved patient `users.id`, not the raw auth session ID.
- [`hooks/useProgramVocabActions.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useProgramVocabActions.js): Owns optimistic controlled-vocabulary create/update/delete handlers for `/program`. Use it to keep vocabulary mutation logic separate from the exercise/role/dosage mutation hook.
- [`hooks/useManualLog.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useManualLog.js): Owns in-progress manual set logging state on the tracker page, including add/remove/edit handlers and modal submit/close behavior while a draft session is open.
- [`hooks/useTrackerSession.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTrackerSession.js): Owns the active tracker-session lifecycle for the index page, including selected exercise state, draft session state, timer/modal flow, optimistic history insertion, and finish-session save behavior.
- [`hooks/useSessionLogging.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useSessionLogging.js): Owns manual create/edit logging state and submit behavior for the session logger modal.
- [`hooks/usePanelSessionProgress.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/usePanelSessionProgress.js): Tracks per-exercise progress during the open tracker session so the panel and history filter stay aligned.
- [`hooks/useLoggerFeedback.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useLoggerFeedback.js): Owns tracker-wide spoken/text feedback such as `All sets complete`, delayed comparison speech, and exact `Saved (with notes)` / `Saved (no notes)` success copy.
- [`hooks/useExerciseTimer.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useExerciseTimer.js): Timer adapter for hold/duration flows built on the logger timer machine.
- [`hooks/useTimerAudio.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerAudio.js): Audio and speech side-effect executor for timer feedback.
- [`hooks/useTimerSpeech.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerSpeech.js): Panel-facing execution hook for the tracker timer flow.
- [`hooks/useToast.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useToast.js): Floating toast state hook. Use it with `Toast` component for transient feedback. Provides `showToast(message, type, duration)` and props for `<Toast />`.
- [`hooks/useMessages.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useMessages.js): Shared messaging hook used by migrated pages that open the messages modal.

For timer execution hook boundaries, see `Tracker Execution Stack` above.

## Canonical Docs

- [`AGENTS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/AGENTS.md): Workflow and operating rules for agents in `pt-rebuild`.
- [`docs/README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/README.md): Docs index explaining which project doc to open and when.
- [`docs/NEXTJS_CODE_STRUCTURE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_CODE_STRUCTURE.md): Authoring rules for file structure, split decisions, and size guidance.
- [`docs/NEXTJS_MIGRATION_STATUS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/NEXTJS_MIGRATION_STATUS.md): Migration-status context and broader rollout history. Do not treat it as the primary file-ownership map.
- [`docs/IMPLEMENTATION_PATTERNS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/IMPLEMENTATION_PATTERNS.md): Approved shared helpers, components, and do-this-not-that implementation guidance.
- [`docs/BEADS_ISSUE_TEMPLATE.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/BEADS_ISSUE_TEMPLATE.md): Required Beads issue template.

## README Maintenance Rules

Update this README in the same change when any of these happen:

- A shared Next.js file is added, removed, renamed, or given a different responsibility
- A legacy HTML page is replaced, retired, redirected, or mapped to a different Next.js route
- Cleanup or refactor work changes which file owns a concern that another agent would need to find
- Timer/audio/logger wiring changes enough that the ownership notes would become outdated
- Approved shared-helper or do-this-not-that implementation guidance changes; update [`docs/IMPLEMENTATION_PATTERNS.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/IMPLEMENTATION_PATTERNS.md) in the same change

### How To Write Entries

- Keep it factual. Document what exists now, not planned future structure.
- Update the relevant section entry instead of leaving stale file names behind.
- For shared files, keep each entry to: what it does, when to use it, and any important boundary such as “UI only” or “pure helper”.
- Keep legacy API-layer files clearly separated from Next.js shared utilities.
- If the architecture changes substantially and this file would be overwritten rather than edited, create a backup first.

### Shared-File Entry Template

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

## Deployment References

- Vercel project: `pt-rehab`
- Production: [https://pttracker.app](https://pttracker.app)
- Preview for `nextjs` branch: [https://pt-rehab-git-nextjs-pt-tracker.vercel.app](https://pt-rehab-git-nextjs-pt-tracker.vercel.app)
- Supabase project: `zvgoaxdpkgfxklotqwpz`
