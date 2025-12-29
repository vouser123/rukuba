# PT Tracker - Development Guide

Complete technical documentation for PT Tracker and Rehab Coverage system.

## Table of Contents
- [Data Architecture](#data-architecture)
- [Exercise Roles System](#exercise-roles-system)
- [Best Practices](#best-practices)
- [Common Issues & Solutions](#common-issues--solutions)
- [Development Workflow](#development-workflow)
- [Architecture Decisions](#architecture-decisions)

---

## Data Architecture

### localStorage Keys

**CRITICAL:** PT Tracker and Coverage share data via localStorage using specific keys:

```javascript
// PT Tracker storage keys
const STORAGE_KEY = 'pt_tracker_data';           // Session history array
const LIBRARY_KEY = 'pt_exercise_library';       // Exercise library
const PT_VERSION_KEY = 'pt_data_version';        // Data version
const LAST_EXERCISE_KEY = 'pt_last_exercise_id'; // Last selected exercise
```

**Common Bug:** Coverage view must read from `pt_tracker_data`, NOT `session_history`.

❌ **WRONG:**
```javascript
const historyJSON = localStorage.getItem('session_history');
```

✅ **CORRECT:**
```javascript
const historyJSON = localStorage.getItem('pt_tracker_data');
```

### Session History Structure

```javascript
[
  {
    "exerciseId": "01KDE8962NN3ZP5KDS6TMFP20W", // ULID format
    "date": "2024-12-21",                       // YYYY-MM-DD
    "sets": 2,
    "reps": 15,
    "notes": "Felt good today"
  }
]
```

### Exercise Roles Structure

```javascript
{
  "schema_version": "1.0",
  "exercise_roles": {
    "01KDE8962NN3ZP5KDS6TMFP20W": {
      "name": "Forward Lunge with Rotation and Swiss Ball (Wall)",
      "roles": [
        {
          "region": "back",           // Enum: core, back, hip, knee, ankle, foot, vestibular
          "capacity": "stability",    // Enum: strength, control, stability, tolerance, mobility
          "focus": "anti_rotation",   // Optional. Enum varies by capacity
          "contribution": "high"      // Enum: low, medium, high
        }
      ]
    }
  }
}
```

---

## Exercise Roles System

### Design Principles

1. **NO HARDCODED ENUMS** - All enums must be derived at runtime from `exercise_roles.schema.json`
2. **Exercise library is immutable** - Roles are an overlay; never modify exercise library structure
3. **Schema is the source of truth** - Always reference schema for valid values
4. **Bidirectional relationships** - Exercises can have multiple roles, roles can have multiple exercises

### How Roles Work

**Analogy:** Roles are like tags on blog posts. An exercise can serve multiple purposes (e.g., "Lunge With Rotation" builds both back stability and core control).

**Key Concept:**
- **Region** = Body area (e.g., core, hip, ankle)
- **Capacity** = Type of deficit (e.g., strength, stability, control)
- **Focus** = Specific sub-type (e.g., sagittal, lateral, anti-rotation) - OPTIONAL
- **Contribution** = How effective this exercise is (low/medium/high)

### Adding New Exercises to Roles

1. **Check the schema** for valid enum values:
   ```bash
   cat schema/exercise_roles.schema.json
   ```

2. **Add entry to exercise_roles.json**:
   ```json
   "01NEWEXERCISEID123456789": {
     "name": "My New Exercise",
     "roles": [
       {
         "region": "hip",
         "capacity": "strength",
         "focus": "lateral",
         "contribution": "high"
       }
     ]
   }
   ```

3. **Validate** - Coverage view will automatically show it (no code changes needed)

### Adding New Vocabulary Definitions

Edit `exercise_roles_vocabulary.json`:

```json
{
  "focus": {
    "my_new_focus": "Description of what this focus means."
  }
}
```

---

## Best Practices

### 1. Avoid Inline Event Handlers

❌ **BAD - Inline onclick (hard to maintain, CSP issues, debugging hell):**
```html
<button onclick="deleteExercise(123)">Delete</button>
```

✅ **GOOD - Event delegation or addEventListener:**
```html
<button class="delete-btn" data-exercise-id="123">Delete</button>

<script>
document.querySelector('.delete-btn').addEventListener('click', (e) => {
  const id = e.target.dataset.exerciseId;
  deleteExercise(id);
});
</script>
```

**Why this matters:**
- Inline handlers violate Content Security Policy (CSP)
- Makes debugging harder (no stack traces in DevTools)
- Can't use event delegation efficiently
- Harder to test

**Current State:** Both `pt_tracker.html` and `rehab_coverage.html` use inline onclick handlers. This was a pragmatic choice for rapid development but should be refactored for production.

### 2. Service Worker Caching Strategy

**Current approach:** Network-first for HTML, cache-first for JSON data.

```javascript
// sw-pt.js
const CACHE_NAME = 'pt-tracker-v1.10.0';  // Bump version to force cache refresh

// HTML: Always fetch fresh
if (url.pathname.endsWith('.html')) {
  return fetch(request); // Never cache HTML
}

// JSON: Cache-first with fallback
return caches.match(request).then(response => {
  return response || fetch(request);
});
```

**When to bump cache version:**
- After changing any JSON data files
- After modifying cached assets
- User reports seeing stale data

### 3. iOS Safari PWA Gotchas

**Issue:** Each PWA home screen icon gets its own localStorage.

**Symptom:** User bookmarks Coverage directly → sees 0 sessions (empty localStorage).

**Solution:**
- ✅ Always navigate to Coverage FROM PT Tracker
- ❌ Don't create separate home screen bookmarks for Coverage

**Testing on iOS:**
```bash
# Force cache refresh by bumping service worker version
# Users must close and reopen the PWA
```

### 4. Runtime Enum Derivation

❌ **BAD - Hardcoded:**
```javascript
const regions = ['core', 'back', 'hip', 'knee']; // Will break when schema changes
```

✅ **GOOD - Derived from schema:**
```javascript
function deriveEnums() {
  const roleSchema = schema.definitions.role;
  regions = roleSchema.properties.region.enum || [];
  capacities = roleSchema.properties.capacity.enum || [];
  contributions = roleSchema.properties.contribution.enum || [];
}
```

**Why:** Schema is the single source of truth. Adding a new region should just work without code changes.

### 5. Data Import/Export

**Export format:**
```json
{
  "pt_exercise_library": [...],
  "pt_tracker_data": [...],
  "pt_data_version": "1"
}
```

**Import validation:**
```javascript
// Always check structure before importing
if (!data.pt_exercise_library || !Array.isArray(data.pt_tracker_data)) {
  alert('Invalid backup file structure');
  return;
}
```

---

## Common Issues & Solutions

### Issue: Coverage shows all exercises as "not done"

**Diagnosis:**
```javascript
// Open Coverage → Tap 🐛 debug button
// Check: "Sessions: 0" or "Matching IDs: 0"
```

**Solutions:**
1. **localStorage key mismatch** - Coverage reading wrong key (should be `pt_tracker_data`)
2. **Exercise ID mismatch** - Session history uses different IDs than roles file
3. **Stale service worker cache** - Bump `CACHE_NAME` in `sw-pt.js`

### Issue: Changes to exercise_roles.json not appearing

**Solution:**
```javascript
// 1. Bump service worker version
const CACHE_NAME = 'pt-tracker-v1.11.0'; // Increment

// 2. Force reload in Coverage view (tap 🔄 button)
// 3. On iOS: Close PWA completely and reopen
```

### Issue: Exercise IDs don't match between library and roles

**Check:**
```bash
# Get IDs from library
jq '.exercises[].id' exercise_library.json | head -5

# Get IDs from roles
jq '.exercise_roles | keys[]' exercise_roles.json | head -5
```

**Solution:** Exercise IDs must match exactly (case-sensitive ULIDs).

---

## Development Workflow

### Adding a New Capacity

1. **Update schema** (`schema/exercise_roles.schema.json`):
   ```json
   "capacity": {
     "enum": ["strength", "control", "stability", "tolerance", "mobility", "power"]
   }
   ```

2. **Add vocabulary** (`exercise_roles_vocabulary.json`):
   ```json
   "capacity": {
     "power": "Ability to generate force rapidly. Failure looks like slow movement speed."
   }
   ```

3. **Assign exercises** (`exercise_roles.json`):
   ```json
   "01SOMEEXERCISEID": {
     "roles": [
       {
         "region": "hip",
         "capacity": "power",
         "contribution": "high"
       }
     ]
   }
   ```

4. **Test in Coverage view** - Should auto-populate (no code changes needed)

### Adding a New Region

Same process as capacity, but also consider:
- Does this region need specific focus values?
- Update vocabulary with clinical definitions
- Ensure exercises in library target this region

---

## File Reference

### Core Files

| File | Purpose | Modify? |
|------|---------|---------|
| `pt_tracker.html` | Main exercise tracker | Yes - for UI changes |
| `rehab_coverage.html` | Coverage analysis view | Yes - for UI changes |
| `exercise_library.json` | Exercise database | Rarely - add exercises only |
| `exercise_roles.json` | Exercise role mappings | Frequently - assign roles |
| `exercise_roles_vocabulary.json` | Term definitions | Occasionally - add definitions |
| `schema/exercise_roles.schema.json` | Schema (source of truth) | Rarely - add enums only |
| `sw-pt.js` | Service worker | When bumping cache version |

### Configuration

```javascript
// pt_tracker.html - localStorage keys
const STORAGE_KEY = 'pt_tracker_data';
const LIBRARY_KEY = 'pt_exercise_library';

// sw-pt.js - Cache version
const CACHE_NAME = 'pt-tracker-v1.10.0';  // Increment to force refresh

// rehab_coverage.html - Data sources
await fetch('exercise_roles.json');
await fetch('exercise_roles_vocabulary.json');
await fetch('schema/exercise_roles.schema.json');
localStorage.getItem('pt_tracker_data');  // NOT 'session_history'
```

---

## Debugging Tools

### In-App Debug Panel (Coverage View)

Tap **🐛** button to see:
- localStorage keys and sizes
- Session count and sample IDs
- Role count and sample IDs
- Exercise ID matches

### Browser Console Logs

```javascript
// Coverage view logs on load:
[Schema] Loaded: {...}
[Roles] Loaded: 23 exercises with roles
[Library] Loaded: 147 exercises
[History] Loaded: 20 sessions
[Enums] Derived: {regions: [...], capacities: [...], contributions: [...]}
```

### Manual localStorage Inspection

```javascript
// In browser console:
JSON.parse(localStorage.getItem('pt_tracker_data'))      // Session history
JSON.parse(localStorage.getItem('pt_exercise_library'))  // Exercise library
localStorage.length                                       // Total keys
```

---

## Architecture Decisions

### Why separate exercise_roles.json from exercise_library.json?

**Separation of concerns:**
- Exercise library = immutable reference data (exercises themselves)
- Exercise roles = clinical interpretation layer (how exercises are used)
- Allows updating roles without touching library
- Library can be shared across other tools (e.g., general exercise database)

### Why runtime enum derivation instead of hardcoding?

**Future-proofing:**
- Adding a new capacity shouldn't require code changes
- Schema acts as a contract between files
- Reduces maintenance burden
- Makes the system more flexible for clinical iteration

### Why localStorage instead of a backend?

**Offline-first PWA:**
- Works without internet (critical for gym use)
- No server costs or maintenance
- User owns their data (privacy)
- Fast performance (no network latency)
- Simple deployment (static files only)

### Why inline onclick handlers? (Technical Debt)

**Pragmatic choice:**
- Rapid prototyping (faster to write initially)
- Single-file components (easier to reason about)
- No build step required

**Should be refactored to:**
- Event delegation for better performance
- Separation of HTML/CSS/JS
- CSP compliance
- Better testability

---

## TODOs / Known Issues

### Technical Debt
- [ ] Refactor inline onclick handlers to event listeners
- [ ] Add unit tests for role matching logic
- [ ] Implement proper error boundaries for data loading failures
- [ ] Add TypeScript definitions for data structures

### Feature Improvements
- [ ] Add exercise history chart (volume over time)
- [ ] Export coverage report as PDF
- [ ] Add exercise video previews
- [ ] Implement search/filter in coverage view

### Performance
- [ ] Lazy load exercise roles (only fetch when opening Coverage)
- [ ] Add loading skeletons instead of "Loading..."
- [ ] Optimize coverage rendering for large exercise lists

---

## Quick Diagnostic Checklist

When debugging issues:

1. ✅ Bump service worker version after data changes
2. ✅ Check localStorage keys match (`pt_tracker_data` not `session_history`)
3. ✅ Verify exercise IDs match between library and roles
4. ✅ Use Coverage view debug panel (🐛) to inspect data
5. ✅ On iOS, close PWA completely and reopen after cache changes
