# PT Report Schema-Driven Refactor - Status & Next Steps

**Started:** 2024-12-29 in CLI Claude Code
**Status:** Phase 1 partially complete, ready for desktop Claude Code
**Full Plan:** `C:\Users\cindi\.claude\plans\whimsical-conjuring-otter.md`

---

## What Was Completed (CLI)

### ✅ Bug Fixes
1. **Schema loading fix** (commit: 1fdf849)
   - Changed `fetch('schema/exercise_roles.schema.json')` → `fetch('schema/exercise_file.schema.json')`
   - Fixed error: "Schema path not found for pattern enum"

2. **querySelector fixes** (commit: 4a218da)
   - Made selectors specific: `input[id^="equipment-required-"]` instead of `[id^="equipment-required-"]`
   - Prevents matching container divs

### ✅ Phase 1 Foundation (commit: f7a8e99)
Added to pt_report.html:
```javascript
// Line ~602: Added to modifications object
dosagePrescriptions: {}  // exerciseId: { current: { type, sets, repsPerSet, secondsPerRep, distanceFeet } }

// Line ~606: New global variables
let schemaMetadata = null;
let autocompleteOptions = null;

// Line ~610: Helper function
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) =>
        current && current[prop], obj);
}
```

---

## What Needs Implementation (Desktop Claude Code)

### Phase 1: Complete Schema Infrastructure
**Location:** After line ~610 in pt_report.html

**Add these functions:**

```javascript
// Parse schema into field configs
function buildSchemaMetadata(schema) {
    const metadata = {
        fieldConfigs: {},
        nestedObjects: {},
        uiSections: {
            basic: { title: "📝 Basic Information", collapsible: false },
            muscles: { title: "💪 Muscles", collapsible: true },
            pattern: { title: "🔄 Movement Pattern", collapsible: true },
            equipment: { title: "🏋️ Equipment", collapsible: true },
            formParams: { title: "📊 Form Parameters", collapsible: true },
            guidance: { title: "🎯 Guidance & Cues", collapsible: true },
            tags: { title: "🏷️ Tags", collapsible: true },
            lifecycle: { title: "♻️ Lifecycle", collapsible: true }
        }
    };

    const exerciseDef = schema.$defs.exercise;
    const requiredFields = exerciseDef.required || [];

    // Walk properties
    for (const [propName, propDef] of Object.entries(exerciseDef.properties)) {
        if (propDef.$ref) {
            // Nested object (equipment, tags, guidance, lifecycle)
            const refName = propDef.$ref.split('/').pop();
            const nestedDef = schema.$defs[refName];
            metadata.nestedObjects[propName] = { properties: [] };

            for (const [nestedProp, nestedPropDef] of Object.entries(nestedDef.properties)) {
                const fullPath = `${propName}.${nestedProp}`;
                metadata.fieldConfigs[fullPath] = parsePropertyDef(
                    fullPath, nestedPropDef, nestedDef.required || [], propName
                );
                metadata.nestedObjects[propName].properties.push(fullPath);
            }
        } else {
            metadata.fieldConfigs[propName] = parsePropertyDef(
                propName, propDef, requiredFields, null
            );
        }
    }

    return metadata;
}

function parsePropertyDef(propPath, propDef, requiredFields, parentSection) {
    const propName = propPath.split('.').pop();
    const isRequired = requiredFields.includes(propName);
    const isArray = propDef.type === 'array';

    const config = {
        path: propPath,
        type: isArray ? 'array' : propDef.type,
        isRequired,
        isArray,
        isNested: propPath.includes('.'),
        uiSection: determineUISection(propPath, parentSection)
    };

    if (isArray && propDef.items) {
        config.itemType = propDef.items.type;
        if (propDef.items.enum) {
            config.isEnum = true;
            config.enumValues = propDef.items.enum;
            config.inputType = 'select';
        } else {
            config.isEnum = false;
            config.inputType = propDef.items.type === 'string' ? 'text' : 'textarea';
        }
    } else if (propDef.enum) {
        config.isEnum = true;
        config.enumValues = propDef.enum;
        config.inputType = 'datalist';
    } else {
        config.isEnum = false;
        config.inputType = propDef.type === 'string' ? 'text' : 'textarea';
    }

    return config;
}

function determineUISection(propPath, parentSection) {
    if (parentSection === 'equipment') return 'equipment';
    if (parentSection === 'tags') return 'tags';
    if (parentSection === 'guidance') return 'guidance';
    if (parentSection === 'lifecycle') return 'lifecycle';

    const fieldName = propPath.split('.')[0];
    if (['canonical_name', 'pt_category', 'description', 'exercise_id', 'added_date', 'updated_date'].includes(fieldName)) return 'basic';
    if (fieldName.includes('muscle')) return 'muscles';
    if (fieldName.includes('pattern')) return 'pattern';
    if (fieldName.includes('form_param')) return 'formParams';

    return 'basic';
}

// Extract unique values from library for autocomplete
function buildAutocompleteOptions(libraryData, schemaMetadata) {
    const options = {};
    const exercises = libraryData.exercises || [];

    for (const [fieldPath, config] of Object.entries(schemaMetadata.fieldConfigs)) {
        if (config.isArray && !config.isEnum) {
            const values = new Set();

            exercises.forEach(exercise => {
                const fieldValue = getNestedValue(exercise, fieldPath);
                if (Array.isArray(fieldValue)) {
                    fieldValue.forEach(val => {
                        if (val && val.trim()) {
                            values.add(val.trim());
                        }
                    });
                }
            });

            options[fieldPath] = Array.from(values).sort();
            config.autocompleteOptions = options[fieldPath];
        }
    }

    return options;
}
```

**Update initializeEditorMode()** (~line 959):
```javascript
function initializeEditorMode() {
    console.log('[Editor] Initializing with', exerciseLibrary?.length || 0, 'exercises');

    // BUILD SCHEMA METADATA
    if (schema && !schemaMetadata) {
        schemaMetadata = buildSchemaMetadata(schema);
        console.log('[Editor] Built schema metadata:', schemaMetadata);
    }

    // BUILD AUTOCOMPLETE OPTIONS
    if (exerciseLibrary && schemaMetadata && !autocompleteOptions) {
        const libraryData = { exercises: exerciseLibrary };
        autocompleteOptions = buildAutocompleteOptions(libraryData, schemaMetadata);
        console.log('[Editor] Built autocomplete options:', autocompleteOptions);
    }

    // ... rest of existing code ...
}
```

**Test Phase 1:** Open console when clicking "PT Editor Mode", verify logs show schema metadata and autocomplete options.

---

### Phases 2-7: Full Implementation

See detailed implementation in: `C:\Users\cindi\.claude\plans\whimsical-conjuring-otter.md`

**Quick summary:**
- **Phase 2:** Dynamic form generator (generateExerciseForm, createField, addArrayItem)
- **Phase 3:** Form data collector (collectExerciseFormData, restructureNestedData)
- **Phase 4:** Replace hardcoded form with schema-driven version
- **Phase 5:** Dosage system (conditional fields based on pattern_modifiers)
- **Phase 6:** Export/import integration (include dosage in modifications email)
- **Phase 7:** Validation and edge cases

---

## Critical Information for Desktop Claude Code

### Dosage Architecture (IMPORTANT!)
**Tracker's existing structure:**
```javascript
// In pt_exercise_library localStorage
{
  id: "ex0001",
  name: "Single Leg Bridge",
  current: {              // ← Dosage lives here
    type: "reps" | "hold" | "duration",
    sets: 3,
    repsPerSet: 10,
    secondsPerRep: 0,
    distanceFeet: 0       // if applicable
  }
}
```

**Our approach:**
1. PT sets dosage in editor → stored in `modifications.dosagePrescriptions`
2. Export includes dosagePrescriptions in JSON
3. Patient imports → dosage applied to exercise's `current` property

**DO NOT** create a separate dosage structure - use existing `current` format!

### Pattern Modifier → Dosage Field Mapping
```javascript
const dosageFieldRules = {
    default: ["sets", "repsPerSet"],  // No modifiers → type: "reps"
    duration_seconds: ["sets", "secondsPerRep"],  // type: "duration"
    hold_seconds: ["sets", "repsPerSet", "secondsPerRep"],  // type: "hold"
    distance_feet: ["sets", "distanceFeet"],  // type: "reps" but distance instead
    alternating: ["sets", "repsPerSet"],  // type: "reps", alternating R/L
    AMRAP: ["sets", "secondsPerRep"]  // type: "duration"
};
```

### localStorage Keys Used by Tracker
- `pt_tracker_data` - Main app data (NOT used for exercises)
- `pt_exercise_library` - Exercise definitions + dosage (current, history)
- `pt_data_version` - Schema version
- `pt_exercise_drafts` - Unsaved drafts
- `pt_last_exercise_id` - Last ID for generating new ones

---

## Testing Checklist

After each phase, test:

**Phase 1:**
- [ ] Open browser console
- [ ] Click "PT Editor Mode"
- [ ] Verify console logs show schemaMetadata with all fields
- [ ] Verify autocompleteOptions shows unique values from library

**Phase 2:**
- [ ] Form generates dynamically (no hardcoded fields)
- [ ] Collapsible sections work
- [ ] Add buttons create new fields
- [ ] Delete buttons remove fields

**Phase 3:**
- [ ] Fill out form, check console for collected data
- [ ] Verify nested objects structured correctly

**Phase 4:**
- [ ] Can add new exercise
- [ ] Can edit existing exercise
- [ ] Can archive exercise
- [ ] Data roundtrips correctly

**Phase 5:**
- [ ] Dosage fields appear based on pattern_modifiers
- [ ] Conditional visibility works (duration vs reps vs hold)
- [ ] L/R separate for pattern="side", single for pattern="both"

**Phase 6:**
- [ ] Export includes dosagePrescriptions
- [ ] Import in tracker applies dosage to exercise.current
- [ ] Backward compatible with old exports

**Phase 7:**
- [ ] Validation catches missing required fields
- [ ] Enum validation works
- [ ] Error messages clear

---

## Files to Modify

1. **pt_report.html** - Main refactor target
2. **pt_tracker.html** - Import flow (Phase 6)
   - Update `processPastedImport()` to handle dosagePrescriptions
   - Apply to exercise.current when merging modifications

---

## Commits Already Made

1. `1fdf849` - Fix schema loading (exercise_roles → exercise_file)
2. `4a218da` - Fix querySelector selectors
3. `f7a8e99` - Add schema infrastructure foundation

---

## Next Commit Should Be

"Complete Phase 1: Schema infrastructure with metadata builder"

Then continue with phases 2-7, committing after each phase.

---

## Known Risks

1. **Nested object handling** - equipment, tags, guidance, lifecycle all need special care
2. **Dosage type determination** - Must correctly map modifiers → type field
3. **Backward compatibility** - Old imports without dosagePrescriptions must still work
4. **Casing inconsistencies** - Equipment has "step" vs "Step", need normalization

---

## Questions/Blockers

None currently. Implementation path is clear from plan file.

---

**Good luck! Test frequently and commit after each phase. 🚀**
