# Claude Code Development Guide

This document outlines the required workflow when working on this codebase.

## Required Workflow for All Code Changes

### 1. Read DEVELOPMENT.md First

**ALWAYS** read `pt/docs/DEVELOPMENT.md` before making changes to any PT-related files.

**Why:**
- Documents known iOS Safari/PWA issues and proven solutions
- Shows established patterns (e.g., `data-action` with `pointerup` events)
- Prevents reintroducing bugs that were already fixed
- Provides architectural context and design decisions

**When to read:**
- Before fixing any bug
- Before adding new features
- When implementing UI interactions
- When working with Firebase/Firestore

### 2. Comment Your Code

**All new functions and non-trivial code blocks must include comments.**

**Required for:**
- Function definitions (JSDoc-style preferred)
- Complex logic or workarounds
- iOS-specific fixes
- Firebase query patterns
- Dynamic HTML generation with event binding

**Example (Good):**
```javascript
/**
 * Bind iOS-safe pointer event handlers to elements with data-action attributes.
 *
 * iOS Safari/PWA does not reliably trigger onclick handlers on dynamically created elements.
 * This function binds pointerup events (which work consistently on iOS touch and desktop mouse)
 * and keyboard events for accessibility.
 *
 * @param {HTMLElement} root - Root element to search for data-action elements (default: document)
 */
function bindPointerHandlers(root = document) {
    // Implementation...
}
```

**Example (Bad):**
```javascript
function bindPointerHandlers(root = document) {
    // No explanation of why this exists or what iOS issue it solves
}
```

### 3. Log Development Notes

**After completing a fix, add an entry to DEVELOPMENT.md.**

**Format:**
```markdown
- **YYYY-MM-DD** — **Problem:** [Description of the issue]. **What I did:** [Description of the fix and files changed].
```

**What to include:**
- Date
- Problem description (symptoms)
- Solution description
- Files modified
- Any platform-specific considerations (iOS, desktop, etc.)

**Example:**
```markdown
- **2026-01-06** — **Problem:** "Add Role" button in rehab_coverage.html did not respond to taps on iOS Safari/PWA. **What I did:** Converted the dynamically-generated "Add Role" button from inline `onclick` to `data-action` pattern with `bindPointerHandlers()` function. Added `pointerup` event listeners for iOS touch/desktop mouse compatibility and keyboard support (Enter/Space) for accessibility. Re-bind handlers after dynamic HTML updates to ensure reliability (`pt/rehab_coverage.html`).
```

## iOS Safari/PWA Best Practices

### ❌ Don't Do This:
```javascript
// Inline onclick handlers don't work reliably on iOS
<button onclick="doSomething()">Click Me</button>

// Click events may not fire on iOS Safari/PWA
element.addEventListener('click', handler);
```

### ✅ Do This Instead:
```javascript
// Use data-action pattern for dynamically created elements
<button data-action="doSomething">Click Me</button>

// Bind with pointerup for iOS touch + desktop mouse compatibility
function bindPointerHandlers(root = document) {
    const elements = root.querySelectorAll('[data-action]');
    elements.forEach(el => {
        const action = el.getAttribute('data-action');
        const handler = (e) => {
            const fn = window[action];
            if (fn) {
                e.preventDefault();
                fn();
            }
        };

        // pointerup works on iOS touch and desktop mouse
        el.addEventListener('pointerup', handler);

        // Keyboard support for accessibility
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handler(e);
            }
        });
    });
}
```

## Firebase/Firestore Patterns

### Always Use Offline Persistence
```javascript
// firebase.js uses persistentLocalCache()
const db = initializeFirestore(app, {
    cache: persistentLocalCache()
});
```

### Session History Authority
- Firestore `users/{uid}/sessions` is **authoritative** when authenticated
- localStorage `pt_tracker_data` is a fallback/cache
- Runtime snapshots (`users/{uid}/pt_runtime/state`) cache preferences and library

## Common Gotchas

1. **Service Worker Cache**: Bump `CACHE_NAME` in `sw-pt.js` after JSON updates
2. **localStorage Keys**: Use `pt_tracker_data` not `session_history` (legacy key)
3. **iOS PWA Storage**: Each home screen icon has separate localStorage
4. **Dynamic HTML**: Always rebind event handlers after `innerHTML` updates
5. **Exercise IDs**: Must match between library and roles for coverage to work

## Quick Reference

- **Main docs**: `pt/docs/DEVELOPMENT.md`
- **V2 payload format**: `pt/docs/export-import-v2.md`
- **Vocabulary docs**: `pt/docs/vocabularies.md`
- **Service worker**: `pt/sw-pt.js`
- **Firebase config**: `pt/firebase.js`

## Summary Checklist

Before submitting any code change:

- [ ] Read `pt/docs/DEVELOPMENT.md` (especially for iOS/Firebase work)
- [ ] Add JSDoc comments to new functions
- [ ] Comment non-obvious logic and platform-specific workarounds
- [ ] Log development note in DEVELOPMENT.md with date, problem, and solution
- [ ] Test on iOS Safari/PWA if UI changes were made
- [ ] Verify no `onclick` or `click` handlers were introduced
- [ ] Check that dynamic HTML rebinds event handlers
