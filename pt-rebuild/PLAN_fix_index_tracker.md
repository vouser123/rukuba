# Plan: Fix index.html PT Tracker

## Current State (Broken)
1. ❌ No rep counter - each tap creates a new set instead of counting reps within a set
2. ❌ No sound/haptic feedback
3. ❌ Not loading dosages from `/api/programs` - uses `/api/exercises` (no patient-specific prescriptions)
4. ❌ No way to edit dosages
5. ❌ iOS zoom on input focus (font-size too small)
6. ❌ Sync error fixed (activity_type) but fundamental logging is wrong

## Target State (Based on Old Firebase App Analysis)

### 1. Rep Counting Within Sets

**Current behavior:**
- User taps "Log Set" → creates a set immediately
- Each tap = new set (wrong)

**Target behavior:**
- Large counter display showing current rep count (starts at 0)
- User taps counter → increments rep (haptic feedback)
- Display shows "Rep X of Y" (e.g., "Rep 5 of 10")
- When reps >= target:
  - Play completion sound (triple beep: 1000Hz, 1200Hz, 1400Hz)
  - Haptic success pattern (vibrate [30, 50, 30])
  - Voice announcement "Set complete"
  - Auto-advance to next set OR show "Log Set" button

**Data structure:**
```javascript
currentExercise = {
    ...exercise,
    currentSet: 1,      // Current set number
    currentRep: 0,      // Current rep within set
    sessionData: []     // Completed sets
}
```

**UI changes needed:**
- Replace current "Log Set" button with large tappable counter display
- Show "Set X of Y" above counter
- Show "Rep X of Y" for hold exercises
- Add voice announcements (Web Speech API)

### 2. Exercise Type Handling

**Types (from old app):**
- `'reps'` - Count reps only (default)
- `'hold'` - Count reps × hold seconds per rep
- `'duration'` - Just time, no reps (stores reps: 1)
- `'distance'` - Distance in feet (stores reps: 1)

**Pattern Modifiers:**
- `duration_seconds` → REPLACES reps entirely, type='duration'
- `distance_feet` → REPLACES reps entirely, type='distance'
- `hold_seconds` → MODIFIES reps (reps × Xs hold), type='hold'

**Type determination (in selectExercise):**
```javascript
const modifiers = exercise.pattern_modifiers || [];
const type = modifiers.includes('distance_feet') ? 'distance'
    : modifiers.includes('duration_seconds') ? 'duration'
    : modifiers.includes('hold_seconds') ? 'hold'
    : 'reps';
```

**UI modes:**

**Counter Mode** (reps, distance):
- Large counter showing current value
- Tap to increment
- Target shown below

**Timer Mode** (hold, duration):
- Countdown timer display
- Start/pause/reset buttons
- For hold: Shows "Rep X of Y" + timer
- For duration: Shows total time only

### 3. Sound & Haptic Feedback

**Web Audio API setup:**
```javascript
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(frequency = 800, duration = 200) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

function playCompletionSound() {
    playBeep(1000, 150);
    setTimeout(() => playBeep(1200, 150), 200);
    setTimeout(() => playBeep(1400, 200), 400);
}
```

**Haptic feedback:**
```javascript
function haptic(style = 'light') {
    if (!preferences.hapticEnabled) return;
    if ('vibrate' in navigator) {
        switch(style) {
            case 'light':   navigator.vibrate(30); break;
            case 'medium':  navigator.vibrate(50); break;
            case 'heavy':   navigator.vibrate(80); break;
            case 'success': navigator.vibrate([30, 50, 30]); break;
            case 'error':   navigator.vibrate([50, 100, 50]); break;
        }
    }
}
```

**When to trigger:**
- Rep increment: `haptic('medium')` + optional beep
- Set complete: `playCompletionSound()` + `haptic('success')` + speak("Set complete")
- Timer start: `playBeep(400, 100)` + `haptic('heavy')`
- Timer pause: `playBeep(300, 100)` + `haptic('heavy')`
- Log set: `haptic('success')`

**Settings:**
- Add checkbox: `<input type="checkbox" id="haptic-toggle" checked>` in hamburger menu
- Store in localStorage preferences

### 4. Load Dosages from /api/programs

**Current:**
```javascript
// Line ~1042: Loads from /api/exercises (no dosages)
const response = await fetchWithAuth('/api/exercises');
allExercises = response.exercises || [];
```

**Target:**
```javascript
// Load patient programs with dosages
const programsResponse = await fetchWithAuth(`/api/programs?patient_id=${currentUser.id}`);
const programs = programsResponse.programs || [];

// Also load exercise library for non-assigned exercises
const exercisesResponse = await fetchWithAuth('/api/exercises');
const library = exercisesResponse.exercises || [];

// Merge: programs take precedence, add dosage fields
allExercises = programs.map(prog => ({
    ...prog.exercises,  // Exercise definition from join
    // Dosage from patient_programs:
    current_sets: prog.sets,
    current_reps: prog.reps_per_set,
    current_seconds: prog.seconds_per_rep || prog.seconds_per_set,
    current_distance: prog.distance_feet,
    dosage_type: prog.dosage_type,  // 'reps', 'hold', 'duration', 'distance'
    is_favorite: prog.is_favorite,
    program_id: prog.id  // For updating dosage
}));

// Add library exercises not in program (for browsing)
const programExerciseIds = new Set(programs.map(p => p.exercise_id));
library.forEach(ex => {
    if (!programExerciseIds.has(ex.id)) {
        allExercises.push({
            ...ex,
            current_sets: 0,  // Not assigned
            current_reps: 0
        });
    }
});
```

**Display dosage:**
```javascript
function formatDosage(exercise) {
    if (!exercise.current_sets) return 'Not assigned';

    const sets = exercise.current_sets;
    const reps = exercise.current_reps;
    const seconds = exercise.current_seconds;
    const distance = exercise.current_distance;
    const modifiers = exercise.pattern_modifiers || [];

    if (modifiers.includes('distance_feet') && distance) {
        return `${distance} feet`;
    } else if (modifiers.includes('duration_seconds') && seconds) {
        return `${sets} × ${seconds} sec`;
    } else if (modifiers.includes('hold_seconds') && seconds && reps) {
        return `${sets} × ${reps} reps (${seconds}s hold)`;
    } else {
        return `${sets} × ${reps} reps`;
    }
}
```

### 5. Edit Dosages UI

**Add "Edit Dosage" button in logger view:**
```html
<button class="btn-secondary" data-action="edit-dosage">📝 Edit Dosage</button>
```

**Dosage Edit Modal:**
```html
<div id="dosageModal" class="modal hidden">
    <div class="modal-content">
        <h2>Edit Dosage: <span id="dosage-exercise-name"></span></h2>

        <div class="form-group">
            <label>Sets</label>
            <input type="number" id="dosage-sets" min="1"
                   style="font-size: 20px; text-align: center;">
        </div>

        <div class="form-group" id="dosage-reps-group">
            <label>Reps per Set</label>
            <input type="number" id="dosage-reps" min="1"
                   style="font-size: 20px; text-align: center;">
        </div>

        <div class="form-group hidden" id="dosage-seconds-group">
            <label id="dosage-seconds-label">Seconds</label>
            <input type="number" id="dosage-seconds" min="1"
                   style="font-size: 20px; text-align: center;">
        </div>

        <div class="form-group hidden" id="dosage-distance-group">
            <label>Distance (feet)</label>
            <input type="number" id="dosage-distance" min="1"
                   style="font-size: 20px; text-align: center;">
        </div>

        <div class="modal-actions">
            <button class="btn-secondary" data-action="close-dosage-modal">Cancel</button>
            <button class="btn" data-action="save-dosage">Save Dosage</button>
        </div>
    </div>
</div>
```

**Show/hide fields based on pattern modifiers:**
```javascript
function openDosageModal() {
    const modifiers = currentExercise.pattern_modifiers || [];

    // Show sets (always)
    document.getElementById('dosage-sets').value = currentExercise.current_sets || 3;

    // Show/hide based on modifiers
    const hasDistance = modifiers.includes('distance_feet');
    const hasDuration = modifiers.includes('duration_seconds');
    const hasHold = modifiers.includes('hold_seconds');

    // Reps (hide for distance/duration)
    const repsGroup = document.getElementById('dosage-reps-group');
    if (hasDistance || hasDuration) {
        repsGroup.classList.add('hidden');
    } else {
        repsGroup.classList.remove('hidden');
        document.getElementById('dosage-reps').value = currentExercise.current_reps || 10;
    }

    // Seconds (show for hold/duration)
    const secondsGroup = document.getElementById('dosage-seconds-group');
    if (hasHold || hasDuration) {
        secondsGroup.classList.remove('hidden');
        const label = hasHold ? 'Seconds per Rep' : 'Seconds Total';
        document.getElementById('dosage-seconds-label').textContent = label;
        document.getElementById('dosage-seconds').value = currentExercise.current_seconds || 30;
    } else {
        secondsGroup.classList.add('hidden');
    }

    // Distance (show for distance)
    const distanceGroup = document.getElementById('dosage-distance-group');
    if (hasDistance) {
        distanceGroup.classList.remove('hidden');
        document.getElementById('dosage-distance').value = currentExercise.current_distance || 100;
    } else {
        distanceGroup.classList.add('hidden');
    }

    document.getElementById('dosageModal').classList.remove('hidden');
}
```

**Save dosage (update patient_programs):**
```javascript
async function saveDosage() {
    const sets = parseInt(document.getElementById('dosage-sets').value);
    const reps = parseInt(document.getElementById('dosage-reps').value) || null;
    const seconds = parseInt(document.getElementById('dosage-seconds').value) || null;
    const distance = parseInt(document.getElementById('dosage-distance').value) || null;

    const modifiers = currentExercise.pattern_modifiers || [];
    const dosageType = modifiers.includes('distance_feet') ? 'distance'
        : modifiers.includes('duration_seconds') ? 'duration'
        : modifiers.includes('hold_seconds') ? 'hold'
        : 'reps';

    const payload = {
        sets,
        reps_per_set: reps,
        seconds_per_rep: (dosageType === 'hold') ? seconds : null,
        seconds_per_set: (dosageType === 'duration') ? seconds : null,
        distance_feet: distance,
        dosage_type: dosageType
    };

    try {
        // Update or create patient program
        if (currentExercise.program_id) {
            // Update existing
            await fetchWithAuth(`/api/programs/${currentExercise.program_id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Create new program assignment
            await fetchWithAuth('/api/programs', {
                method: 'POST',
                body: JSON.stringify({
                    patient_id: currentUser.id,
                    exercise_id: currentExercise.id,
                    ...payload
                })
            });
        }

        // Update local exercise object
        currentExercise.current_sets = sets;
        currentExercise.current_reps = reps;
        currentExercise.current_seconds = seconds;
        currentExercise.current_distance = distance;

        // Refresh dosage display
        document.getElementById('loggerDosage').textContent = formatDosage(currentExercise);

        closeDosageModal();
        showToast('Dosage updated', 'success');

    } catch (error) {
        showToast(`Failed to save dosage: ${error.message}`, 'error');
    }
}
```

### 6. Fix iOS Zoom

**Viewport (already correct):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**Input font sizes (fix):**
```css
/* All inputs must be ≥ 16px to prevent iOS auto-zoom */
input, select, textarea {
    font-size: 17px;  /* 1px above minimum for safety */
    -webkit-appearance: none;
    -webkit-tap-highlight-color: transparent;
}

/* Dosage modal inputs even larger for readability */
.modal-input {
    font-size: 20px;
    text-align: center;
    font-weight: 600;
}
```

**Update all existing inputs to use these classes.**

### 7. Data Structure Corrections (Schema-Compliant)

**Populate fields based on activity_type** (per schema comments):

```javascript
// When logging a set:
const setData = {
    set_number: currentExercise.currentSet,
    reps: null,  // Set based on activity_type below
    seconds: null,  // Set based on activity_type below
    distance_feet: null,  // Set based on activity_type below
    side: currentSide,
    form_data: formData.length > 0 ? formData : null,
    manual_log: false,
    partial_rep: false,
    performed_at: new Date().toISOString()
};

// Populate fields based on activity_type (from schema.sql comments):
// - reps: Actual reps achieved (NULL if activity_type is duration or distance)
// - seconds: Actual seconds achieved (NULL unless activity_type is hold or duration)
// - distance_feet: Actual distance achieved in feet (NULL unless activity_type is distance)

const activityType = currentSession.activityType; // 'reps', 'hold', 'duration', 'distance'

if (activityType === 'reps') {
    setData.reps = currentExercise.currentRep;
    // seconds and distance_feet remain null
}
else if (activityType === 'hold') {
    setData.reps = currentExercise.currentRep;  // Number of holds performed
    setData.seconds = currentExercise.currentSeconds;  // Seconds per hold
    // distance_feet remains null
}
else if (activityType === 'duration') {
    // reps remains null (no rep counting for duration)
    setData.seconds = currentExercise.currentSeconds;  // Total time achieved
    // distance_feet remains null
}
else if (activityType === 'distance') {
    // reps remains null (no rep counting for distance)
    setData.distance_feet = currentExercise.currentDistance;  // Feet traveled
    // seconds remains null
}
```

**This matches the actual schema requirements - no more Firebase "reps=1" workarounds.**

## Implementation Steps

### Phase 1: Core Rep Counter (Highest Priority)
1. Add `currentSet`, `currentRep` to exercise state when session starts
2. Replace "Log Set" button with large counter display
3. Add tap handler to increment `currentRep`
4. Show "Set X of Y" and "Rep X of Y" labels
5. Auto-complete set when `currentRep >= current_reps`
6. Reset `currentRep = 0` when advancing to next set
7. Only create set data object when set is complete

### Phase 2: Sound & Haptics
1. Initialize Web Audio API context
2. Implement `playBeep(frequency, duration)`
3. Implement `playCompletionSound()` (triple beep)
4. Implement `haptic(style)` using Vibration API
5. Add triggers: rep tap (medium), set complete (success + sound)
6. Add haptic toggle to settings (localStorage)

### Phase 3: Load Dosages from /api/programs
1. Change initial load to call `/api/programs?patient_id=X`
2. Merge programs with exercise library
3. Extract dosage fields: `current_sets`, `current_reps`, `current_seconds`, `current_distance`
4. Update `formatDosage()` to use these fields
5. Store `program_id` for updates

### Phase 4: Edit Dosage UI
1. Add "Edit Dosage" button in logger view
2. Create dosage modal HTML
3. Implement `openDosageModal()` with show/hide logic
4. Implement `saveDosage()` to PUT/POST to /api/programs
5. Update local exercise state after save
6. Refresh dosage display

### Phase 5: Fix iOS Zoom
1. Set all input font-sizes to ≥17px
2. Add `-webkit-appearance: none` to all inputs
3. Add `.modal-input` class with 20px font-size
4. Test on actual iOS device

### Phase 6: Timer Mode (Hold/Duration)
1. Add timer state: `isRunning`, `elapsedMs`, `startTime`
2. Create timer display UI (countdown)
3. Add start/pause/reset buttons
4. Update timer display every 100ms when running
5. Auto-complete rep/set when time reached
6. Store `seconds` in set data

## API Changes Needed

### /api/programs needs PUT/POST endpoints
Currently only has GET. Need:

**POST /api/programs** - Create new program assignment
```javascript
Body: {
    patient_id, exercise_id,
    dosage_type, sets, reps_per_set, seconds_per_rep, seconds_per_set, distance_feet
}
```

**PUT /api/programs/:id** - Update existing program
```javascript
Body: {
    sets?, reps_per_set?, seconds_per_rep?, seconds_per_set?, distance_feet?
}
```

## Testing Checklist

- [ ] Reps exercise: Counter increments, set completes at target
- [ ] Hold exercise: Timer counts down, rep completes, advances to next rep
- [ ] Duration exercise: Timer counts down, set completes (1 rep)
- [ ] Distance exercise: Counter increments feet
- [ ] Sound plays on set complete
- [ ] Haptic feedback on tap
- [ ] Haptic toggle works
- [ ] Dosage displays correctly for each type
- [ ] Edit dosage modal shows/hides correct fields
- [ ] Save dosage updates patient_programs
- [ ] Dosage display updates after save
- [ ] iOS: No zoom on input focus
- [ ] Sync succeeds with correct activity_type
- [ ] Set data has reps always populated

## Success Criteria

✓ User can count reps by tapping counter
✓ Set auto-completes when reps reached
✓ Sound/haptic feedback works
✓ Dosages load from patient_programs
✓ Dosages can be edited per exercise
✓ No iOS zoom on inputs
✓ Sync works without errors
✓ Data model matches schema requirements (reps always present)
