# PT Tracker - Development Practices

## Table of Contents
- [Development Workflow](#development-workflow)
  - [Day-to-day practices](#day-to-day-practices)
  - [Seeding shared data (`seed_firestore.html`)](#seeding-shared-data-seed_firestorehtml)
  - [Local vs deployed behavior](#local-vs-deployed-behavior)
  - [Offline and sync considerations](#offline-and-sync-considerations)
- [Best Practices](#best-practices)
- [Code Patterns & Standards (Updated 2026-01-05)](#code-patterns--standards-updated-2026-01-05)
- [Common Issues & Solutions](#common-issues--solutions)
- [Quick Diagnostic Checklist](#quick-diagnostic-checklist)

---

## Development Workflow

### Day-to-day practices

- **Static dev**: Open `pt_tracker.html` directly or serve with a simple static server. No build step.
- **Auth-dependent paths**: To test Firestore sync, sign in via the PT Tracker menu.
- **Shared data updates**: Use `seed_firestore.html` to push JSON files to `pt_shared`.

### Seeding shared data (`seed_firestore.html`)

Use the seeder to update the shared Firestore documents and (optionally) migrate dosage values into a user runtime. The page is intended for admin use only.

**Recommended order:**
1. **Sign in** with a Firebase account that has write access.
2. **Seed Shared Data** to write `exercise_library.json`, `exercise_roles.json`, vocab, and schemas into `pt_shared`.
3. **Migrate PT Dosage → Runtime** if you need to copy shared dosage values into a specific user runtime library.
4. **Reload Status** if you need a quick auth state sanity check.

**When to use each action:**
- **Seed Shared Data**: after updating JSON sources or schemas; required before expecting shared data to update in production.
- **Migrate PT Dosage → Runtime**: when shared library dosage values should become patient runtime dosage (e.g., after changing default prescription values).
- **Reload Status**: when the auth state seems stale or you have just signed in/out.

**Options:**
- **Overwrite existing dosage values**: replaces any runtime dosage values with shared ones. Use only when you intentionally want to reset patient-specific edits.
- **Record migration entries in exercise history**: adds a history entry for each migrated dosage; disable if you want a clean history.

### Local vs deployed behavior

- **Service worker** caches JSON and static assets. HTML is network-first with cached fallback for offline boot, so refreshes still fetch fresh HTML when online.
- Local testing in `file://` may break Firebase imports due to module restrictions. Use a local server for Firebase behavior.

### Offline and sync considerations

- Session history is written to local cache even when offline.
- When authenticated, sessions are queued in `pt_firestore_queue` and flushed when online.
- Runtime snapshots (`pt_runtime/state`) are updated on queue changes and preference updates.

---

## Best Practices

### 1. Avoid inline event handlers

❌ **BAD - inline onclick (hard to maintain, CSP issues):**
```html
<button onclick="deleteExercise(123)">Delete</button>
```

✅ **GOOD - addEventListener:**
```html
<button class="delete-btn" data-exercise-id="123">Delete</button>

<script>
document.querySelector('.delete-btn').addEventListener('click', (e) => {
  const id = e.target.dataset.exerciseId;
  deleteExercise(id);
});
</script>
```

**Current state:** Several HTML pages still use inline handlers (technical debt).

### 2. Avoid Fake or Editable Dropdowns

### ❌ Don’t Do This:
```javascript
// Fake or editable dropdowns break text entry on iOS
<div class="custom-dropdown">
    <div contenteditable="true">Other…</div>
</div>

// Expecting users to type inside a <select> option does not work on iOS
<select>
    <option value="a">Option A</option>
    <option value="other">Other (type here)</option>
</select>

// Mutating a <select> into an input is unreliable on iOS Safari / PWA
select.addEventListener('change', () => {
    if (select.value === 'other') {
        select.contentEditable = true; // ❌ iOS blocks typing
    }
});
````

### ✅ Do This Instead:

```javascript
// Always use a native <select> for predefined options
<select id="example-select">
    <option value="">-- Select an option --</option>
    <option value="a">Option A</option>
    <option value="b">Option B</option>
    <option value="__custom__">➕ Other (custom)…</option>
</select>

// Use a separate text input for custom values (hidden by default)
<input
    type="text"
    id="example-custom-input"
    placeholder="Enter custom value"
    style="display: none;"
>

// iOS-safe handling for the "Other" option
function bindSelectWithOther(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input  = document.getElementById(inputId);

    select.addEventListener('change', () => {
        if (select.value === '__custom__') {
            // Reveal a real text input — required for iOS
            input.style.display = 'block';
            input.focus(); // Critical for iOS keyboard activation
        } else {
            // Hide and clear custom input when not needed
            input.style.display = 'none';
            input.value = '';
        }
    });
}

// Resolve final value from either the select or the custom input
function resolveSelectValue(selectId, inputId) {
    const select = document.getElementById(selectId);
    if (select.value === '__custom__') {
        return document.getElementById(inputId).value.trim();
    }
    return select.value;
}
```

**Rule:**
All dropdowns must use **native `<select>` elements** and a **separate `<input>` for “Other”**.
This is the **only reliable pattern on iOS Safari and iOS PWAs**.



### 2. Service worker caching strategy

- HTML is **network-first** with a cached fallback for offline boot.
- JSON is **network-first** so exercise/roles updates propagate.
- Static assets are **cache-first** for offline reliability.

**When to bump cache version:** after updating JSON files or shared assets used offline.

### 3. iOS Safari PWA gotchas

**Issue:** Each PWA home screen icon gets its own localStorage.

**Symptom:** Coverage or PT Report appears empty when launched directly.

**Solution:** Launch from PT Tracker or ensure the same home screen entry is used.

### 4. Cross-file consistency

When modifying one PT page, check and update similar patterns in related files.

**Related file groups:**
- **Core PT pages:** `pt_tracker.html`, `pt_report.html`, `pt_view.html`, `rehab_coverage.html`
- **Shared modules:** `shared/firestore_shared_data.js`, `shared/exercise_form_module.js`
- **Static data:** `exercise_library.json`, `exercise_roles.json`, vocabularies, schemas

**Examples requiring consistency:**

❌ **BAD - inconsistent auth patterns:**
```javascript
// pt_tracker.html uses pointerup binding
guardButton.addEventListener('pointerup', showAuthModal);

// pt_report.html uses onclick (WRONG - will fail on iOS)
<button onclick="showAuthModal()">Sign In</button>
```

✅ **GOOD - consistent auth patterns:**
```javascript
// All PT pages use the same pointerup binding pattern
guardButton.addEventListener('pointerup', showAuthModal);
```

**When to check consistency:**
- **Event handling:** If you add/fix a button in one file, check if similar buttons exist in other files
- **Firebase patterns:** Auth checks, Firestore queries, offline handling should use the same approach
- **Data loading:** Exercise library, roles, and vocabulary loading should be consistent
- **Error handling:** Similar operations should handle errors the same way

**Checklist after changing shared patterns:**
1. Search for similar code patterns in related files: `grep -r "pattern" pt/*.html`
2. Update all occurrences to use the same approach
3. Test on iOS if UI interaction patterns changed
4. Document the canonical pattern if it's new

---

## Code Patterns & Standards (Updated 2026-01-05)

### Required Field Validation Pattern
All save operations must validate required fields BEFORE Firestore write:

```javascript
// Validate required fields
const errors = [];
if (!data.name || data.name.trim() === '') {
    errors.push('Name is required');
}
if (!data.description || data.description.trim() === '') {
    errors.push('Description is required');
}

if (errors.length > 0) {
    alert('Cannot save:\n\n' + errors.join('\n'));
    return;
}
```

### iOS Multi-tap Guard Pattern
All primary action buttons should use this pattern to prevent duplicate operations:

```javascript
let operationInProgress = false;

function performAction() {
    if (operationInProgress) return; // Guard against rapid clicks
    operationInProgress = true;

    const btn = document.querySelector('button selector');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }

    try {
        // Perform action logic
    } finally {
        operationInProgress = false;
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}
```

### Firestore Save Pattern
Always handle errors and provide user feedback:

```javascript
try {
    await saveFunction(data);
    alert('Data saved successfully!');
} catch (error) {
    console.error('[Firestore] Save failed:', error);
    alert('Failed to save: ' + error.message);
}

// For fire-and-forget saves with error logging:
saveFunction(data).catch(err => {
    console.error('[Firestore] Save failed:', err);
    alert('Warning: Failed to save to Firestore: ' + err.message);
});
```

### Duplicate Detection Pattern
Check for duplicates before creating new records:

```javascript
// Normalize for comparison
const normalizedName = newItem.name.trim().toLowerCase();

// Check existing items
const duplicate = existingItems.find(item =>
    item.id !== newItem.id &&
    item.name && item.name.trim().toLowerCase() === normalizedName
);

if (duplicate) {
    if (!confirm(`An item named "${duplicate.name}" already exists.\n\nCreate anyway?`)) {
        return;
    }
}
```

---

## Common Issues & Solutions

### Issue: Coverage shows all exercises as "not done"

**Likely causes:**
1. Firestore sessions not available (not authenticated).
2. localStorage key mismatch or empty history.
3. Exercise ID mismatch between library and roles.

**Checks:**
- Coverage debug panel (🐛) shows session counts and ID matches.
- Confirm `pt_tracker_data` exists in localStorage.


### Issue: Firestore queue never flushes

**Cause:** user not authenticated or network offline.

**Likely causes:**
1. Firestore sessions not available (not authenticated).
2. localStorage key mismatch or empty history.
3. Exercise ID mismatch between library and roles.

**Checks:**
- Coverage debug panel (🐛) shows session counts and ID matches.
- Confirm `pt_tracker_data` exists in localStorage.


### Issue: Firestore queue never flushes


**Likely causes:**
- User not authenticated
- Network offline
- Firestore IndexedDB persistence is stale or stuck
- Auth state expired while offline


**Fix (in order):**
1. Sign in via PT Tracker
2. Confirm `navigator.onLine === true`
3. Check `pt_firestore_queue` in localStorage to confirm queued writes exist
4. If queue exists but does not flush:
- Sign out
- Hard reload the page
- Sign back in (forces Firestore re-initialization)


**Notes:**
- Firestore offline persistence uses IndexedDB and **cannot be manually flushed** by app code
- Clearing localStorage alone will **not** reset Firestore state
- Clearing browser site data / IndexedDB is a **debug-only last resort**

### Issue: Shared data appears stale

**Cause:** service worker cache and Firestore fallback precedence.

**Fix:**
- Bump `CACHE_NAME` in `sw-pt.js` after JSON updates.
- Use `seed_firestore.html` to refresh Firestore shared data.

### Issue: iOS Safari offline launch fails with “FetchEvent.respondWith received an error: Returned response is null.”

**Cause (prior behavior):** the service worker did not cache HTML, so Safari could not fetch `pt_tracker.html` offline and returned no cached response.

**What this means today:** the service worker now caches `pt_tracker.html`, `rehab_coverage.html`, and `pt_report.html` and falls back to cached HTML when offline, so a cold offline launch should succeed once the cache is populated.

**Short-term requirement:** open the app once while online after a service worker update so the cached HTML is refreshed.

**Long-term decision (Phase 1+):** consider a dedicated offline shell to avoid serving a potentially stale HTML document.

### Issue: Shared data appears stale

**Cause:** service worker cache and Firestore fallback precedence.

**Fix:**
- Bump `CACHE_NAME` in `sw-pt.js` after JSON updates.
- Use `seed_firestore.html` to refresh Firestore shared data.

---

## Quick Diagnostic Checklist

When debugging issues:

1. ✅ Bump service worker version after data changes.
2. ✅ Check localStorage keys match (`pt_tracker_data` not `session_history`).
3. ✅ Verify exercise IDs match between library and roles.
4. ✅ Use Coverage view debug panel (🐛) to inspect data.
5. ✅ On iOS, close PWA completely and reopen after cache changes.
