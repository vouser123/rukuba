# PT App: Unified UI + Firebase API Integration Plan

**Status:** Ready for Implementation
**Date:** 2026-01-06
**Estimated Duration:** 14-16 days across 6 phases

---

## Executive Summary

Consolidate PT editor functionality, integrate pt_data_api.js across all pages, implement offline queue with replay, and migrate to event-sourced versioned schema with scheduled downtime.

**Architectural Decisions (Confirmed):**
- ✅ Keep all versions forever (full audit trail)
- ✅ Event sourcing: append-only completions ledger
- ✅ Offline queue with automatic replay
- ✅ Scheduled downtime for migration
- ✅ Transaction IDs visible to users
- ✅ NO onclick attributes (iOS/Safari incompatible)

**What STAYS as separate pages:**
- `pt_tracker.html` - Patient exercise tracking
- `pt_view.html` - Dashboard/stats viewing
- `rehab_coverage.html` - Coverage visualization

**What's NEW:**
- `pt_editor.html` - Unified PT editor (replaces pt_report.html)
- `pt/shared/offline_queue.js` - Offline queue manager
- `pt/shared/pt_event_handlers.js` - Centralized event binding
- `pt/shared/legacy_adapter.js` - Adapter for backward compatibility

---

## Data Storage Architecture (from pt_data_api.js)

### Persistence Unit: EXERCISE COMPLETION

**Path:** `users/{userId}/activities/{exerciseId}/completions/{completionULID}`

**ONE ULID per completed exercise** (not per set)

```javascript
{
  timestamp: serverTimestamp(),
  notes: "Felt strong today",              // Exercise-level note
  formParams: {                             // Exercise-level form parameters
    weight: 25,
    band_position: "ankle"
  },
  sets: [                                   // Array of sets (NO ULIDs for sets)
    {
      index: 0,                             // Set number (0-based)
      side: "left",                         // 'left' | 'right' | 'both' | null
      reps: 10,                             // Reps achieved (or null)
      holdSeconds: 3,                       // Hold time (or null)
      timeSeconds: 30,                      // Duration (or null)
      distance: 100,                        // Distance in feet (or null)
      formParams: {                         // Set-specific overrides (optional)
        weight: 27  // e.g., increased weight for this set
      }
    },
    {
      index: 1,
      side: "left",
      reps: 10,
      holdSeconds: 3,
      formParams: null
    }
  ],
  version: 1                                // Schema version
}
```

### Adapter for Legacy Consumers

**Critical Constraint:** pt_tracker, pt_view, rehab_coverage must continue to function without modification during Phase 1-4.

**Legacy session shape (what consumers expect):**
```javascript
{
  sessionId: "01HQXYZ...",                 // ULID (becomes completionULID)
  exerciseId: "ex0001",
  exerciseName: "Single Leg Bridge",
  exerciseType: "reps",
  date: "2026-01-06T14:30:00Z",
  notes: "Felt strong today",
  exerciseSpec: {
    sets: 3,
    repsPerSet: 10,
    secondsPerRep: 0,
    type: "reps"
  },
  sets: [
    {set: 1, reps: 10, timestamp: "...", side: "left", formParams: {...}},
    {set: 2, reps: 10, timestamp: "...", side: "left", formParams: {...}}
  ]
}
```

**Adapter function** (pt/shared/legacy_adapter.js):
```javascript
export function completionToLegacySession(completion, exerciseDefinition) {
  return {
    sessionId: completion.id,
    exerciseId: exerciseDefinition.id,
    exerciseName: exerciseDefinition.canonical_name,
    exerciseType: deriveExerciseType(exerciseDefinition),
    date: completion.timestamp.toISOString(),
    notes: completion.notes || '',
    exerciseSpec: {
      sets: completion.sets.length,
      repsPerSet: avgReps(completion.sets),
      secondsPerRep: 0,
      type: deriveExerciseType(exerciseDefinition)
    },
    sets: completion.sets.map(set => ({
      set: set.index + 1,           // Convert to 1-based
      reps: set.reps || 0,
      timestamp: completion.timestamp.toISOString(),
      side: set.side,
      holdSeconds: set.holdSeconds,
      timeSeconds: set.timeSeconds,
      distance: set.distance,
      formParams: set.formParams || {}
    }))
  };
}
```

---

## Phase 1: Update pt_data_api.js (Days 1-2)

### 1.1 Modify insertExerciseCompletion()

**File:** `pt/shared/pt_data_api.js` (lines 114-157)

**Current signature:**
```javascript
insertExerciseCompletion({
  exerciseId,
  leftSide: {reps, timeSeconds, holdSeconds, distance, formParams},
  rightSide: {...},
  bilateral: {...},
  notes
})
```

**New signature (supports multiple sets):**
```javascript
insertExerciseCompletion({
  exerciseId: "01HQXYZ...",
  notes: "Felt strong",
  formParams: {weight: 25, band_position: "ankle"}, // Exercise-level
  sets: [
    {index: 0, side: 'left', reps: 10, holdSeconds: 3, formParams: {...}},
    {index: 1, side: 'left', reps: 10, holdSeconds: 3, formParams: null},
    {index: 2, side: 'right', reps: 10, holdSeconds: 3, formParams: null}
  ]
})
```

**Implementation:**
```javascript
export async function insertExerciseCompletion(event) {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    if (!event.exerciseId) throw new Error('exerciseId is required');
    if (!event.sets || event.sets.length === 0) {
        throw new Error('At least one set is required');
    }

    const completionULID = generateULID();
    const db = getFirestore();

    const completionData = {
        timestamp: serverTimestamp(),
        notes: event.notes || '',
        formParams: event.formParams || null,
        sets: event.sets.map((set, idx) => ({
            index: set.index ?? idx,
            side: set.side || null,
            reps: set.reps || null,
            holdSeconds: set.holdSeconds || null,
            timeSeconds: set.timeSeconds || null,
            distance: set.distance || null,
            formParams: set.formParams || null
        })),
        version: 1
    };

    const completionRef = doc(
        db,
        'users', userId,
        'activities', event.exerciseId,
        'completions', completionULID
    );

    await withRetry(async () => {
        await setDoc(completionRef, completionData);
    });

    console.log('[API] Exercise completion inserted:', completionULID);

    // Return transaction ID for user display
    return completionULID;
}
```

### 1.2 Add getExerciseDefinition()

For adapter to reconstruct legacy shape, need exercise definitions:

```javascript
export async function getExerciseDefinition(exerciseId) {
    const db = getFirestore();
    const defRef = doc(db, 'exercise_definitions', exerciseId);
    const snapshot = await getDoc(defRef);

    if (!snapshot.exists()) {
        throw new Error(`Exercise definition not found: ${exerciseId}`);
    }

    return {id: snapshot.id, ...snapshot.data()};
}
```

### 1.3 Create legacy_adapter.js

**File:** `pt/shared/legacy_adapter.js` (~150 lines)

```javascript
/**
 * Legacy Adapter - Convert new completion records to legacy session shape
 *
 * Allows pt_tracker, pt_view, rehab_coverage to continue working unchanged
 * while we use new event-sourced storage underneath.
 */

import { getExerciseDefinition } from './pt_data_api.js';

/**
 * Derive exercise type from definition
 */
function deriveExerciseType(def) {
    const modifiers = def.pattern_modifiers || [];
    if (modifiers.includes('duration_seconds')) return 'duration';
    if (modifiers.includes('hold_seconds')) return 'hold';
    if (modifiers.includes('distance_feet')) return 'distance';
    if (modifiers.includes('AMRAP')) return 'amrap';
    return 'reps';
}

/**
 * Calculate average reps across sets
 */
function avgReps(sets) {
    const repsOnly = sets.filter(s => s.reps != null);
    if (repsOnly.length === 0) return 0;
    const total = repsOnly.reduce((sum, s) => sum + s.reps, 0);
    return Math.round(total / repsOnly.length);
}

/**
 * Convert new completion record to legacy session shape
 * @param {object} completion - Completion record from Firestore
 * @param {object} exerciseDefinition - Exercise definition
 * @returns {object} Legacy session object
 */
export async function completionToLegacySession(completion, exerciseDefinition) {
    // If exerciseDefinition not provided, fetch it
    if (!exerciseDefinition) {
        // Extract exerciseId from completion's parent path
        // completions are at: users/{uid}/activities/{exId}/completions/{cId}
        // Need to extract exId somehow - store it on completion?
        throw new Error('exerciseDefinition required - store exerciseId on completion');
    }

    return {
        sessionId: completion.id,
        exerciseId: exerciseDefinition.id,
        exerciseName: exerciseDefinition.canonical_name,
        exerciseType: deriveExerciseType(exerciseDefinition),
        date: completion.timestamp?.toDate?.().toISOString() || completion.timestamp,
        notes: completion.notes || '',
        exerciseSpec: {
            sets: completion.sets.length,
            repsPerSet: avgReps(completion.sets),
            secondsPerRep: 0,
            type: deriveExerciseType(exerciseDefinition)
        },
        sets: completion.sets.map(set => ({
            set: set.index + 1,
            reps: set.reps || 0,
            timestamp: completion.timestamp?.toDate?.().toISOString() || completion.timestamp,
            side: set.side || undefined,
            holdSeconds: set.holdSeconds || undefined,
            secondsAchieved: set.timeSeconds || undefined,
            distanceFeet: set.distance || undefined,
            formParams: set.formParams || undefined
        }))
    };
}

/**
 * Batch convert multiple completions to legacy sessions
 * @param {Array} completions - Array of completion records
 * @param {object} exerciseDefinition - Exercise definition (same for all)
 * @returns {Promise<Array>} Array of legacy session objects
 */
export async function completionsToLegacySessions(completions, exerciseDefinition) {
    return Promise.all(
        completions.map(c => completionToLegacySession(c, exerciseDefinition))
    );
}
```

**IMPORTANT:** Store `exerciseId` on completion document to avoid needing parent path parsing:

Update `insertExerciseCompletion()` to include:
```javascript
const completionData = {
    exerciseId: event.exerciseId,  // ADD THIS
    timestamp: serverTimestamp(),
    // ... rest
};
```

---

## Phase 2: Integrate API in pt_tracker.html (Days 3-5)

### 2.1 Replace saveSessionWithNotes()

**Current:** Lines 4871-4909 (direct addDoc to Firestore)

**New:**
```javascript
import { insertExerciseCompletion } from './shared/pt_data_api.js';
import { showTransactionToast } from './shared/pt_event_handlers.js';

async function saveSessionWithNotes(notes) {
    // Convert currentExercise.sessionData to API format
    const sets = currentExercise.sessionData.map((set, idx) => ({
        index: idx,
        side: set.side || null,
        reps: set.reps || null,
        holdSeconds: set.holdSeconds || null,
        timeSeconds: set.secondsAchieved || null,
        distance: set.distanceFeet || null,
        formParams: set.formParams || null
    }));

    try {
        const completionULID = await insertExerciseCompletion({
            exerciseId: currentExercise.id,
            notes: notes.trim(),
            formParams: null,  // Exercise-level params (if any)
            sets: sets
        });

        // Show transaction ID to user
        showTransactionToast(completionULID);

        // Add to local cache (adapter converts to legacy shape)
        const legacySession = await completionToLegacySession({
            id: completionULID,
            exerciseId: currentExercise.id,
            timestamp: new Date(),
            notes: notes.trim(),
            formParams: null,
            sets: sets,
            version: 1
        }, {
            id: currentExercise.id,
            canonical_name: currentExercise.name,
            pattern_modifiers: currentExercise.patternModifiers || []
        });

        addSessionToCache(legacySession);

        // Reset for new session
        currentExercise.currentSet = 1;
        currentExercise.currentRep = 0;
        currentExercise.sessionData = [];
        seedTimerSeconds();
        stopTimer();
        updateDisplay();
        updateStreakDisplay();

    } catch (error) {
        console.error('[Save] Failed to save exercise completion:', error);
        // Error already shown by API retry logic
    }
}
```

### 2.2 Remove Direct Firestore Calls

**Lines to remove/replace:**
- Line 2488: `addDoc()` in queue flush → Use API
- Line 2241: `setDoc()` for session recovery → Keep for now (localStorage)
- Lines 6142, 7381, 7479, 7499: `updateDoc()` → Evaluate if needed

### 2.3 Add Transaction Toast UI

**Add to pt_tracker.html:**
```html
<!-- Transaction toast (bottom of screen, iOS style) -->
<div id="transaction-toast" style="
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    display: none;
    z-index: 10000;
    max-width: 80%;
    text-align: center;
">
    Saved: <span id="transaction-id"></span>
    <button data-action="copyTransactionId" style="
        margin-left: 10px;
        background: var(--ios-blue);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 8px;
        font-size: 12px;
        cursor: pointer;
    ">Copy</button>
</div>
```

**JavaScript:**
```javascript
function showTransactionToast(txId) {
    const toast = document.getElementById('transaction-toast');
    const idSpan = document.getElementById('transaction-id');
    idSpan.textContent = txId;
    toast.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}

function copyTransactionId() {
    const txId = document.getElementById('transaction-id').textContent;
    navigator.clipboard.writeText(txId).then(() => {
        alert('Transaction ID copied to clipboard');
    });
}
```

---

## Phase 3: Create Unified PT Editor (Days 6-9)

### 3.1 Create pt_editor.html

**File:** `pt/pt_editor.html` (~900 lines)

**Source material:**
- Copy exercise editor from pt_report.html (lines 422-656)
- Copy role management from pt_report.html (lines 658-712)
- Copy vocabulary editor from pt_report.html (lines 744-770)
- Copy dosage editor from pt_report.html (lines 714-742)

**Key features:**
1. **Exercise Library Browser** - Search/filter/select existing exercises
2. **Add/Edit Exercise Form** - All schema fields
3. **Form Parameters Checkboxes** - eyes, surface, band_resistance, band_position, slope, distance, weight, strap_position
4. **Role Assignment UI**
5. **Vocabulary Editor**
6. **Modification Tracking** - Track changes, show summary
7. **Export to Patient** - Email modifications

**iOS Requirements:**
- NO onclick attributes (use data-action + event binding)
- Touch targets ≥ 44px
- Font-size ≥ 16px on inputs (prevent auto-zoom)
- Bottom action sheets for modals
- Haptic feedback on saves
- Transaction ID display after saves

**Structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>PT Editor</title>
    <!-- Styles -->
</head>
<body>
    <!-- Header -->
    <header class="app-header">
        <button data-action="goBack" class="back-btn">← Back to Dashboard</button>
        <h1>PT Editor</h1>
        <button data-action="showModSummary" class="mod-summary-btn">Changes (0)</button>
    </header>

    <!-- Exercise Library Browser -->
    <section id="exercise-library" class="section">
        <h2>Exercise Library</h2>
        <input type="search" id="exercise-search" placeholder="Search exercises...">
        <div id="exercise-list"></div>
        <button data-action="addNewExercise" class="btn-primary">+ Add New Exercise</button>
    </section>

    <!-- Exercise Editor (hidden by default) -->
    <section id="exercise-editor" class="section" style="display: none;">
        <h2 id="editor-title">Add New Exercise</h2>
        <!-- All form fields from schema -->
        <button data-action="saveExercise" class="btn-primary touch-target">Save Exercise</button>
        <button data-action="cancelEdit" class="btn-secondary touch-target">Cancel</button>
    </section>

    <!-- Role Management -->
    <section id="role-manager" class="section">
        <!-- Role assignment UI -->
    </section>

    <!-- Vocabulary Editor -->
    <section id="vocab-editor" class="section">
        <!-- Vocabulary editing UI -->
    </section>

    <!-- Modification Summary Modal -->
    <div id="mod-summary-modal" class="modal">
        <!-- Shows all tracked changes -->
        <button data-action="exportMods" class="btn-primary">Export to Patient</button>
    </div>

    <!-- Transaction Toast -->
    <div id="transaction-toast" class="toast"></div>

    <!-- Scripts -->
    <script type="module">
        import { createExercise, updateExercise, archiveExercise } from './shared/pt_data_api.js';
        import { bindActionHandlers } from './shared/pt_event_handlers.js';

        // Initialize event handlers
        bindActionHandlers(document.body, {
            saveExercise: handleSaveExercise,
            addNewExercise: handleAddNewExercise,
            // ... etc
        });
    </script>
</body>
</html>
```

### 3.2 Create pt_event_handlers.js

**File:** `pt/shared/pt_event_handlers.js` (~300 lines)

**Purpose:** Centralized event binding to eliminate onclick attributes

```javascript
/**
 * PT Event Handlers - Unified event binding for iOS/Safari compatibility
 *
 * NO onclick attributes - use pointerup + keydown pattern
 * All interactive elements get 44px minimum touch targets
 */

/**
 * Bind action handlers to elements with data-action attribute
 * @param {Element} root - Root element to search within
 * @param {object} actionMap - Map of action names to handler functions
 */
export function bindActionHandlers(root, actionMap) {
    const elements = root.querySelectorAll('[data-action]');

    elements.forEach(el => {
        // Prevent double-binding
        if (el.dataset.pointerBound) return;
        el.dataset.pointerBound = 'true';

        const actionName = el.dataset.action;
        const handler = actionMap[actionName];

        if (!handler) {
            console.warn(`No handler for action: ${actionName}`);
            return;
        }

        // Validate touch target size (iOS requirement: 44px minimum)
        validateTouchTarget(el);

        // iOS-safe event binding: pointerup + keydown
        el.addEventListener('pointerup', (e) => {
            e.preventDefault();
            handler(e);
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler(e);
            }
        });
    });
}

/**
 * Validate touch target meets iOS 44px minimum
 */
function validateTouchTarget(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
        console.warn(`Touch target too small (${rect.width}x${rect.height}): ${el.dataset.action}`);
        // Auto-add padding if needed
        el.style.minWidth = '44px';
        el.style.minHeight = '44px';
    }
}

/**
 * Show transaction ID toast (iOS style, bottom of screen)
 */
export function showTransactionToast(txId) {
    const toast = document.getElementById('transaction-toast');
    if (!toast) return;

    toast.innerHTML = `
        Saved: ${txId}
        <button data-action="copyTransactionId" class="copy-btn">Copy</button>
    `;
    toast.classList.add('show');

    // Bind copy action
    const copyBtn = toast.querySelector('[data-action="copyTransactionId"]');
    copyBtn.addEventListener('pointerup', () => {
        navigator.clipboard.writeText(txId).then(() => {
            toast.textContent = 'Copied!';
            setTimeout(() => toast.classList.remove('show'), 1500);
        });
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

/**
 * Long-press handler (for pocket mode, etc.)
 * @param {Element} el - Element to bind to
 * @param {Function} callback - Handler function
 * @param {number} duration - Long press duration in ms (default: 700)
 */
export function bindLongPress(el, callback, duration = 700) {
    let timer = null;

    const startHandler = (e) => {
        timer = setTimeout(() => {
            callback(e);
        }, duration);
    };

    const endHandler = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    el.addEventListener('touchstart', startHandler, { passive: true });
    el.addEventListener('touchend', endHandler, { passive: true });
    el.addEventListener('touchcancel', endHandler, { passive: true });
}

// CSS for touch targets
const styles = `
.touch-target {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.toast {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    max-width: 80%;
    text-align: center;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
}

.toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.copy-btn {
    margin-left: 10px;
    background: var(--ios-blue, #007AFF);
    border: none;
    color: white;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
```

### 3.3 Link from pt_view.html

Add "Edit Exercises" button to pt_view.html navigation:

```html
<button data-action="openEditor" class="btn-primary touch-target">
    Edit Exercises
</button>
```

```javascript
function openEditor() {
    window.location.href = 'pt_editor.html';
}
```

---

## Phase 4: Offline Queue (Days 10-12)

### 4.1 Create offline_queue.js

**File:** `pt/shared/offline_queue.js` (~350 lines)

```javascript
/**
 * Offline Queue Manager
 *
 * Queues API operations in localStorage when offline
 * Replays automatically when connection restored
 *
 * iOS/Safari Notes:
 * - Uses localStorage (not IndexedDB for simplicity)
 * - Handles Safari private mode gracefully
 */

const QUEUE_KEY = 'pt_offline_queue';
const MAX_QUEUE_SIZE = 1000;

/**
 * Check if online
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Get current queue from localStorage
 */
function getQueue() {
    try {
        const queueJson = localStorage.getItem(QUEUE_KEY);
        return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
        console.error('[Offline Queue] Failed to read queue:', error);
        return [];
    }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue) {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('[Offline Queue] Failed to save queue:', error);
        // Safari private mode - alert user
        alert('Unable to save offline changes. Please check browser settings.');
    }
}

/**
 * Add operation to queue
 * @param {string} operation - API function name
 * @param {Array} args - Function arguments
 * @returns {string} Queue item ULID
 */
function enqueue(operation, args) {
    const queue = getQueue();

    if (queue.length >= MAX_QUEUE_SIZE) {
        throw new Error('Offline queue full. Please go online to sync.');
    }

    const queueItem = {
        id: generateQueueULID(),
        operation,
        args,
        timestamp: new Date().toISOString(),
        retries: 0
    };

    queue.push(queueItem);
    saveQueue(queue);

    // Update UI indicator
    updateOfflineIndicator(queue.length);

    console.log('[Offline Queue] Queued:', operation, queueItem.id);
    return queueItem.id;
}

/**
 * Replay all queued operations
 * Called when connection restored
 */
export async function replayQueue(apiModule) {
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`[Offline Queue] Replaying ${queue.length} operations...`);
    updateOfflineIndicator(queue.length, 'syncing');

    const results = { success: 0, failed: 0 };
    const failedOps = [];

    for (const item of queue) {
        try {
            // Call API function with queued arguments
            const fn = apiModule[item.operation];
            if (!fn) {
                throw new Error(`Unknown operation: ${item.operation}`);
            }

            await fn(...item.args);
            results.success++;

        } catch (error) {
            console.error('[Offline Queue] Replay failed:', item, error);
            item.retries++;

            if (item.retries < 3) {
                failedOps.push(item);
            } else {
                results.failed++;
            }
        }
    }

    // Update queue with only failed operations
    saveQueue(failedOps);

    // Notify user
    if (failedOps.length === 0) {
        updateOfflineIndicator(0);
        alert(`✅ Synced ${results.success} changes successfully!`);
    } else {
        updateOfflineIndicator(failedOps.length);
        alert(`⚠️ Synced ${results.success} changes. ${results.failed} failed permanently. ${failedOps.length} will retry.`);
    }
}

/**
 * Wrap API function to automatically queue when offline
 * @param {Function} apiFunction - Original API function
 * @param {string} operationName - Function name for queuing
 * @returns {Function} Wrapped function
 */
export function withOfflineQueue(apiFunction, operationName) {
    return async function(...args) {
        if (isOnline()) {
            // Online - call directly
            return await apiFunction(...args);
        } else {
            // Offline - queue for later
            const queueId = enqueue(operationName, args);
            return { queued: true, queueId, message: 'Queued for sync when online' };
        }
    };
}

/**
 * Update offline indicator UI
 */
function updateOfflineIndicator(queueSize, state = 'offline') {
    const indicator = document.getElementById('offline-indicator');
    if (!indicator) return;

    const countSpan = indicator.querySelector('#queue-count');

    if (queueSize > 0) {
        indicator.style.display = 'block';
        countSpan.textContent = queueSize;

        if (state === 'syncing') {
            indicator.textContent = `🔄 Syncing ${queueSize} changes...`;
            indicator.style.background = 'var(--ios-orange, #FF9500)';
        } else {
            indicator.innerHTML = `📴 Offline - Changes saved locally (Queue: <span id="queue-count">${queueSize}</span>)`;
            indicator.style.background = 'var(--ios-red, #FF3B30)';
        }
    } else {
        indicator.style.display = 'none';
    }
}

/**
 * Generate ULID for queue items
 */
function generateQueueULID() {
    const timestamp = Date.now();
    const timeChars = timestamp.toString(36).toUpperCase().padStart(10, '0');
    const randomPart = Array.from(
        { length: 16 },
        () => Math.floor(Math.random() * 36).toString(36)
    ).join('').toUpperCase();
    return 'QUEUED-' + timeChars + randomPart;
}

// ====== EVENT LISTENERS ======

// Listen for online/offline events
window.addEventListener('online', async () => {
    console.log('[Offline Queue] Connection restored');
    // Auto-replay requires API module - must be provided by app
    // App should call: replayQueue(ptDataAPI)
    window.dispatchEvent(new CustomEvent('offlinequeue:online'));
});

window.addEventListener('offline', () => {
    console.log('[Offline Queue] Connection lost');
    const queue = getQueue();
    updateOfflineIndicator(queue.length);
});

// Initialize on load
window.addEventListener('load', () => {
    const queue = getQueue();
    if (queue.length > 0) {
        updateOfflineIndicator(queue.length);
    }
});
```

### 4.2 Wrap pt_data_api.js Operations

Modify pt_data_api.js to export both wrapped and unwrapped versions:

```javascript
import { withOfflineQueue } from './offline_queue.js';

// Internal implementations
async function insertExerciseCompletionInternal(event) {
    // ... existing implementation
}

// Exported versions (wrapped with offline queue)
export const insertExerciseCompletion = withOfflineQueue(
    insertExerciseCompletionInternal,
    'insertExerciseCompletion'
);

export const createExercise = withOfflineQueue(
    createExerciseInternal,
    'createExercise'
);

// ... etc for all write operations
```

### 4.3 Add Offline Indicator to All Pages

Add to pt_tracker.html, pt_view.html, pt_editor.html, rehab_coverage.html:

```html
<!-- Offline indicator (fixed top) -->
<div id="offline-indicator" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    background: var(--ios-red, #FF3B30);
    color: white;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
">
    📴 Offline - Changes saved locally (Queue: <span id="queue-count">0</span>)
</div>
```

### 4.4 Auto-Replay on Connection

Add to each page's initialization:

```javascript
import * as ptDataAPI from './shared/pt_data_api.js';
import { replayQueue } from './shared/offline_queue.js';

window.addEventListener('offlinequeue:online', async () => {
    await replayQueue(ptDataAPI);
});
```

---

## Phase 5: Migration Execution (Day 13)

### 5.1 Pre-Migration Checklist

**T-7 days:** Notify user via email
**T-1 day:** Deploy code with feature flags OFF, test on staging
**T-0:** Execute migration (2-hour window: 2:00-4:00 AM PST)

### 5.2 Migration Timeline

**2:00 AM:** Enable maintenance banner
**2:10 AM:** Backup Firestore (Firebase Console export)
**2:15 AM:** Run `runFullMigration(userId)` from migrate_to_versioned_schema.js
**2:45 AM:** Run `verifyMigration()` - check all collections
**3:00 AM:** Deploy new code
**3:15 AM:** Smoke test (create exercise, complete exercise, offline queue)
**3:30 AM:** Disable maintenance banner
**4:00 AM:** Complete, monitor metrics

### 5.3 Rollback Strategy

**If migration fails:**
- Keep maintenance banner active
- Old data intact (never deleted)
- Revert code deployment
- Restore from Firestore backup if needed
- Schedule new window after root cause analysis

---

## Phase 6: Testing (Days 14-16)

### 6.1 iOS/Safari Testing Checklist

**iPhone SE (320px):**
- [ ] No horizontal scroll
- [ ] All buttons ≥ 44px
- [ ] Form inputs ≥ 16px font (no auto-zoom)
- [ ] Haptic feedback works
- [ ] Transaction toasts appear correctly
- [ ] Offline indicator shows/hides
- [ ] No onclick attributes remain

**iPad (768px):**
- [ ] Responsive layout adapts
- [ ] Touch targets still ≥ 44px
- [ ] Multi-column layouts work

**MacBook (1024px+):**
- [ ] Desktop layout works
- [ ] Keyboard navigation functional
- [ ] Hover states show

### 6.2 Functional Testing

**Exercise Completion Flow (pt_tracker):**
1. Complete exercise with 3 sets
2. Verify transaction ID toast appears
3. Check Firestore: completions/{ULID} has 3 sets in array
4. Verify pt_view dashboard shows completion

**Offline Queue Flow:**
1. Disconnect network
2. Complete exercise in pt_tracker
3. Verify offline indicator shows "Queue: 1"
4. Verify toast shows "QUEUED-{ulid}"
5. Reconnect network
6. Verify indicator disappears
7. Check Firestore for completion

**PT Editor Flow:**
1. Open pt_editor.html from pt_view
2. Add new exercise with form parameters
3. Verify transaction ID appears
4. Check Firestore: exercise_definitions/{ULID}

### 6.3 Regression Testing

- [ ] pt_tracker pocket mode long-press (700ms)
- [ ] Session recovery every 5s
- [ ] pt_view dashboard statistics
- [ ] rehab_coverage heatmap rendering
- [ ] Service worker offline caching
- [ ] PWA install on iOS

---

## Critical Files Summary

### Phase 1: API Updates
- `pt/shared/pt_data_api.js` - Update insertExerciseCompletion(), add getExerciseDefinition()
- `pt/shared/legacy_adapter.js` - NEW: Adapter for backward compatibility

### Phase 2: pt_tracker Integration
- `pt/pt_tracker.html` - Replace saveSessionWithNotes() (line 4871), remove direct Firestore calls

### Phase 3: Unified Editor
- `pt/pt_editor.html` - NEW: Unified PT editor (~900 lines)
- `pt/shared/pt_event_handlers.js` - NEW: Event binding module (~300 lines)
- `pt/pt_view.html` - Add link to pt_editor.html

### Phase 4: Offline Queue
- `pt/shared/offline_queue.js` - NEW: Offline queue manager (~350 lines)
- All pages: Add offline indicator, auto-replay listener

### Phase 5: Migration
- `pt/shared/migrate_to_versioned_schema.js` - Execute during downtime (already exists)

### Phase 6: Testing
- Manual testing on iPhone SE, iPad, MacBook
- Automated tests (if time permits)

---

## Success Criteria

✅ **Functional:**
- All saves go through pt_data_api.js (NO direct Firestore calls)
- Exercise completions stored as append-only events
- Transaction IDs visible to users
- Offline queue works (queue + replay)
- Migration completes without data loss
- Legacy consumers (pt_tracker, pt_view, rehab_coverage) continue working

✅ **Technical:**
- NO onclick attributes (all use pointerup + keydown)
- Touch targets ≥ 44px on iOS
- Form inputs ≥ 16px font (no auto-zoom)
- Code fully commented (JSDoc + inline)
- Adapter maintains backward compatibility

✅ **Performance:**
- Exercise save < 1s
- Offline queue replay < 5s (10 operations)
- Page load < 3s on 3G

---

## Implementation Notes

1. **Store exerciseId on completion:** Required for adapter to fetch exercise definitions
2. **Sets as array:** Easier than subcollection, single document read
3. **Transaction ID format:** ULID for completions, "QUEUED-{ULID}" for queued operations
4. **Form parameters:** Exercise-level (on completion) + set-level (in sets array)
5. **Adapter pattern:** Allows gradual migration, consumers unchanged during Phases 1-4

---

**Ready to implement! 🚀**
