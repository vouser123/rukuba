# Claude Project Guide - Rukuba PT Tracker

**Project:** Physical Therapy Exercise Tracker PWA
**Stack:** Vanilla HTML/CSS/JavaScript (no frameworks)
**Target:** iOS Safari, Progressive Web App (PWA)
**Last Updated:** 2024-12-29

---

## 🏗️ Architecture Principles

### 1. Schema-Driven Development ⚠️ CRITICAL

**ALL exercise properties MUST be dynamically generated from schema files.**

**NO hardcoded property names allowed in:**
- Form field generation
- Data collection
- Validation logic
- Display logic

**Schema Sources:**
- `pt/schema/exercise_file.schema.json` - Exercise definitions (canonical_name, muscles, equipment, etc.)
- `pt/schema/exercise_roles.schema.json` - Role assignments (region, capacity, contribution)

**Example - WRONG ❌:**
```javascript
// DON'T hardcode property names
const muscles = exercise.primary_muscles;
const equipment = exercise.equipment.required;
```

**Example - RIGHT ✅:**
```javascript
// DO use schema metadata
for (const [fieldPath, config] of Object.entries(schemaMetadata.fieldConfigs)) {
    const value = getNestedValue(exercise, fieldPath);
    // Process based on config.type, config.isArray, etc.
}
```

**Why?** Schema can evolve. New properties get added. Hardcoding creates brittle code that breaks when schema changes.

**Implementation:** See `pt/REFACTOR_STATUS.md` for current schema-driven refactor status.

---

## 📱 iOS / PWA Requirements ⚠️ CRITICAL

### onclick is NOT iOS/PWA Friendly!

**NEVER use inline onclick handlers:**
```html
<!-- WRONG ❌ -->
<button onclick="doSomething()">Click</button>
```

**ALWAYS use addEventListener:**
```html
<!-- RIGHT ✅ -->
<button id="myButton">Click</button>
<script>
document.getElementById('myButton').addEventListener('click', doSomething);
</script>
```

**Why?**
- iOS Safari CSP (Content Security Policy) restrictions
- PWA security requirements
- Better separation of concerns
- Easier to debug

**Exception:** Dynamically generated content where you control the scope can use inline handlers temporarily, but refactor to event delegation ASAP.

### Touch-Friendly UI Requirements

**Minimum tap target size:** 48x48px (iOS HIG requirement)
```css
.btn-primary {
    min-height: 48px;
    padding: 14px 24px;
}
```

**No hover-dependent interactions:**
- Hover states are OK for visual feedback
- Core functionality must NOT require hover
- Use `:active` for touch feedback

**Gesture Support:**
```javascript
// Support both click and touch events
element.addEventListener('touchstart', handleTouch, { passive: true });
element.addEventListener('click', handleClick);
```

**Prevent double-tap zoom:**
```css
* {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}
```

### PWA Manifest & Service Worker

**Files:**
- `pt/manifest-pt.json` - PWA manifest
- `pt/sw-pt.js` - Service worker for offline support

**Requirements:**
- Must be installable on iOS home screen
- Must work offline (cached resources)
- Must handle updates gracefully

---

## 💾 localStorage Architecture

### Keys Used

| Key | Purpose | Structure |
|-----|---------|-----------|
| `pt_tracker_data` | Main app data | Session history, current workout state |
| `pt_exercise_library` | Exercise definitions + dosage | Array of exercise objects with `current` dosage |
| `pt_data_version` | Schema version tracking | String (e.g., "1") |
| `pt_exercise_drafts` | Unsaved draft exercises | Temporary storage |
| `pt_last_exercise_id` | ID counter | String or number |

### Exercise Library Structure ⚠️ IMPORTANT

```javascript
// localStorage.getItem('pt_exercise_library')
[
  {
    id: "ex0001",  // or 26-char ULID
    exercise_id: "ex0001",
    canonical_name: "Single Leg Bridge",
    description: "...",
    primary_muscles: ["Gluteus Maximus", ...],
    equipment: { required: [...], optional: [...] },
    pattern: "side",  // or "both"
    pattern_modifiers: ["hold_seconds"],

    // ⚠️ DOSAGE LIVES HERE (patient-specific, NOT exported to library JSON)
    current: {
      type: "hold",  // "reps" | "hold" | "duration"
      sets: 3,
      repsPerSet: 10,
      secondsPerRep: 5,  // Hold time
      distanceFeet: 0    // If distance_feet modifier
    },

    // History of dosage changes
    history: [
      {
        timestamp: "2024-12-29T10:00:00Z",
        spec: { type: "hold", sets: 2, repsPerSet: 8, secondsPerRep: 3 },
        reason: "Initial dosage"
      }
    ],

    // Session tracking
    sessionData: [
      {
        timestamp: "2024-12-29T14:30:00Z",
        sets: [
          { set: 1, reps: 10, side: "left", timestamp: "..." },
          { set: 1, reps: 10, side: "right", timestamp: "..." }
        ]
      }
    ]
  }
]
```

### Dosage Architecture ⚠️ CRITICAL

**Where dosage is stored:** Inside exercise objects in `pt_exercise_library`

**Where dosage is NOT stored:**
- ❌ NOT in `exercise_library.json` (schema definitions only)
- ❌ NOT in `pt_tracker_data`
- ❌ NOT in a separate dosagePrescriptions localStorage key

**How dosage flows:**

1. **PT sets dosage in editor (pt_report.html):**
   ```javascript
   modifications.dosagePrescriptions = {
     "ex0001": {
       current: {
         type: "reps",
         sets: 3,
         repsPerSet: 10,
         secondsPerRep: 0,
         distanceFeet: 0
       }
     }
   };
   ```

2. **PT exports to patient via email:**
   - Email contains JSON with `modifications.dosagePrescriptions`

3. **Patient imports in tracker (pt_tracker.html):**
   ```javascript
   // Apply dosage to exercise.current
   exercise.current = modifications.dosagePrescriptions[exerciseId].current;

   // Add to history
   exercise.history.push({
     timestamp: new Date().toISOString(),
     spec: exercise.current,
     reason: "PT prescription update"
   });

   // Save to localStorage
   localStorage.setItem('pt_exercise_library', JSON.stringify(exerciseLibrary));
   ```

**Pattern Modifier → Dosage Type Mapping:**
```javascript
const dosageTypeRules = {
    // No modifiers → reps
    default: { type: "reps", fields: ["sets", "repsPerSet"] },

    // Modifiers
    duration_seconds: { type: "duration", fields: ["sets", "secondsPerRep"] },
    hold_seconds: { type: "hold", fields: ["sets", "repsPerSet", "secondsPerRep"] },
    distance_feet: { type: "reps", fields: ["sets", "distanceFeet"] },  // Distance replaces reps
    alternating: { type: "reps", fields: ["sets", "repsPerSet"] },  // Alternates L/R
    AMRAP: { type: "duration", fields: ["sets", "secondsPerRep"] }
};
```

---

## 📂 Project Structure

```
rukuba/
├── pt/
│   ├── pt_tracker.html         # Patient app (main tracker)
│   ├── pt_report.html          # PT editor (add/edit exercises & roles)
│   ├── exercise_editor.html    # Exercise definition editor
│   ├── rehab_coverage.html     # Coverage analysis view
│   ├── exercise_library.json   # Schema-compliant exercise definitions
│   ├── exercise_roles.json     # Role assignments (region/capacity/contribution)
│   ├── exercise_roles_vocabulary.json  # Term definitions
│   ├── shared-styles.css       # Shared CSS variables and utilities
│   ├── manifest-pt.json        # PWA manifest
│   ├── sw-pt.js               # Service worker
│   ├── schema/
│   │   ├── exercise_file.schema.json   # Exercise schema (source of truth)
│   │   └── exercise_roles.schema.json  # Roles schema
│   ├── docs/                   # Documentation
│   ├── REFACTOR_STATUS.md      # Current refactor status
│   └── EXERCISE_EDITOR_README.md
├── .claude/
│   └── plans/
│       └── whimsical-conjuring-otter.md  # Schema-driven refactor plan
└── claude.md                   # This file
```

---

## 🎨 CSS Architecture

### Design System

**CSS Variables (Light/Dark Mode):**
```css
:root {
    --ios-blue: #007AFF;
    --ios-green: #34C759;
    --ios-red: #FF3B30;
    --ios-orange: #FF9500;
    --ios-yellow: #FFCC00;
    --ios-gray: #8E8E93;

    --bg-primary: #FFFFFF;
    --bg-secondary: #F2F2F7;
    --bg-tertiary: #E5E5EA;
    --text-primary: #000000;
    --text-secondary: #3C3C43;
    --border-color: #C6C6C8;
}

@media (prefers-color-scheme: dark) {
    :root {
        --bg-primary: #000000;
        --bg-secondary: #1C1C1E;
        --bg-tertiary: #2C2C2E;
        --text-primary: #FFFFFF;
        --text-secondary: #8E8E93;
        --border-color: #38383A;
    }
}
```

**Shared Styles:** `pt/shared-styles.css` contains:
- CSS variables (light/dark mode)
- Base reset
- Utility classes
- Button styles
- Form controls
- Modal styles

**Per-page styles:** Inline `<style>` tags for page-specific styling

---

## 🔧 Code Standards

### JavaScript Patterns

**Event Handling (iOS-safe):**
```javascript
// ❌ WRONG
<button onclick="save()">Save</button>

// ✅ RIGHT
document.getElementById('saveBtn').addEventListener('click', save);

// ✅ BETTER (event delegation for dynamic content)
document.getElementById('container').addEventListener('click', (e) => {
    if (e.target.matches('.save-btn')) {
        save();
    }
});
```

**Async/Await for File Operations:**
```javascript
async function loadExercises() {
    try {
        const response = await fetch('exercise_library.json');
        if (!response.ok) throw new Error('Failed to load');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading exercises:', error);
        alert('Failed to load exercises');
    }
}
```

**LocalStorage Helpers:**
```javascript
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Storage error:', e);
        alert('Failed to save data');
    }
}

function loadFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Parse error:', e);
        return defaultValue;
    }
}
```

**Schema-Driven Form Generation:**
```javascript
// Always generate from schema, never hardcode
function generateForm(schemaMetadata) {
    for (const [fieldPath, config] of Object.entries(schemaMetadata.fieldConfigs)) {
        if (config.isArray) {
            createArrayField(config);
        } else {
            createPrimitiveField(config);
        }
    }
}
```

### HTML Patterns

**Modals (iOS-safe):**
```html
<div class="modal" id="myModal" onclick="if(event.target === this) closeModal()">
    <div class="modal-content">
        <!-- Content here -->
        <button id="closeBtn">Close</button>
    </div>
</div>

<script>
// Better: event listener instead of inline onclick
document.getElementById('closeBtn').addEventListener('click', closeModal);
</script>
```

**Forms (Accessible):**
```html
<div class="form-group">
    <label for="exerciseName" class="form-label">Exercise Name *</label>
    <input type="text"
           id="exerciseName"
           class="form-input"
           required
           aria-required="true"
           placeholder="e.g., Single Leg Bridge">
</div>
```

---

## 📊 Data Flow

### PT → Patient Workflow

```
┌─────────────────────────────────────────────────┐
│ PT Editor (pt_report.html)                      │
├─────────────────────────────────────────────────┤
│ 1. Load base files:                             │
│    - exercise_library.json                      │
│    - exercise_roles.json                        │
│    - schema/exercise_file.schema.json           │
│                                                  │
│ 2. PT edits:                                    │
│    - Add/edit/archive exercises                 │
│    - Assign/edit/delete roles                   │
│    - Set dosage (NEW!)                          │
│                                                  │
│ 3. Track modifications:                         │
│    {                                             │
│      newExercises: [...],                       │
│      editedExercises: {...},                    │
│      archivedExercises: [...],                  │
│      newRoles: {...},                           │
│      deletedRoles: {...},                       │
│      dosagePrescriptions: {...}  // NEW         │
│    }                                             │
│                                                  │
│ 4. Export to email:                             │
│    - Generate JSON with markers                 │
│    - Calculate SHA-256 hash                     │
│    - Create mailto: link                        │
└─────────────────────────────────────────────────┘
                      │
                      ▼ (Email)
┌─────────────────────────────────────────────────┐
│ Patient receives email with:                    │
│                                                  │
│ --START_PT_MODIFICATIONS--                      │
│ { modifications JSON }                          │
│ --END_PT_MODIFICATIONS--                        │
│ --CHECKSUM:abc123...--                          │
│ --SIZE:12345--                                  │
└─────────────────────────────────────────────────┘
                      │
                      ▼ (Copy/Paste)
┌─────────────────────────────────────────────────┐
│ PT Tracker (pt_tracker.html)                    │
├─────────────────────────────────────────────────┤
│ 1. Patient pastes email content                 │
│                                                  │
│ 2. Validate:                                    │
│    - Extract JSON from markers                  │
│    - Verify SHA-256 checksum                    │
│    - Verify byte size                           │
│                                                  │
│ 3. Apply modifications:                         │
│    - Add new exercises to library               │
│    - Update edited exercises                    │
│    - Archive old exercises                      │
│    - Add/update roles                           │
│    - Apply dosage to exercise.current  // NEW   │
│                                                  │
│ 4. Save to localStorage:                        │
│    - pt_exercise_library (with dosage)          │
│                                                  │
│ 5. Reload app                                   │
└─────────────────────────────────────────────────┘
```

---

## 🧪 Testing Requirements

### Browser Testing

**Required:**
- ✅ Safari iOS (primary target)
- ✅ Chrome iOS
- ✅ Desktop Safari (dev testing)

**Nice to have:**
- Chrome Desktop
- Firefox

### PWA Testing

**Install Flow:**
1. Open in Safari iOS
2. Tap Share → Add to Home Screen
3. Verify icon appears
4. Launch from home screen
5. Verify runs in standalone mode (no Safari UI)

**Offline Testing:**
1. Load app while online
2. Enable Airplane Mode
3. Reload app
4. Verify core functionality works (cached)

### localStorage Testing

**Test scenarios:**
1. Fresh install (no data)
2. Import exercises
3. Add session data
4. Clear cache and verify data persists
5. Import modifications (merge)
6. Quota exceeded handling

---

## 🐛 Common Pitfalls

### 1. Hardcoded Property Names ❌
```javascript
// DON'T DO THIS
const muscles = exercise.primary_muscles;
const required = exercise.equipment.required;

// DO THIS
const muscles = getNestedValue(exercise, 'primary_muscles');
const required = getNestedValue(exercise, 'equipment.required');
```

### 2. Inline Event Handlers ❌
```html
<!-- DON'T DO THIS -->
<button onclick="save()">Save</button>

<!-- DO THIS -->
<button id="saveBtn">Save</button>
<script>
document.getElementById('saveBtn').addEventListener('click', save);
</script>
```

### 3. Dosage in Wrong Place ❌
```javascript
// DON'T store dosage here
exerciseLibraryJSON.exercises[0].dosage = {...};

// DO store dosage here (in tracker's localStorage)
exercise.current = {
    type: "reps",
    sets: 3,
    repsPerSet: 10,
    secondsPerRep: 0,
    distanceFeet: 0
};
```

### 4. Ignoring Dark Mode ❌
```css
/* DON'T use hard-coded colors */
.button {
    background: #007AFF;
    color: white;
}

/* DO use CSS variables */
.button {
    background: var(--ios-blue);
    color: var(--text-primary);
}
```

### 5. Small Touch Targets ❌
```css
/* DON'T use tiny buttons */
.btn {
    padding: 4px 8px;
    font-size: 12px;
}

/* DO use 48px minimum */
.btn {
    min-height: 48px;
    padding: 14px 24px;
    font-size: 16px;
}
```

---

## 📝 Git Commit Guidelines

**Commit message format:**
```
<type>: <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `style:` CSS/formatting
- `test:` Testing
- `chore:` Maintenance

**Examples:**
```
fix: Change schema loading from exercise_roles to exercise_file

The PT editor was loading the wrong schema file, causing pattern
enum values to not populate correctly.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 🔐 Security Considerations

### Content Security Policy (CSP)

**Why inline handlers fail:**
```
Content-Security-Policy: default-src 'self'; script-src 'self'
```

This blocks `onclick="..."` but allows:
```javascript
element.addEventListener('click', handler);
```

### LocalStorage Security

**What to store:**
- ✅ Exercise definitions (not sensitive)
- ✅ Session history (not sensitive)
- ✅ Dosage (medical data, but local-only)

**What NOT to store:**
- ❌ Authentication tokens
- ❌ API keys
- ❌ Personal health information (beyond exercise data)

**Encryption:** Not currently implemented (localStorage is unencrypted)

---

## 📚 Reference Documentation

### External Resources

- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [JSON Schema Draft-07](https://json-schema.org/draft-07/json-schema-release-notes.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Internal Documentation

- `pt/REFACTOR_STATUS.md` - Current refactor status
- `pt/EXERCISE_EDITOR_README.md` - Exercise editor guide
- `pt/docs/` - Additional documentation
- `.claude/plans/whimsical-conjuring-otter.md` - Schema-driven refactor plan

---

## 🚀 Quick Start for New Claude Sessions

1. **Read this file first** (`claude.md`)
2. **Check refactor status** (`pt/REFACTOR_STATUS.md`)
3. **Review the plan** (`.claude/plans/whimsical-conjuring-otter.md`)
4. **Understand schema-driven principle** (NO hardcoding!)
5. **Remember iOS/PWA requirements** (NO onclick!)
6. **Start coding** 🎉

---

**Last Updated:** 2024-12-29
**Current Focus:** Schema-driven refactor (Phase 1-7)
**Next Major Feature:** Dosage system with PT control
