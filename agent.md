# Agent instructions for this repo

This repo contains a small personal physical therapy (PT) tracking PWA. It is used by a single user (the patient) to track home exercise programs prescribed by their physical therapist.

You are a coding assistant. Follow these rules:

- Do NOT introduce a backend or database.
- Store all user data in browser storage only (IndexedDB or localStorage).
- Treat `exercise_guidance_seed.json` as the canonical source of exercise definitions.
- Treat JSON schemas in `/schema` as authoritative contracts for data shape.
- Do not invent new field names when existing schema fields or vocab terms are available.

## Repo layout (intended)

- `exercise_guidance_seed.json`
  - Contains the master list of exercise definitions.
  - Structure should validate against `schema/exercise_file.schema.json`.

- `schema/exercise_file.schema.json`
  - JSON Schema describing the exercise file structure.
  - Fields include:
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

- `docs/vocabularies.md`
  - Describes controlled vocabularies for:
    - `pt_category`
    - `pattern`
    - `pattern_modifiers`
    - `form_parameters`
    - `equipment` examples
    - `tags.functional`
    - `tags.format`
    - `tags.heatmap`
  - When adding or editing exercises, pick values from these vocab lists whenever possible instead of inventing new spellings.

- `pwa/` (may be generated or refactored)
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
