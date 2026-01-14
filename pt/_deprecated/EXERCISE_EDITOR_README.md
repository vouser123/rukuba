# PT Exercise Editor

## Overview

***THIS FILE HAS BEEN DEPRECATED. /pt/pt_report.html is currently used as the sole editor. All information here is historical***

A schema-driven exercise editor for creating and managing PT exercises that comply with `exercise_file.schema.json`. This editor provides a mobile-first UI with zero JSON typing required.

## Features

### Schema-Driven UI
- Automatically generates form fields from the JSON schema
- All schema fields are visible and editable
- Enum fields use visual pickers (no typing)
- Arrays use Add/Remove item controls (no CSV parsing)
- Date fields use date pickers only

### Type Safety
- Preserves correct JSON types throughout the editing process
- Arrays remain arrays (never converted to strings)
- Objects remain objects
- Null values are explicitly managed with intent controls

### Intent Controls for Nullable Fields

**Nullable Dates** (e.g., `added_date`, `effective_start_date`):
- "Not Set" → `null`
- "Set Date" → shows date picker, stores string value

**Nullable Arrays/Objects**:
- All required arrays/objects are initialized with proper types
- Empty arrays are `[]`, not `null`

### ULID Exercise IDs

**New Exercises**:
- Automatically generate a 26-character ULID (Crockford Base32)
- Format: `01HN8X7QPQRSTUVWXYZ1234567`
- Generated once at creation, never changes

**Existing Exercises**:
- Keep current `ex####` IDs unchanged
- Schema accepts both formats: `^(ex\\d{4}|[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26})$`

### Draft Management

**State Storage**:
- Baseline exercises loaded from `exercise_guidance_seed.json`
- New exercises and edits stored in `localStorage` as drafts
- Drafts persist across sessions
- Marked with "● DRAFT" indicator in list

**Workflow**:
1. Create/edit exercises (stored as drafts)
2. Export merged JSON (baseline + drafts)
3. Commit exported JSON to repo
4. Becomes new baseline for next session

### Export with Validation

**Pre-Export Validation**:
- Validates entire export against schema rules
- Checks required fields
- Verifies array/object types
- Validates enum values
- Shows clickable error list if validation fails

**Export Format**:
```json
{
  "exercises": [
    // baseline exercises + drafts merged
  ]
}
```

**Type Preservation**:
- Direct serialization of typed state
- No type "repair" on export
- Arrays export as arrays
- Null exports as null
- Empty arrays export as `[]`

## All Schema Fields Covered

### Exercise Properties
- ✅ `exercise_id` (auto-generated ULID, readonly)
- ✅ `canonical_name` (text input)
- ✅ `pt_category` (enum picker)
- ✅ `description` (textarea)
- ✅ `primary_muscles` (array editor)
- ✅ `secondary_muscles` (array editor)
- ✅ `pattern` (enum picker)
- ✅ `pattern_modifiers` (multi-select enum)
- ✅ `form_parameters_required` (multi-select enum)
- ✅ `added_date` (nullable date picker)
- ✅ `updated_date` (nullable date picker)

### Equipment Object
- ✅ `equipment.required` (array editor)
- ✅ `equipment.optional` (array editor)

### Tags Object
- ✅ `tags.functional` (array editor)
- ✅ `tags.format` (array editor)
- ✅ `tags.heatmap` (array editor)

### Guidance Object
- ✅ `guidance.external_cues` (array editor)
- ✅ `guidance.motor_cues` (array editor)
- ✅ `guidance.compensation_warnings` (array editor)
- ✅ `guidance.safety_flags` (array editor)

### Lifecycle Object
- ✅ `lifecycle.status` (enum picker)
- ✅ `lifecycle.effective_start_date` (nullable date picker)
- ✅ `lifecycle.effective_end_date` (nullable date picker)

## Usage

### Access the Editor

From PT Tracker app:
1. Open exercise list
2. Tap "Data / Backup"
3. Scroll to "Advanced: Schema-driven exercise editor"
4. Tap "🛠️ Open Exercise Editor"

Direct access:
- Navigate to `/pt/exercise_editor.html`

### Create New Exercise

1. Tap "+ Create New Exercise"
2. ULID automatically generated
3. Fill in required fields (marked with *)
4. Add array items using "+ Add Item" buttons
5. Use enum pickers for dropdown fields
6. Set nullable dates with intent toggles
7. Changes auto-save to localStorage

### Edit Existing Exercise

1. Tap exercise in list
2. Modify fields
3. Changes auto-save as draft
4. Original remains unchanged until export

### Export Data

1. Tap "📤 Export All Data"
2. Review validation results
3. Fix any errors (tap error to see details)
4. When validation passes, tap "📥 Download JSON"
5. File downloads as `pt_exercises_YYYY-MM-DD.json`

### Commit to Repo

```bash
# Replace seed file with export
mv ~/Downloads/pt_exercises_*.json pt/exercise_guidance_seed.json

# Commit
git add pt/exercise_guidance_seed.json
git commit -m "Update exercise definitions"
git push
```

## Mobile-First Design

- Large tap targets (minimum 44px)
- Scrollable sections
- Sticky header
- Bottom action bar for primary actions
- Visual pickers instead of dropdowns
- No typing for enums/arrays/dates
- Auto-save (no save button needed)

## Schema Compliance

The editor enforces the complete schema:
- All required fields must be filled
- Enums restricted to schema values
- Array minimums enforced (e.g., `primary_muscles` minItems: 1)
- Type safety (arrays as arrays, not strings)
- $ref resolution (equipment, tags, guidance, lifecycle)

## Smoke Test

**Scenario**: Create 2 new exercises, edit 1 existing, export

1. Create "Hip Flexor Stretch"
   - ULID generated: `01HN8X7QPQRSTUVWXYZ1234567`
   - Fill required fields
   - Add primary_muscles: `["Iliopsoas", "Rectus Femoris"]`
   - Set pattern: `side`
   - Save (auto-saved to localStorage)

2. Create "Plank Variation"
   - ULID generated: `01HN8X8RQABCDEFGHJ2345678`
   - Fill required fields
   - Add pattern_modifiers: `["hold_seconds"]`
   - Add guidance cues
   - Save (auto-saved)

3. Edit existing "ex0001 - Lunge With Rotation"
   - Add to secondary_muscles: `["Quadratus Lumborum"]`
   - Update guidance
   - Save (stored as draft, original untouched)

4. Export All Data
   - Validation runs
   - ✅ All fields present
   - ✅ All types correct (arrays are arrays)
   - ✅ No null where required
   - Download JSON

5. Verify Export
   ```bash
   # Check structure
   cat pt_exercises_*.json | jq '.exercises | length'
   # Returns: 3 (2 baseline + 2 new + 1 edited = merged count)

   # Check types
   cat pt_exercises_*.json | jq '.exercises[0].primary_muscles | type'
   # Returns: "array"

   # Validate against schema
   ajv validate -s pt/schema/exercise_file.schema.json -d pt_exercises_*.json
   # Returns: valid
   ```

## Limitations (By Design)

- No automatic defaults beyond schema
- No program data import/migration (exercise-level only)
- No in-app schema editing
- No undo/redo (use git for version control)
- Validation only at export (not blocking during edit)

## Browser Compatibility

- Safari iOS 14+
- Chrome Mobile
- Firefox Mobile
- Any modern browser with localStorage and crypto.getRandomValues

## Troubleshooting

**Q: Drafts disappeared after reinstall**
A: Drafts are in localStorage. Export before clearing browser data.

**Q: Validation fails with "must be array"**
A: Check that you used "+ Add Item" buttons, not comma-separated input.

**Q: ULID not accepted**
A: Schema updated to accept both `ex####` and ULID formats. Pull latest schema.

**Q: Can't edit exercise_id**
A: By design. IDs are stable identifiers, generated once, never changed.

## Development

Schema location: `pt/schema/exercise_file.schema.json`
Seed data: `pt/exercise_guidance_seed.json`
Editor: `pt/exercise_editor.html`
Draft storage key: `pt_exercise_drafts`

To clear drafts:
```javascript
localStorage.removeItem('pt_exercise_drafts');
location.reload();
```
