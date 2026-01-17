# Schema-Driven PT Exercise Editor Refactor

## Overview
Refactor pt_report.html to be fully schema-driven with zero hardcoded property names. Add dosage support that integrates with pattern_modifiers. Enable PT to add/edit/delete exercises and roles, then export modifications to patient via email.

## Critical Files
- **pt_report.html** - Main file to refactor (all form generation and data collection logic)
- **schema/exercise_file.schema.json** - Source of truth for properties, types, enums
- **exercise_library.json** - Source for autocomplete options (union of existing values)

## Requirements Summary

### 1. Zero Hardcoding
- All property names come from schema $defs.exercise
- No hardcoded field types (primary_muscles, equipment.required, etc.)
- No hardcoded enum values
- Dynamic form generation from schema metadata

### 2. Dynamic Autocomplete
- Build datalists from union of all values in exercise_library.json
- Handle non-enum arrays: muscles, equipment, tags, guidance
- Allow PT to add new values not in existing data
- Normalize casing inconsistencies (e.g., "step" vs "Step")

### 3. Dosage System (NEW)
- Dosage fields appear in editor based on pattern_modifiers
- Stored in localStorage key: `pt_tracker_data` (patient-specific, not in exercise_library.json)
- Exported to PT via modifications email
- Conditional fields:
  * Default (no modifiers): sets + reps
  * duration_seconds: sets + duration
  * hold_seconds: sets + reps + hold
  * distance_feet: sets + distance
  * alternating: sets + reps (with R/L indicator)
  * AMRAP: sets + duration

### 4. Role Assignment (PRESERVE)
- Keep existing newRoles, deletedRoles, editedRoles tracking
- No changes to role assignment UI/logic

### 5. Export/Import (ENHANCE)
- Add dosagePrescriptions to modifications object
- Maintain email format with markers and SHA-256 hash
- Backward compatible with old exports

## Implementation Plan

### Phase 1: Schema Infrastructure ✓ Foundation
**Build metadata layer without touching existing code**

1. Add `buildSchemaMetadata(schema)` function
   - Parse schema.$defs.exercise.properties
   - Extract: property name, type (string/array/object), required, enum values
   - Handle nested objects (equipment, tags, guidance, lifecycle)
   - Return fieldConfigs object mapping path → config

2. Add `buildAutocompleteOptions(exerciseLibrary, schemaMetadata)` function
   - Extract unique values from exercise_library.json
   - For each non-enum array field: collect all values, de-duplicate, sort
   - Normalize casing: prefer snake_case for equipment, handle "step"/"Step" etc.
   - Return options object mapping path → array of values

3. Update `initializeEditorMode()` to load schema and build metadata
   - Load schema from schema/exercise_file.schema.json
   - Call buildSchemaMetadata(schema)
   - Call buildAutocompleteOptions(exerciseLibrary, schemaMetadata)
   - Store in global variables

4. **Test**: Console.log schemaMetadata and autocompleteOptions, verify all 15+ properties detected

### Phase 2: Dynamic Form Generator ✓ Core Logic
**Build new form generator alongside existing hardcoded forms**

1. Create `generateExerciseForm(schemaMetadata)` function
   - Group fields by UI section (basic, muscles, pattern, equipment, etc.)
   - For each section: create collapsible details or div
   - For each field: call createField(fieldConfig)

2. Create `createField(fieldConfig)` function
   - If isArray: call createArrayField()
   - Else: call createPrimitiveField()

3. Create `createArrayField(fieldConfig)` function
   - Create container div with ID: `${fieldPath}-list`
   - Add label with field name (formatted from path)
   - Add "Add" button that calls addArrayItem(fieldConfig)
   - Add data-field-path attribute to container

4. Create `addArrayItem(fieldConfig)` function
   - Get container, count existing items for index
   - Create input/select/textarea based on type
   - If enum: populate select with schema enum values
   - If non-enum array: add datalist with autocomplete options
   - Add ID: `${fieldPath}-${index}`
   - Add data-field-path and data-array-index attributes
   - Add delete button that removes parent div

5. Create `createPrimitiveField(fieldConfig)` function
   - Create label and input/select/textarea
   - If enum: add datalist with schema enum values
   - Add ID: `${fieldPath}`
   - Add data-field-path attribute

6. **Test**: Call generateExerciseForm() and render into NEW container, verify HTML structure matches existing form

### Phase 3: Form Data Collection ✓ Critical Path
**Implement schema-driven data collection**

1. Create `collectExerciseFormData(schemaMetadata)` function
   - Loop through schemaMetadata.fieldConfigs
   - For each field: call collectArrayFieldData() or collectPrimitiveFieldData()
   - Return flat object: { "primary_muscles": [...], "equipment.required": [...] }

2. Create `collectArrayFieldData(fieldPath)` function
   - Use querySelectorAll(`[data-field-path="${fieldPath}"]`)
   - Collect .value from each, filter empty strings
   - Return array

3. Create `collectPrimitiveFieldData(fieldPath)` function
   - Use querySelector(`[data-field-path="${fieldPath}"]`)
   - Return .value.trim()

4. Create `restructureNestedData(flatData, schemaMetadata)` function
   - Convert flat object to nested structure
   - Example: { "equipment.required": [...] } → { equipment: { required: [...] } }
   - Handle all nested objects: equipment, tags, guidance, lifecycle

5. **Test**: Populate generated form, call collectExerciseFormData(), verify output matches schema structure

### Phase 4: Replace Existing Form ✓ Cutover
**Switch from hardcoded to dynamic form**

1. Comment out all hardcoded add*Field() functions (addMuscleField, addEquipmentField, etc.)

2. Replace hardcoded HTML form with single container div:
   ```html
   <div id="exercise-form-container"></div>
   ```

3. Update `initializeEditorMode()`:
   - After loading metadata, call generateExerciseForm(schemaMetadata)

4. Refactor `saveExercise()`:
   - Replace all querySelectorAll patterns with: `collectExerciseFormData(schemaMetadata)`
   - Replace hardcoded object construction with restructureNestedData()
   - Keep validation, modifications tracking, and summary update

5. Refactor `loadExerciseForEdit()`:
   - Create `populateFormFromExercise(exercise, schemaMetadata)` function
   - Loop through schemaMetadata.fieldConfigs
   - For arrays: call addArrayItem() for each value, then populate
   - For primitives: set input.value directly

6. **Test**: Add new exercise, edit existing exercise, verify data roundtrips correctly

### Phase 5: Dosage System ✓ New Feature
**Add dosage fields and localStorage integration**

1. Create dosage data structure in localStorage (pt_tracker_data):
   ```javascript
   {
     exercises: [...],  // existing
     dosagePrescriptions: {
       "ex0001": {
         dosage: {
           left: { sets: 3, reps: 10 },
           right: { sets: 3, reps: 10 }
         }
       }
     }
   }
   ```

2. Create `getDosageFieldsForModifiers(modifiers)` function
   - Map pattern_modifiers to required dosage fields
   - Return array like ["sets", "reps"] or ["sets", "duration_seconds"]

3. Create `showDosageFields(exercise)` function
   - Check exercise.pattern (side vs both)
   - Check exercise.pattern_modifiers
   - Call getDosageFieldsForModifiers()
   - Render appropriate inputs (L/R separate if pattern="side", single if "both")
   - If alternating modifier: show "alternating R/L" indicator

4. Create `collectDosageData(exerciseId)` function
   - Query all inputs with data-dosage-side and data-dosage-field attributes
   - Build dosage object: { exerciseId: { dosage: { left: {...}, right: {...} } } }
   - Return object

5. Add dosage UI section to exercise editor form
   - Below basic info section
   - Conditional visibility: only show when editing existing exercise
   - Auto-update when pattern or pattern_modifiers change

6. **Test**: All pattern_modifier combinations render correct dosage fields

### Phase 6: Export/Import Integration ✓ Enhancement
**Include dosage in modifications flow**

1. Update modifications object structure:
   ```javascript
   let modifications = {
     newExercises: [],
     editedExercises: {},
     archivedExercises: [],
     newRoles: {},
     deletedRoles: {},
     editedRoles: {},
     updatedVocab: {},
     dosagePrescriptions: {}  // NEW
   };
   ```

2. Update `saveExercise()`:
   - After saving exercise, call collectDosageData(exerciseId)
   - Add to modifications.dosagePrescriptions

3. Update export email generation:
   - Include dosagePrescriptions in JSON export
   - Maintain existing markers and hash

4. Update import flow (pt_tracker.html):
   - Parse dosagePrescriptions from imported modifications
   - Merge into pt_tracker_data.dosagePrescriptions
   - Save to localStorage

5. **Test**: Export modifications → import in tracker → verify dosage appears

### Phase 7: Validation & Edge Cases ✓ Polish
**Handle data quality, errors, edge cases**

1. Add `validateExerciseData(data, schemaMetadata)` function
   - Check required fields present
   - Check enum values valid
   - Check array types correct
   - Return { valid: boolean, errors: string[] }

2. Add casing normalization:
   - Prefer snake_case for equipment ("support_surface" not "Support Surface")
   - Prefer proper case for muscles ("Gluteus Maximus")
   - Show warning when PT enters non-standard casing

3. Handle empty arrays:
   - Required arrays can be empty [] per schema
   - Always initialize as [] not undefined
   - Validation accepts empty [] for optional fields

4. Backward compatibility:
   - Make dosagePrescriptions optional in import
   - Default to {} if missing in old exports
   - Test import of old reports without dosage

5. **Test**: Malformed data, incomplete forms, old exports

## Key Functions Summary

### Schema Layer
- `buildSchemaMetadata(schema)` - Parse schema into field configs
- `buildAutocompleteOptions(library, metadata)` - Extract unique values from existing data

### Form Generation
- `generateExerciseForm(metadata)` - Create entire form from schema
- `createField(config)` - Create single field (delegates to array/primitive)
- `createArrayField(config)` - Create array field with add button
- `addArrayItem(config)` - Add single array item with delete button
- `createPrimitiveField(config)` - Create string/textarea input

### Data Collection
- `collectExerciseFormData(metadata)` - Collect all form data
- `collectArrayFieldData(path)` - Collect array field values
- `collectPrimitiveFieldData(path)` - Collect primitive field value
- `restructureNestedData(flat, metadata)` - Convert flat to nested objects

### Dosage
- `getDosageFieldsForModifiers(modifiers)` - Determine which fields to show
- `showDosageFields(exercise)` - Render dosage inputs based on pattern
- `collectDosageData(exerciseId)` - Collect dosage values from form

### Validation
- `validateExerciseData(data, metadata)` - Schema compliance validation
- `normalizeCasing(value)` - Fix casing inconsistencies

## Data Structures

### Schema Metadata
```javascript
{
  fieldConfigs: {
    "canonical_name": {
      path: "canonical_name",
      type: "string",
      isRequired: true,
      isArray: false,
      isEnum: false,
      inputType: "text"
    },
    "primary_muscles": {
      path: "primary_muscles",
      type: "array",
      isRequired: true,
      isArray: true,
      isEnum: false,
      autocompleteOptions: ["Gluteus Maximus", ...],
      inputType: "text"
    },
    "equipment.required": {
      path: "equipment.required",
      type: "array",
      isRequired: true,
      isArray: true,
      isEnum: false,
      isNested: true,
      autocompleteOptions: ["resistance_band", ...],
      inputType: "text"
    }
  }
}
```

### localStorage Keys
- `pt_tracker_data` - Contains dosagePrescriptions:
  ```javascript
  {
    exercises: [...],
    dosagePrescriptions: {
      "ex0001": { dosage: { left: {...}, right: {...} } }
    }
  }
  ```
- `pt_exercise_library` - Exercise definitions (no dosage)
- `pt_data_version` - Schema version
- `pt_exercise_drafts` - Unsaved drafts
- `pt_last_exercise_id` - Last ID for generating new ones

## Success Criteria
- ✓ Zero hardcoded property names in code
- ✓ All fields generated from schema
- ✓ Autocomplete works for non-enum arrays
- ✓ Can add/edit/archive exercises
- ✓ Dosage fields conditional on pattern_modifiers
- ✓ Export includes dosage in modifications
- ✓ Import applies dosage to pt_tracker_data
- ✓ Backward compatible with old exports
- ✓ Role assignment still works
- ✓ Validation prevents invalid data

## Risks & Mitigations
1. **Risk**: Schema changes break existing data
   - **Mitigation**: Validation with clear error messages, backward compatibility

2. **Risk**: Nested object handling is complex
   - **Mitigation**: Test with all 4 nested objects (equipment, tags, guidance, lifecycle)

3. **Risk**: Dosage model unclear to PT
   - **Mitigation**: Clear labels, conditional visibility, examples in UI

4. **Risk**: Casing inconsistencies cause duplicates
   - **Mitigation**: Normalization on save, autocomplete de-duplication
