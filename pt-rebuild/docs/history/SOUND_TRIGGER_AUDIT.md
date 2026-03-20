# Sound Trigger Audit (`public/index.html`)

Date: 2026-02-25  
Scope: **all sound triggers, including spoken audio**, with direct + indirect trigger conditions, call lines, and logic.

## Files Reviewed

### Primary runtime file
- `pt-rebuild/public/index.html` (inline app runtime: counter/timer/session/audio logic)

### Referenced files followed from `index.html`
- `pt-rebuild/public/js/offline.js` (module imported at startup) — **no sound/speech emitters or calls**
- `pt-rebuild/public/js/vendor/supabase.min.js` (vendor client) — **no app-level sound/speech trigger logic**

> Note: `/_vercel/*` scripts are external analytics and not part of the repo-managed exercise audio flow.

## Exhaustiveness Verification Method

To reduce miss risk, this audit was validated with redundant passes:

1. **Keyword sweep in `index.html`** for audio/speech primitives and likely aliases (`speechSynthesis`, `SpeechSynthesisUtterance`, `AudioContext`, `webkitAudioContext`, `createOscillator`, `.play(`, `new Audio`, `beep`, `voice`, `announce`, `sound`).
2. **Callsite sweep** for all local emitters/callers (`speakText`, `playBeep`, `playCompletionSound`, `ensureAudioReady`, `announceProgressComparison`, timer/counter entry points).
3. **Dispatcher chain sweep** across `data-action` routes to ensure UI event paths that reach sound are captured.
4. **Referenced-file sweep** for `public/js/offline.js` and `public/js/vendor/supabase.min.js` for any additional audio/speech emissions.

Result: all repository-controlled sound/speech outputs reachable from `public/index.html` are represented below.

---

## Audio Emitter Primitives (actual output mechanisms)

| Primitive | Type | Definition line(s) | Behavior |
|---|---|---:|---|
| `ensureAudioReady()` | audio init/unlock | `2781-2793` | Creates `AudioContext` / `webkitAudioContext` if absent; resumes if suspended. |
| `playBeep(frequency, duration)` | tone | `2799-2823` | One square-wave beep via oscillator + gain envelope. |
| `playCompletionSound()` | tone sequence | `2829-2837` | Schedules 3 ascending beeps (`1000Hz`, `1200Hz`, `1400Hz`). |
| `speakText(text)` | spoken TTS | `2843-2855` | `SpeechSynthesisUtterance` with rate/pitch/volume set to `1.0`, then `speechSynthesis.speak()`. |

---

## Complete Trigger Inventory (direct call sites)

| ID | Output | Direct call line(s) | Immediate condition block |
|---|---|---:|---:|
| ST-01 | Spoken: `All sets complete` | `2529` | `2504-2531` |
| ST-02 | Spoken: `5 reps left` / `3 reps left` / `Last rep` | `2595`, `2597`, `2599` | `2584-2604` |
| ST-03 | Completion beeps + spoken `Set complete` (counter mode) | `2601`, `2602` | `2584-2604` |
| ST-04 | Spoken: `Start` | `2694` | `2686-2696` |
| ST-05 | Countdown warning beep (`600Hz`, `100ms`) at `3/2/1` | `2711` | `2697-2713` |
| ST-06 | Completion beeps at timer zero | `2715` | `2714-2717` |
| ST-07 | Spoken hold completion: `Set complete` / `Last rep` / `{n} reps left` | `2723`, `2725`, `2727` | `2718-2737` |
| ST-08 | Spoken duration completion: `Set complete` | `2740` | `2737-2744` |
| ST-09 | Spoken: `Pause` | `2761` | `2754-2763` |
| ST-10 | Spoken side callout: `Working {side} side` | `2894` | `2876-2895` |
| ST-11 | Spoken progress delta positive: `{n} more rep(s) than last time` | `3266` | `3238-3269` |
| ST-12 | Spoken progress delta negative: `{n} fewer reps than last time` | `3268` | `3238-3269` |
| ST-13 | First-interaction audio unlock (`ensureAudioReady`) | `4658` | `4656-4659` |
| ST-14 | Completion triple-beep internals | `2831`, `2832`, `2833` | `2829-2837` |

---

## Indirect Trigger Paths (UI/action → function chain → sound)

This section answers **when/how** each sound is reached from user-visible actions.

### A) Side-switch speech (`Working {side} side`) has **two origins**

1. **Automatic on exercise start for side-pattern exercises**  
   - `startLoggingSession` path sets default side to right and calls `selectSide('right')` (`2455-2460`), which then calls `speakText(...)` (`2876-2895`).
2. **Manual side button press**  
   - `data-action="select-side"` in pointerup dispatcher calls `selectSide(target.dataset.side)` (`4896-4898`) → `speakText(...)` (`2894`).

### B) Counter milestone/completion speech + completion beeps

- Pointerup action routing maps `counter-tap` and `counter-increase` to `increaseCounter()` (`4807-4810`).
- `increaseCounter()` calculates `repsLeft` and emits milestone speech at `5/3/1` remaining and completion beep+speech at `0` (`2584-2604`).

### C) Timer Start/Pause speech and countdown/completion beeps

- Pointerup action routing maps `timer-start-pause` to `toggleTimer()` (`4814-4815`), which chooses `startTimer()` or `pauseTimer()` (`2678-2684`).
- `startTimer()` emits `Start` only if target > 10s (`2693-2695`), emits warning beep at `3/2/1` (`2710-2712`), and completion triple-beep at zero (`2714-2716`).
- At timer zero, branch behavior differs:
  - Hold branch speaks rep-status (`2720-2728`),
  - Duration branch speaks `Set complete` (`2737-2741`).
- Manual pause path speaks `Pause` only if `announce=true` and target >10s (`2760-2762`).

### D) Set-progress and progress-comparison speech

- `updateSetsProgress()` is invoked from multiple flows: session start (`2473`), confirm-next-set (`3208`), previous-set undo (`3230`), save-logged-set (`3645`).
- It only emits `All sets complete` once per session due to `currentSession.allSetsAnnouncedComplete` guard (`2527-2529`).
- `announceProgressComparison(set)` is invoked from both confirm-next-set (`3214`) and save-logged-set (`3651`).
- Comparison speech is delayed 1500ms and asymmetrical (`3238-3269`):
  - positive deltas always announced,
  - negative deltas only when drop is `> 2` reps.

### E) Audio unlock/init behavior

- First body `pointerup` runs `ensureAudioReady()` once (`4656-4659`) to satisfy iOS/Safari interaction gating.
- `playBeep()` also calls `ensureAudioReady()` before emitting tone (`2801`), giving both proactive + on-demand unlock attempts.

---

## Behavior Matrix by Exercise/Timer Type

| Mode | Triggered sounds/speech | Governing logic |
|---|---|---|
| Rep counter (`counterMode` visible) | Milestone speech (5/3/1 left), completion triple-beep + `Set complete`, optional historical comparison speech, optional `All sets complete` speech | `increaseCounter` + `announceProgressComparison` + `updateSetsProgress` |
| Hold timer (`hold_seconds` / `dosage_type=hold`) | Optional `Start`/`Pause` (>10s only), warning beep at 3/2/1, completion triple-beep at zero, rep-status speech at each rep completion, optional historical comparison speech, optional `All sets complete` speech | `startTimer` hold branch + `pauseTimer` + set logging flows |
| Duration timer (`duration_seconds` / `dosage_type=duration`) | Optional `Start`/`Pause` (>10s only), warning beep at 3/2/1, completion triple-beep + `Set complete`, optional historical comparison speech, optional `All sets complete` speech | `startTimer` duration branch + `pauseTimer` + set logging flows |
| Side-pattern exercises (`pattern='side'`) | `Working {side} side` speech on auto-default right at session start + every manual side switch | `startLoggingSession` default `selectSide('right')` + side button dispatcher |

---

## Missed-Item Recheck Findings (delta vs previous draft)

The following high-impact trigger details were expanded/clarified in this revision because they can explain perceived inconsistency:

1. **Auto side speech on session start** (not just manual side button presses).  
2. **Exact UI action dispatcher chains** (`data-action` routes) from button/tap to sound call.  
3. **Multiple invocation points** for `updateSetsProgress()` and `announceProgressComparison()`, which changes when voice feedback appears in different logging flows.
4. **Exhaustiveness method explicitly documented** so follow-up audits can replicate the same verification process.

---

## Consistency Hotspots for Next Iteration

1. **Asymmetric comparison feedback**: positive deltas always spoken; negative only when drop exceeds 2 reps.
2. **Start/Pause threshold gate**: short timers (<=10s) omit `Start`/`Pause` speech.
3. **Hold completion-branch detector nuance**: timer-zero hold branch checks `pattern_modifiers?.includes('hold_seconds')` (not `dosage_type === 'hold'` in that exact check).
4. **Speech queue accumulation**: `speakText()` does not cancel/flush queued utterances.
5. **Mixed signal styles**: some milestones are speech-only, others speech+tones.
