# Agent instructions for this repo
This repo contains two unrelated browser apps:

1. A packing-list PWA in `/packing`
2. A physical therapy (PT) tracking PWA in `/pt`

You are a coding assistant. Follow these rules:

- Do NOT introduce a backend or database.
- Store all PT user data in browser storage only (IndexedDB or localStorage).
- For the PT app, treat `/pt/exercise_guidance_seed.json` as the canonical source of exercise definitions.
- Treat JSON schemas in `/pt/schema` as authoritative contracts for data shape.
- Do not invent new field names when existing schema fields or vocab terms are available.

## Repo Layout (Intended)

- `/packing`
  - Contains the existing packing-list PWA.
  - `packing/index.html` is the entry point for the packing app UI.

- `/pt`
  - `pt/index.html` (or the main HTML file) should be treated as the entry point for the PT PWA.
  - `pt/exercise_guidance_seed.json` contains the exercise definitions.
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

- `/pt/pwa/` (may be generated or refactored)
  - `index.html` – shell of the PWA.
  - `app.js` – main JavaScript for the PWA.
  - `manifest.webmanifest` – PWA manifest.
  - `service-worker.js` – offline caching logic.
  - `components/` – modular UI components.
  - `storage/` – helpers for browser storage access.

## Data model guidance

- Exercise file:
  - Defines *what* each exercise is and how it is normally performed.
  - Contains **no patient-specific dosage values** (like today’s sets/reps).
  - `pattern` and `pattern_modifiers` describe the structure of dosage, not the actual numbers.

- Program/session layer (future files):
  - Will define **dosage instances**:
    - sets, reps, seconds, distance, weight, etc.
  - Will provide values for `form_parameters` (e.g., which surface, band resistance).

## Coding style and constraints

- Use plain JavaScript and browser APIs for the PWA (no heavy frameworks unless explicitly requested).
- Keep files small and modular:
  - Separate UI components from data loading and storage logic.
- Always favor clarity and maintainability over cleverness.
- When in doubt about data shape, inspect:
  - `exercise_guidance_seed.json`
  - `schema/exercise_file.schema.json`
  - `docs/vocabularies.md`

## Safety and robustness

- Validate data loaded from JSON against the schema where practical.
- Handle missing or extra fields gracefully:
  - log a warning in the console,
  - fall back to safe defaults (e.g., skip unknown tags rather than crashing).
- The app should continue to work offline after initial load.

## What NOT to do

- Do not send data to external servers or APIs.
- Do not assume multiple users or accounts; this app is for a single user.
- Do not remove fields from the exercise JSON schema without explicit instructions.
- Do not modify the semantics of existing fields (e.g., changing what `pattern` or `pt_category` means).
