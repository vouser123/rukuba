# O&M Timing Practice Prototype

Single-file web prototype (`index.html`) for timing practice aligned to street-crossing decision making.

## Purpose

The app trains intuitive comparison between:
- time the user needs to clear (`Start -> Halfway`, `Start -> Finish`, or `Start -> Halfway -> Finish`)
- warning time inferred from traffic (shorter/longer than needed clearance)

Feedback model:
- direction of timing error: inferred from sequence order (user sound vs reference sound)
- magnitude of timing error: inferred from the temporal gap
- acceptable vs outside margin: separate feedback tone family

No numeric error output is required for end users.

## Current File Layout

Everything is in `index.html`:
- CSS
- UI markup
- all JS behavior/state/config

Maintainer quick-jump tokens are also listed at the top of `index.html` (line numbers are approximate).

## Core UI/Flow

- Main action button: `Begin` -> `Mark` -> `Replay`
- Mode selector:
  - `Start -> Finish`
  - `Start -> Halfway`
  - `Start -> Halfway -> Finish`
- Settings modal:
  - Sound calibration (acceptable/outside options + user replay tone toggle)
  - Timing input (`clearTime`, `fullTime`)
  - Exemplar playback buttons
  - Margin and debug toggle
- Accessibility modal:
  - output mode
  - visual options
  - theme/text size/high contrast/focus boost
  - SR announcement toggle

## Sound Configuration (Primary Maintainer Section)

### 1) Timing/Loudness test knobs
Edit `const TEST_TUNING` in `index.html`.

Key fields:
- `replayLeadInSec`
- `exemplarLeadInSec`
- `replayEndPadSec`
- `exemplarEndPadSec`
- `masterVolume`
- `userVolume`
- `feedbackVolume`
- `confirmVolume`

### 2) Easier fallback sound editing
Use preset-based mapping:
- `const SOUND_PRESET_LIBRARY`
- `function presetTone(...)`
- `const SOUND_FALLBACK_TONES`

Recommended workflow:
1. Swap preset names in `SOUND_FALLBACK_TONES`
2. Optionally tweak `gainScale`, `durationScale`, `transposeSemitones` in `presetTone(...)`
3. Preview in Settings

### 3) Optional sfxr data path
- `const SOUND_SFXR_DATA`
- Requires local `jsfxr` script if used.
- External CDN script is intentionally removed/commented for offline reliability.
- If sfxr data is configured without engine, app logs a warning and falls back to preset tones.

## Accessibility Notes (Current)

- Marker labels above button are non-form text (`.marker-label`) to avoid SR confusion with actionable controls.
- SR announcements are suppressed during replay/exemplar audio windows to reduce ducking/interference.
- Action button label changes are announced via live region outside suppressed windows.
- Controls and hit targets were enlarged for low-vision usability.
- Accessibility icon is inline SVG (person in circle style), offline-safe.

## Debug/Verification

Current debug checkbox shows user/reference timing summary at replay start.

Recommended additions (not yet implemented):
- running replay timer display
- scheduled cue audit (expected vs scheduled in `AudioContext` time)
- optional dev-only console timing trace

## Known Issues / Risks

- Exact line numbers in maintainer comments drift as file changes.
- `:has(...)` styling for selected mode pills may vary on older browsers/WebViews (functionality still works).
- If local `jsfxr` is not provided, sfxr strings are ignored and fallback tones are used.

## TODO Backlog (Practical)

1. Persist/fix debug behavior across reset/replay exactly as desired.
2. Add optional on-screen timing audit panel (dev mode only).
3. Add local `jsfxr.js` vendored file or remove sfxr path entirely.
4. Reduce SR chatter further by cue-type filtering (validation/replay state only).
5. Add accessibility QA checklist in repo:
   - iOS VoiceOver Safari
   - Android TalkBack Chrome
   - offline mode
   - high zoom/large text
6. Consider splitting JS/CSS out of `index.html` once prototype stabilizes.

## Quick Start

1. Open `index.html` in a browser.
2. Enter timing values in Settings.
3. Choose mode and run trial with `Begin/Mark`.
4. Use replay and sound previews to tune auditory clarity.

