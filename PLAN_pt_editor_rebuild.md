# PT Editor Rebuild Plan

## Problem Statement
Current pt_editor.html is incomplete and doesn't match the pt_report.html structure:
- ❌ Boot error fixed but still missing functionality
- ❌ Uses tag inputs instead of proper vocab dropdowns
- ❌ Missing dosage section entirely
- ❌ Roles mixed with exercise definition
- ❌ No separation of concerns

## Analysis of pt_report.html Structure

### Four Main Sections:

1. **Add or Edit Exercise** (lines 484-664)
   - Exercise selector with search
   - Basic Info, Muscles, Movement Pattern, Equipment, Form Parameters, Guidance, Lifecycle

2. **Assign Roles to Exercises** (lines 692-747)
   - Exercise selector
   - Region/Capacity/Focus/Contribution dropdowns
   - Role list display

3. **Manage Patient Dosages** (lines 750-778)
   - Exercise selector
   - Sets/Reps/Seconds/Distance fields (conditional based on modifiers)

4. **Update Vocabulary Definitions** (lines 782-800)
   - Category/Term/Definition editor

## Vocab Tables (Dropdowns)

From `/pt-rebuild/db/vocab_schema.sql`:

1. **vocab_pt_category** - Exercise categories
   - back_sij, hip, knee, ankle, foot, shoulder, vestibular, other

2. **vocab_pattern** - Movement patterns
   - side (unilateral), both (bilateral)

3. **vocab_region** - Anatomical regions (for roles)
   - core, back, hip, knee, ankle, foot, shoulder, vestibular

4. **vocab_capacity** - Functional capacities (for roles)
   - strength, control, stability, tolerance, mobility

5. **vocab_focus** - Specific focuses (for roles)
   - sagittal, lateral, anti_rotation, dynamic, static, eccentric, great_toe, intrinsics

6. **vocab_contribution** - Contribution levels (for roles)
   - high, medium, low

## Free-Text Fields (with "+ Add" buttons)

- **Muscles**: primary_muscles[], secondary_muscles[]
- **Equipment**: required[], optional[]
- **Form Parameters**: form_parameters_required[]
- **Guidance**:
  - external_cues[]
  - motor_cues[]
  - compensation_warnings[]
  - safety_flags[]

## Pattern Modifiers (Checkboxes)

Hardcoded in schema:
- duration_seconds
- hold_seconds
- distance_feet

## Implementation Plan

### Section 1: Exercise Definition

**Fields to include:**
- ✅ Exercise selector (dropdown, searchable)
- ✅ Canonical Name (text input, required)
- ✅ PT Category (dropdown from vocab_pt_category, required)
- ✅ Description (textarea, required)
- ✅ Pattern (dropdown from vocab_pattern: side/both, required)
- ✅ Pattern Modifiers (checkboxes: duration, hold, distance)
- ✅ Primary Muscles (text inputs with "+ Add" button)
- ✅ Secondary Muscles (text inputs with "+ Add" button)
- ✅ Required Equipment (text inputs with "+ Add" button)
- ✅ Optional Equipment (text inputs with "+ Add" button)
- ✅ Form Parameters (text inputs with "+ Add" button)
- ✅ External Cues (text inputs with "+ Add" button)
- ✅ Motor Cues (text inputs with "+ Add" button)
- ✅ Compensation Warnings (text inputs with "+ Add" button)
- ✅ Safety Flags (text inputs with "+ Add" button)
- ✅ Lifecycle Status (dropdown: active/archived/deprecated)
- ✅ Effective Start Date (date input)
- ✅ Effective End Date (date input)
- ✅ Archived checkbox

**Save button:** Creates/updates exercise via POST/PUT /api/exercises

### Section 2: Roles/Rehab Coverage

**Fields to include:**
- ✅ Exercise selector (dropdown, searchable)
- ✅ Region (dropdown from vocab_region, required)
- ✅ Capacity (dropdown from vocab_capacity, required)
- ✅ Focus (dropdown from vocab_focus, optional)
- ✅ Contribution (dropdown from vocab_contribution: high/medium/low, required)
- ✅ Display existing roles for selected exercise
- ✅ Remove role button

**Add Role button:** Creates role via POST /api/roles
**Remove button:** Deletes role via DELETE /api/roles/:id

### Section 3: Dosage/Patient Programs

**Fields to include:**
- ✅ Exercise selector (dropdown, searchable)
- ✅ Sets (number input, required)
- ✅ Reps (number input, required)
- ✅ Seconds (number input, conditional - show if exercise has hold_seconds or duration_seconds modifier)
- ✅ Distance (number input, conditional - show if exercise has distance_feet modifier)
- ✅ Side (dropdown: left/right/both, conditional - show if pattern='side')
- ✅ Display current dosage for selected exercise

**Update Dosage button:** Updates via PUT /api/programs/:id

## API Endpoints Needed

Already exist:
- ✅ GET /api/vocab - Load all vocabularies
- ✅ GET /api/exercises - Load all exercises
- ✅ POST /api/exercises - Create exercise
- ✅ PUT /api/exercises/:id - Update exercise
- ✅ DELETE /api/exercises/:id - Archive exercise
- ✅ GET /api/roles?exercise_id=X - Get roles for exercise
- ✅ POST /api/roles - Create role
- ✅ DELETE /api/roles/:id - Delete role
- ✅ GET /api/programs?patient_id=X - Get patient dosages
- ✅ POST /api/programs - Create dosage
- ✅ PUT /api/programs/:id - Update dosage

## UI Pattern from pt_report

```html
<details style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 15px 0;">
    <summary>Section Title</summary>
    <div class="form-group">
        <label class="form-label">Label *</label>
        <input|select|textarea class="form-input|form-select">
    </div>
</details>
```

## Success Criteria

1. ✅ Can log in without errors
2. ✅ Dropdown for PT Category populated from vocab
3. ✅ Dropdown for Pattern populated from vocab
4. ✅ Can add/edit/save exercises with all fields
5. ✅ Can assign roles with region/capacity/focus dropdowns
6. ✅ Can set dosages with sets/reps/seconds/distance
7. ✅ Conditional fields show/hide based on exercise modifiers
8. ✅ No JavaScript errors on load or use
9. ✅ Matches pt_report UI style and structure

## Implementation Steps

1. Create vocab loading function that populates all dropdowns
2. Rebuild Exercise section with proper structure
3. Rebuild Roles section as separate area
4. Add Dosage section (new)
5. Wire up all save/update/delete actions
6. Test thoroughly
7. Commit and deploy
