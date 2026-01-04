# Agent instructions for this repo

This repo contains two unrelated browser apps:

1. A packing-list PWA in `/packing`
2. A physical therapy (PT) tracking PWA in `/pt`

You are a coding assistant. Follow these rules:

- Firebase is used for authenticated PT session history and runtime backups.
- Maintain offline-first behavior with local storage; do not add external APIs beyond Firebase.
- For the PT app, treat `/pt/exercise_library.json` as the canonical source of exercise definitions.
- Treat JSON schemas in `/pt/schema` as authoritative contracts for data shape.
- Do not invent new field names when existing schema fields or vocab terms are available.
- Ensure all UI actions use `<button>` elements and event listeners for iOS Safari compatibility; do not rely on inline `onclick`.

## Layout

- `/packing`
  - Contains the existing packing-list PWA.
  - `packing/index.html` is the entry point for the packing app UI.

- `/pt`
  - `pt/index.html` (or the main HTML file) should be treated as the entry point for the PT PWA.
  - `pt/exercise_library.json` contains the exercise definitions.
  - PT-related JS/TS files should live under `/pt` (e.g., `/pt/app.js`, `/pt/components/...`).

- `/pt/schema`
  - `exercise_file.schema.json` describes the structure of the exercise file used by the PT app.

- `/pt/docs`
  - `vocabularies.md` describes controlled vocabularies for:
    - `pt_category`
    - `pattern`
    - `pattern_modifiers`
    - `form_parameters`
    - equipment examples
    - `tags.functional`
    - `tags.format`
    - `tags.heatmap`

## Data model guidance (PT app)

- `exercise_library.json`:
  - Defines what each exercise is and how it is normally performed.
  - Contains no patient-specific dosage values (sets/reps/seconds for a specific day).
  - Uses these key fields (see schema for full details):
    - `exercise_id`
    - `canonical_name`
    - `pt_category`
    - `description`
    - `primary_muscles`
    - `secondary_muscles`
    - `pattern`
    - `pattern_modifiers`
    - `equipment`
    - `form_parameters_required`
    - `tags`
    - `guidance`
    - `lifecycle`
    - `added_date`
    - `updated_date`

- Future program/session files:
  - Will define dosage instances (sets, reps, seconds, distance, weight).
  - Will provide values for `form_parameters`.

## Coding constraints

- Use plain JavaScript and browser APIs unless explicitly asked otherwise.
- Keep files small and modular: separate UI from data loading and storage logic.
- When unsure about data shape, inspect:
  - `/pt/exercise_library.json`
  - `/pt/schema/exercise_file.schema.json`
  - `/pt/docs/vocabularies.md`

## Safety and robustness

- Handle missing or unexpected fields gracefully; log warnings instead of crashing.
- The PT app should continue to function offline after the first load.

## Do not

- Do not send data to external servers or APIs.
- Do not assume multiple users or accounts; this is for a single user.
- Do not change the meaning of existing fields without explicit instructions.
