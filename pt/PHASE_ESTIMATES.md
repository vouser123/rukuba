# Phase 1 & 2 Token and Time Estimates

**Project:** PT Report Schema-Driven Refactor
**Date:** 2026-01-11
**Status:** Phase 1 partially complete (foundation only)

---

## Phase 1: Schema Infrastructure

### Current Status
✅ **Completed (CLI):**
- Added `dosagePrescriptions: {}` to modifications object (line ~602)
- Added global variables: `schemaMetadata`, `autocompleteOptions` (line ~606)
- Added helper function: `getNestedValue()` (line ~610)

❌ **Remaining Work:**
1. Implement `buildSchemaMetadata(schema)` function (~200 lines)
2. Implement `parsePropertyDef()` helper (~80 lines)
3. Implement `determineUISection()` helper (~40 lines)
4. Implement `buildAutocompleteOptions()` function (~120 lines)
5. Update `initializeEditorMode()` to build metadata (~30 lines)
6. Testing and console verification

### Scope Details

**Function 1: `buildSchemaMetadata(schema)`**
- Parse `schema.$defs.exercise.properties`
- Walk through all properties (15+ fields)
- Handle nested objects: equipment, tags, guidance, lifecycle
- Determine field types: string, array, object
- Extract enum values where present
- Determine UI section for each field
- Build comprehensive metadata object

**Function 2: `parsePropertyDef(propPath, propDef, requiredFields, parentSection)`**
- Extract property metadata (type, required, enum values)
- Determine if property is array
- Determine input type (text, textarea, select, datalist)
- Handle nested property paths (e.g., "equipment.required")

**Function 3: `determineUISection(propPath, parentSection)`**
- Map fields to UI sections: basic, muscles, pattern, equipment, formParams, guidance, tags, lifecycle
- Handle nested fields appropriately

**Function 4: `buildAutocompleteOptions(libraryData, schemaMetadata)`**
- Loop through all non-enum array fields
- Extract unique values from exercise_library.json
- De-duplicate and sort
- Normalize casing inconsistencies
- Store in autocomplete options object

### Estimates

**Lines of Code:** ~470 lines
**Complexity:** Medium (data processing, schema traversal, object manipulation)

**Token Estimate:** 28,000 - 38,000 tokens
- Reading existing code context: ~8,000 tokens
- Reading schema files: ~3,000 tokens
- Implementation: ~15,000 tokens
- Testing and verification: ~5,000 tokens
- Documentation updates: ~2,000 tokens
- Buffer for iterations: ~5,000 tokens

**Development Time:** 35-50 minutes
- Implementation: 25-35 minutes
- Testing in browser console: 5-10 minutes
- Debugging and refinement: 5-10 minutes

### Success Criteria
- [ ] Console log shows `schemaMetadata` with all 15+ exercise properties
- [ ] Console log shows field configs with correct types (string/array)
- [ ] Console log shows `autocompleteOptions` with unique values from library
- [ ] All nested objects properly detected (equipment, tags, guidance, lifecycle)
- [ ] No errors in browser console

---

## Phase 2: Dynamic Form Generator

### Scope Details

**Function 1: `generateExerciseForm(schemaMetadata)`**
- Create form container structure
- Group fields by UI section (8 sections)
- Create collapsible details elements for sections
- Iterate through all field configs
- Call `createField()` for each property
- Return complete form HTML

**Function 2: `createField(fieldConfig)`**
- Router function
- Delegates to `createArrayField()` or `createPrimitiveField()`
- Handles both top-level and nested fields

**Function 3: `createArrayField(fieldConfig)`**
- Create container div with unique ID
- Add formatted label (convert snake_case to Title Case)
- Add "Add [FieldName]" button
- Wire up button to call `addArrayItem()`
- Add data attributes for field path
- Handle required field indicators

**Function 4: `addArrayItem(fieldConfig)`**
- Determine input type (select for enums, input with datalist for non-enums)
- Create input element with unique ID
- Populate enum select with schema values
- Attach datalist with autocomplete options
- Add delete button with click handler
- Add data attributes (field-path, array-index)
- Append to parent container

**Function 5: `createPrimitiveField(fieldConfig)`**
- Create label and input/textarea/select
- Add datalist if enum values present
- Set input ID and data attributes
- Handle required field indicators
- Apply proper styling classes

**Additional Work:**
- Section styling and collapsible UI
- Event handler bindings
- Form layout and responsive design
- Integration with existing pt_report.html structure

### Estimates

**Lines of Code:** ~650 lines
**Complexity:** Medium-High (DOM manipulation, event handlers, conditional rendering, UI/UX)

**Token Estimate:** 38,000 - 52,000 tokens
- Reading existing form HTML for reference: ~12,000 tokens
- Implementation of form generator: ~20,000 tokens
- Event handler setup: ~5,000 tokens
- Testing and browser verification: ~8,000 tokens
- Debugging and refinement: ~5,000 tokens
- Buffer for iterations: ~5,000 tokens

**Development Time:** 50-70 minutes
- Core implementation: 30-40 minutes
- Event handler wiring: 10-15 minutes
- Browser testing and UI refinement: 10-15 minutes

### Success Criteria
- [ ] Form generates dynamically with all 15+ properties
- [ ] Collapsible sections work correctly
- [ ] "Add" buttons create new array items
- [ ] Delete buttons remove array items
- [ ] Enum fields show correct dropdown options
- [ ] Non-enum arrays show autocomplete datalists
- [ ] Required fields marked visually
- [ ] Form structure matches existing hardcoded form
- [ ] No console errors during form generation

---

## Combined Estimates (Phase 1 + Phase 2)

### Total Token Usage
**Conservative Estimate:** 66,000 tokens
**Expected Range:** 66,000 - 90,000 tokens
**Maximum (with significant iterations):** 110,000 tokens

### Total Development Time
**Conservative Estimate:** 85 minutes (1 hour 25 minutes)
**Expected Range:** 85-120 minutes (1.5 - 2 hours)
**Maximum (with debugging):** 150 minutes (2.5 hours)

### Token Breakdown by Activity
- Context reading and analysis: ~23,000 tokens (25%)
- Implementation (coding): ~35,000 tokens (38%)
- Testing and verification: ~13,000 tokens (14%)
- Debugging and refinement: ~10,000 tokens (11%)
- Documentation: ~2,000 tokens (2%)
- Iteration buffer: ~10,000 tokens (10%)

### Risk Factors

**Low Risk (adds <10% time/tokens):**
- Schema structure already well-documented
- Helper function patterns established
- Clear success criteria defined

**Medium Risk (adds 10-25% time/tokens):**
- Nested object handling complexity
- Equipment casing normalization edge cases
- Autocomplete performance with large datasets

**High Risk (adds 25-50% time/tokens):**
- Browser compatibility issues with dynamic forms
- Event handler memory leaks
- CSS conflicts with existing pt_report.html styles
- Integration issues with existing editor mode code

### Mitigation Strategies

1. **Incremental Testing:** Test each function immediately after implementation
2. **Console Logging:** Extensive logging during Phase 1 to verify metadata structure
3. **HTML Inspection:** Use browser dev tools to verify DOM structure in Phase 2
4. **Reference Implementation:** Keep existing hardcoded form for comparison during development
5. **Commit After Each Phase:** Separate commits for Phase 1 and Phase 2

---

## Next Steps After Phase 1 & 2

**Phase 3:** Form Data Collection (~30,000 tokens, 45 minutes)
**Phase 4:** Replace Existing Form (~25,000 tokens, 40 minutes)
**Phase 5:** Dosage System (~35,000 tokens, 60 minutes)
**Phase 6:** Export/Import Integration (~20,000 tokens, 30 minutes)
**Phase 7:** Validation & Edge Cases (~25,000 tokens, 45 minutes)

**Total Project Estimate:**
- Tokens: ~280,000 - 350,000 tokens
- Time: 6-8 hours of development

---

## Recommended Approach

### Option A: Complete Both Phases in One Session
- **Pros:** Maintains momentum, sees immediate results
- **Cons:** Long session (2+ hours), potential fatigue errors
- **Best for:** Dedicated development block

### Option B: Split into Two Sessions
- **Session 1:** Phase 1 only (35-50 min, ~33K tokens)
  - Build and verify schema infrastructure
  - Commit after testing
- **Session 2:** Phase 2 only (50-70 min, ~45K tokens)
  - Build dynamic form generator
  - Commit after testing

- **Pros:** Natural break points, easier to review/test
- **Cons:** Context switching between sessions
- **Best for:** Interrupted work environment

### Recommendation: **Option B (Two Sessions)**
Phase 1 and Phase 2 have clear separation and distinct success criteria. Testing Phase 1 thoroughly before starting Phase 2 reduces debugging complexity.

---

## Assumptions

1. Schema files (`schema/exercise_file.schema.json`) are well-formed
2. Existing `exercise_library.json` has consistent data types
3. Browser console is available for testing
4. No breaking changes to pt_report.html structure during development
5. Firebase/Firestore dependencies remain stable
6. Service worker cache can be cleared for testing

---

## Success Metrics

**Phase 1 Complete:**
- Schema metadata object successfully built
- All 15+ properties detected with correct types
- Autocomplete options extracted from library
- No browser console errors

**Phase 2 Complete:**
- Dynamic form renders with all fields
- UI matches existing form structure
- All interactive elements functional
- Clean browser console (no errors)

**Combined Success:**
- Total tokens used within ±20% of estimate
- Total time within ±30% of estimate
- All success criteria met
- Code committed and documented
