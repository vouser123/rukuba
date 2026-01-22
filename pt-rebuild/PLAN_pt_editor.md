# Plan: Rebuild pt_editor.html

## Goal
Create a clean, functional exercise library editor matching the old Firebase app's UX (pt_report.html), using only Supabase API endpoints. No Firebase, no JSON fallbacks, no messy code.

## Current State
**Broken pt_editor.html has**:
- Only 5 fields: name, description, category, pattern, archived
- Empty vocabulary dropdowns
- Non-functional save/load
- Missing 75% of fields

## Database Schema Reference

### exercises table
```
id, canonical_name, description, pt_category, pattern, archived,
lifecycle_status, lifecycle_effective_start_date, lifecycle_effective_end_date,
supersedes_exercise_id, superseded_by_exercise_id, superseded_date,
added_date, updated_date, created_at, updated_at
```

### Related tables (normalized from exercises)
- **exercise_equipment** (exercise_id, equipment_name, is_required)
- **exercise_muscles** (exercise_id, muscle_name, is_primary)
- **exercise_pattern_modifiers** (exercise_id, modifier) - CHECK: duration_seconds, hold_seconds, distance_feet
- **exercise_form_parameters** (exercise_id, parameter_name)
- **exercise_guidance** (exercise_id, section, content, sort_order) - CHECK sections: motor_cues, compensation_warnings, safety_flags, external_cues
- **exercise_roles** (exercise_id, region, capacity, focus, contribution)

### Vocabulary tables
- **vocab_pt_category** (code, definition, sort_order, active)
- **vocab_pattern** (code, definition, dosage_semantics, sort_order, active)
- **vocab_region** (code, definition, sort_order, active)
- **vocab_capacity** (code, definition, sort_order, active)
- **vocab_focus** (code, definition, sort_order, active)
- **vocab_contribution** (code, definition, sort_order, active)

### MISSING from schema (check architecture docs)
- Tags (functional/format) - need to verify if table exists or if excluded

## API Endpoints

### Existing
- **GET /api/exercises** - Returns all exercises with full nested data
- **POST /api/exercises** - Create exercise (requires exercise object in body)
- **PUT /api/exercises** - Update exercise (requires exercise object in body with id)
- **GET /api/vocab** - Returns all vocabularies keyed by type

### Payload Format (from /api/exercises/index.js)
```javascript
{
  exercise: {
    id,
    canonical_name,
    description,
    pt_category,
    pattern,
    archived,
    lifecycle_status,
    lifecycle_effective_start_date,
    lifecycle_effective_end_date,
    supersedes_exercise_id,
    superseded_by_exercise_id,
    superseded_date,
    added_date,
    updated_date,

    equipment: {
      required: [],
      optional: []
    },
    primary_muscles: [],
    secondary_muscles: [],
    pattern_modifiers: [],
    form_parameters_required: [],
    guidance: {
      motor_cues: [],
      compensation_warnings: [],
      safety_flags: [],
      external_cues: []
    },
    roles: [{region, capacity, focus, contribution}]
  }
}
```

### Need to Add/Verify
- Endpoint to get all unique equipment names from exercise_equipment table
- Endpoint to get all unique form parameter names from exercise_form_parameters table
- Tags support (verify if exists in schema/API)

## UI Structure (Based on pt_report.html)

### Header
- Title: "PT Editor - Exercise Library Manager"
- Sign Out button
- New Exercise button

### Exercise Selector Section
- Search input (filters dropdown as you type)
- Dropdown select with all exercises
- Selecting exercise loads it into form
- "Add New" option clears form

### Form Sections (in order)

#### 1. Basic Information (Always Visible)
Fields:
- Canonical Name* (text input, required)
- Description* (textarea, required)
- PT Category* (select from vocab_pt_category codes, required)
- Pattern* (select from vocab_pattern codes, required)
- Pattern Modifiers (inline checkboxes next to pattern):
  - ☐ duration_seconds
  - ☐ hold_seconds
  - ☐ distance_feet

#### 2. Tags (Collapsible `<details>`)
**VERIFY IF THIS EXISTS IN SCHEMA FIRST**
- Functional Tags (tag input with add/remove buttons)
- Format Tags (tag input with add/remove buttons)
- Note: Heatmap tags excluded per architecture

#### 3. Equipment (Collapsible `<details>`)
- Required Equipment:
  - Multi-select from existing equipment names across all exercises
  - "Other" option to add new equipment name
  - Tag-style display with X to remove
- Optional Equipment:
  - Same as required

#### 4. Muscles (Collapsible `<details>`)
- Primary Muscles (tag input with add/remove)
- Secondary Muscles (tag input with add/remove)

#### 5. Form Parameters (Collapsible `<details>`)
- Multi-select from existing parameter names across all exercises
- "Other" option to add new parameter name
- Examples shown: band_resistance, surface, eyes, distance, weight
- Tag-style display with X to remove

#### 6. Guidance (Collapsible `<details>`)
Each section has:
- List of current items (with delete button per item)
- Text input to add new item
- "Add" button

Sections:
- Motor Cues
- Compensation Warnings
- Safety Flags
- External Cues

#### 7. Lifecycle & Status (Collapsible `<details>`, at bottom)
Fields:
- Archived (checkbox)
- Lifecycle Status (select: active, archived, deprecated)
- Effective Start Date (date input, optional)
- Effective End Date (date input, optional)
- Supersedes Exercise (searchable select from exercises, optional)
- Superseded By (searchable select from exercises, optional)
- Superseded Date (date input, optional)
- Added Date (date input, optional)
- Updated Date (date input, optional)

#### 8. Vocabulary Reference Panel (Read-Only)
Collapsible sections showing all vocabulary terms and definitions:
- Regions
- Capacities
- Focus Areas
- Contributions
- PT Categories
- Patterns

### Action Buttons (bottom of form)
- Cancel (clears form, resets to select mode)
- Save Exercise (validates required fields, calls POST or PUT)

## UX Pattern (from pt_report.html)

### Form Group Structure
```html
<div class="form-group">
  <label class="form-label" for="field-id">Label *</label>
  <input type="text" id="field-id" class="form-input" placeholder="...">
</div>
```

### Collapsible Sections
```html
<details style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 15px 0;">
  <summary style="cursor: pointer; font-weight: 600; font-size: 15px; color: var(--ios-blue); margin-bottom: 12px;">
    🔄 Section Title
  </summary>
  <!-- Form groups here -->
</details>
```

### Tag Input Pattern
- Container div with existing tags displayed
- Each tag has value + X button to remove
- Input field to add new
- "Add" button or "Other" option in select

### Toast Notifications
```javascript
function toast(message, type = 'success') {
  // Show floating notification
  // Auto-dismiss after 3s
  // Types: success, error
}
```

## Styling

### Dark Mode Support
```css
:root {
  --bg-primary: #fff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #f0f0f0;
  --text-primary: #000;
  --text-secondary: #666;
  --border-color: #ddd;
  --ios-blue: #007bff;
  --ios-green: #28a745;
  --ios-red: #dc3545;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #000;
    --bg-secondary: #1c1c1e;
    --bg-tertiary: #2c2c2e;
    --text-primary: #fff;
    --text-secondary: #999;
    --border-color: #444;
    --ios-blue: #0a84ff;
    --ios-green: #30d158;
    --ios-red: #ff453a;
  }
}
```

### Form Styling (from pt_report.html)
- Labels: font-weight 600, margin-bottom 8px
- Inputs: 14px padding, border-radius 8px, 100% width
- Buttons: padding 12px 24px, border-radius 8px
- Sections: padding 15px, border-radius 8px, margin 15px 0

## Implementation Steps

### Phase 1: Investigation
1. Verify if exercise_tags table exists in schema
2. Check if tags are in /api/exercises response
3. Get list of all unique equipment names (may need new API endpoint)
4. Get list of all unique form parameter names (may need new API endpoint)

### Phase 2: HTML Structure
1. Auth modal (blocking until signed in)
2. Header with title and actions
3. Exercise selector section
4. Form with all sections in correct order
5. Vocabulary reference panel
6. Action buttons

### Phase 3: JavaScript Implementation
1. Supabase client initialization
2. Auth flow
3. Load vocabularies from /api/vocab
4. Load exercises from /api/exercises
5. Load unique equipment/parameter lists
6. Populate form when exercise selected
7. Generate exercise ID from canonical name
8. Collect form data into API payload format
9. POST/PUT to /api/exercises
10. Toast notifications
11. Error handling

### Phase 4: Testing
1. Load existing exercise - verify all fields populate
2. Edit and save - verify update works
3. Create new exercise - verify creation works
4. Validate required fields
5. Test dark mode
6. Test on mobile viewport

## Key Functions

```javascript
// Initialize app
async function init()

// Auth
async function signIn(email, password)
async function signOut()

// Data loading
async function loadVocabularies()
async function loadExercises()
async function loadUniqueEquipment()
async function loadUniqueFormParameters()

// Exercise management
function selectExercise(exerciseId)
function loadExerciseIntoForm(exercise)
function clearForm()
function collectFormData()
async function saveExercise()
function generateExerciseId(name)

// UI helpers
function populateVocabSelects()
function renderVocabularyReference()
function addTag(container, value)
function removeTag(container, index)
function addGuidanceItem(section, value)
function removeGuidanceItem(section, index)
function toast(message, type)
function escapeHtml(text)

// Event handlers
function bindEventHandlers()
```

## Questions to Answer Before Implementation

1. **Tags**: Do they exist in the schema? Check architecture docs.
2. **Equipment List**: Do we need a new API endpoint to get unique equipment names, or should we extract from exercises response?
3. **Form Parameters List**: Same question as equipment.
4. **Roles**: You said roles are separate - should they be completely excluded from this editor, or shown read-only?

## Success Criteria

✓ All exercise fields editable
✓ Equipment multi-select with "Other" option
✓ Form parameters multi-select with "Other" option
✓ Pattern modifiers checkboxes work
✓ Guidance sections allow add/remove
✓ Lifecycle fields all present and functional
✓ Dark mode works
✓ Vocabulary dropdowns populated correctly
✓ Save creates/updates exercise correctly
✓ No Firebase, no JSON files, no messy code
