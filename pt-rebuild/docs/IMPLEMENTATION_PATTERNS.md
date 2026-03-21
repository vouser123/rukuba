# PT Tracker Implementation Patterns

Use this file when you know what feature you need to build, but need the approved project pattern for how to build it.

Use [`../README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md) to find file ownership.
Use this file to answer "which shared thing should I use?" and "what should I avoid re-implementing?"

These patterns are the default for current maintained codepaths, especially shared React and Next.js surfaces.
Legacy static pages may preserve existing patterns unless the work is already migrating that surface or extracting a shared helper on purpose.

## Selects And Option Lists

- Use [`components/NativeSelect.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/NativeSelect.js) for current app selects that need touch-safe, iPhone-safe behavior.
- Use [`lib/vocab-options.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/vocab-options.js) to turn vocabulary rows into select options.
- Use [`lib/text-format.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/text-format.js) when a select or companion text field needs consistent typed-value labels.
- Do not hand-roll a plain select plus custom "Other" logic when the current surface can already use `NativeSelect`.
- Do not hardcode extendable dropdown option lists without explicit sign-off. Domain data belongs in vocab/reference data, not inline arrays.

## Formatting And Labels

- Use [`lib/text-format.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/text-format.js) for typed values, labels, and value-display formatting.
- Use [`lib/session-form-params.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/session-form-params.js) for form-parameter defaults and history-derived parameter shaping.
- Do not duplicate unit-label or typed-value formatting inline across components.
- Do not create one-off parser/formatter helpers in page files when the logic is reusable.

## Dates, Recency, And Calendar-Day Logic

- Use [`lib/date-utils.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/date-utils.js) for recency, local-day comparisons, and any `Done today` or overdue semantics.
- Do not use rolling 24-hour math for calendar-day behavior.
- Do not re-implement midnight normalization separately in page or component files.

## Offline Storage And Persistence

- Use [`lib/offline-cache.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/offline-cache.js) for shared IndexedDB-backed route bootstrap and auth persistence.
- Use [`lib/index-offline.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/index-offline.js) with [`hooks/useIndexOfflineQueue.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useIndexOfflineQueue.js) for tracker offline queue behavior.
- Use [`hooks/useProgramOfflineQueue.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useProgramOfflineQueue.js) for `/program` offline mutation queue lifecycle.
- Do not introduce new app-data persistence in `localStorage`.
- Do not put IndexedDB queue rules directly into page components when a shared offline helper or hook already owns them.

## Auth, Users, And Shared Data Access

- Use [`lib/supabase.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/supabase.js) for the shared Next.js Supabase client.
- Use [`hooks/useAuth.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useAuth.js) for page-level auth/session flow.
- Use [`lib/users.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/lib/users.js) for shared user lookup, email-notification preference helpers, and patient-context resolution.
- For patient-scoped routes such as `/pt-view` and `/program` dosage, resolve the effective patient with `resolvePatientScopedUserContext(users, session.user.id)` before calling APIs that store `users.id`.
- Do not create new frontend Supabase clients in pages, components, or hooks.
- Do not bypass the shared auth flow with page-local token/session logic.
- Do not pass `session.user.id` directly into patient-program or patient-log APIs when the backend stores `users.id`; resolve the app user row first.

## Toasts, Messages, And Shared Feedback

- Use [`components/Toast.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/Toast.js) with [`hooks/useToast.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useToast.js) for transient user feedback.
- Use [`components/MessagesModal.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/MessagesModal.js) with [`hooks/useMessages.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useMessages.js) for migrated messaging flows.
- Do not create page-local toast systems or duplicate message modal behavior.
- Do not scatter message polling or read-state logic across multiple pages if `useMessages` already owns it.

## Timer, Audio, And Tracker Execution

- Keep tracker execution UI in [`components/TimerPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/TimerPanel.js) and [`components/PocketModeOverlay.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/PocketModeOverlay.js).
- Use [`hooks/useTimerSpeech.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerSpeech.js) as the panel-facing integration layer.
- Use [`hooks/useExerciseTimer.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useExerciseTimer.js) and [`hooks/useTimerAudio.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useTimerAudio.js) below that integration layer.
- Use [`hooks/useLoggerFeedback.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/hooks/useLoggerFeedback.js) for tracker-wide completion/save/comparison feedback timing.
- Do not duplicate timer machine or tracker-wide feedback rules in page files when shared hooks already own them.
- Panel-local execution feedback that belongs to [`components/TimerPanel.js`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/components/TimerPanel.js) may remain in the panel when it is part of the execution UI itself.

## Touch-Safe Interaction Patterns

- Use `pointerup` rather than `onclick` for custom interactive controls.
- Use `touch-action: manipulation` on custom tappable controls and gesture-driven surfaces.
- Do not assume native form controls like `select`, `input`, or standard `button` elements need extra touch-action styling unless device testing shows a real issue.
- Keep touch-target size at or above 44px.
- Do not add mouse-only interaction assumptions to primary app controls.

## Shared-First Decision Rule

- Before adding a new helper, check the live map in [`../README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/README.md) and the docs index in [`README.md`](C:/Users/cindi/OneDrive/Documents/GitHub/rukuba/pt-rebuild/docs/README.md).
- If a shared helper, component, or hook already owns the concern, extend it or use it instead of duplicating behavior.
- If no shared pattern exists, add the new pattern deliberately and update the relevant active docs in the same change.
