# Dev Notes

## 2026-02-07

### Scope completed today

- Added code-level sound customization path for `sfxr`-style data and fallback tone synthesis.
- Switched customization to code-based editing (no frontend paste UI).
- Expanded sound coverage to all current sound roles:
  - acceptable A/B
  - outside A/B
  - user marker
  - user confirm/chime

### Replay and exemplar behavior

- Renamed `Boundary` to `Halfway` throughout modes/UI.
- Added exemplar playback buttons for:
  - `Start -> Halfway`
  - `Start -> Finish`
  - `Start -> Halfway -> Finish`
- Unified action-button stage visuals (shape + color) across:
  - live user marking
  - replay feedback timing
  - exemplar playback

### Accessibility and low-vision updates

- Increased baseline control sizes and hit targets for mode selector and settings controls.
- Added selected-state styling for mode pills.
- Replaced accessibility icon with inline person-in-circle SVG.
- Replaced marker text markup above main button from form `<label>` to non-form `.marker-label` to reduce SR ambiguity.

### Screen reader / audio interaction adjustments

- Added explicit live-region announcements for action button label changes.
- Added announcement suppression during replay/exemplar windows to reduce ducking/interference.
- Kept non-critical SR announcements outside audio-critical windows.

### Offline and sound-engine handling

- Removed external `jsfxr` CDN dependency from active use (commented optional local include).
- Added warning when `SOUND_SFXR_DATA` is configured but `jsfxr` engine is not loaded.
- Preserved fallback synthesis path when `jsfxr` is absent.

### Maintainer ergonomics

- Added top-of-file quick-jump comment in `index.html` with key token locations.
- Added detailed in-code tuning guide above sound/timing config:
  - what each setting does
  - typical ranges
  - safe ranges
  - plain-language explanation of `transposeSemitones`
- Added `README.md` documenting:
  - purpose and feedback model
  - config/tuning workflow
  - current architecture and known risks
  - TODO backlog

### Notable current state / caveats

- `TEST_TUNING.replayLeadInSec` is currently set high for testing (`5.8` seconds).
- Debug persistence behavior after replay reset is acknowledged as not yet corrected.

