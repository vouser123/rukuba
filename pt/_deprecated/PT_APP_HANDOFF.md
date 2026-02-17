# Physical Therapy Tracking App - Project Handoff

## Context

This is a handoff for building a PT (Physical Therapy) tracking PWA. We've already built a successful iOS-native packing list app (`claude.html`) that established design patterns and interaction paradigms we want to reuse.

**Repository:** vouser123/rukuba
**Working Branch:** `claude/enable-page-code-writing-MNryw`
**PT Documentation Branch:** `revert-5-Claude`

---

## What We've Already Built

### Packing List App (claude.html)
A fully functional iOS-native PWA with:
- **iOS Action Sheets** - Native-style confirmation dialogs
- **iOS Bottom Sheet Modals** - Slides up from bottom for forms
- **Swipe Gestures** - Swipe left with visual feedback (red trash icon)
- **Long-press Actions** - Edit items (500ms), delete sections (800ms)
- **Drag & Drop Reordering** - Drag handle (☰) for desktop/mobile
- **Archive Pattern** - "Archive Done" moves items instead of deleting
- **Haptic Feedback** - Throughout (light, medium, success, error)
- **PWA Ready** - manifest.json, home screen installation
- **iOS Color Scheme** - #007AFF (blue), #FF3B30 (red), #34C759 (green)
- **Auto-save** - All changes persist to localStorage instantly

**Reference:** See `/home/user/rukuba/claude.html` for full implementation

---

## PT Tracking Requirements

### Pain Points from Old System
The user has an old PT tracking system (`atlas_pt_min_250817.json` in `revert-5-Claude` branch) with these issues:

1. **Outdated data** - Exercise library and condition tracking are very old
2. **No cause linking** - Can't link functional events to suspected causes
3. **Tedious JSON editing** - User had to manually edit JSON which was painful
4. **Incomplete features** - Condition tracking was never fully built out
5. **Missing modern approach** - Should use functional events instead

**User quote:** "It's very out of date. The condition tracking was never really built out. It should be functional events or something. There's a lot missing. I think initially the goal would be the basic exercises and tracking."

### What We Need to Build

**Phase 1 - Core Exercise Tracking:**
- **Tap counter** for rep-based exercises (big tap target, haptic feedback each tap)
- **Countdown timer** for timed holds (visual/audio cues)
- **Session logging** - Track sets, reps, date, notes per exercise
- **Simple exercise selection** - Search + favorites
- **GUI-based editing** - NO JSON! All through iOS modals

**Phase 2 - Functional Events:**
- **Event logging** - Pain, breakthrough, mobility, sensation, fatigue
- **Cause linking** - Link events to exercises, activities, suspected triggers
- **Severity tracking** - 0-10 scale with visual slider
- **Timeline view** - See events chronologically

**Phase 3 - Exercise Library Management:**
- **Add/edit exercises** through iOS bottom sheets (not JSON!)
- **AI-assisted data entry** - User enters exercise name, Claude/GPT suggests muscles, tips, modifications
- **Tag system** - Body part, equipment, difficulty
- **Archive old exercises** - Keep library clean

---

## Existing PT Documentation

The user has created comprehensive PT tracking documentation (in `revert-5-Claude` branch):

### 1. atlas_pt_min_250817.json
**100+ exercises with structure:**
```json
{
  "exercise_id": "ex_step_ups_01",
  "name": "Step Ups",
  "dosage": "S3x10 (side)",
  "primary_muscles": ["gluteus_medius", "quadriceps"],
  "anatomic_regions": ["hip", "knee"],
  "execution_tips": "Keep knee aligned over toes...",
  "modifiers": {
    "band_resistance": ["light", "medium", "heavy"],
    "surface": ["floor", "step", "unstable"]
  },
  "supersedes": ["ex_basic_squats_01"]
}
```

**Dosage patterns:**
- `S3x10` = 3 sets × 10 reps
- `S2x10 (both); hold_seconds: 5` = 2 sets × 10 reps each side, 5 second hold
- `AMRAP` = As many reps as possible

**Note:** This JSON is outdated. Don't import it wholesale - use as reference only.

### 2. ATLAS functional events logging.txt
**Directive for logging clinical functional events.**

**Event Classifications:**
- `flare` - Pain/symptom increase
- `breakthrough` - Positive improvement
- `regression` - Loss of function
- `observation` - Notable change
- `stable` - Maintaining status

**Event Nature:**
- `pain`, `function`, `mobility`, `sensation`, `fatigue`

**Required Fields:**
- `event_id` (format: `FE_YYYY-MM-DD__NNN`)
- `timestamp` (ISO 8601)
- `description`
- `event_class`
- `event_nature`
- `location` (body part)

**Optional Fields:**
- `possible_triggers` - Array of suspected causes
- `linked_conditions` - Condition IDs
- `severity` (0-10)
- `notes`
- `linked_entities` - Object with `exercises[]`, `activities[]`, etc.

**Example:**
```json
{
  "event_id": "FE_2025-07-25__001",
  "timestamp": "2025-07-25T10:42:00-04:00",
  "description": "Climbed two flights of stairs without any knee pain.",
  "event_class": "breakthrough",
  "event_nature": "function",
  "location": "right knee",
  "possible_triggers": ["stairs", "activity"],
  "linked_conditions": ["cond_pf_maltracking_oa"],
  "severity": 0,
  "notes": "Felt strong on the second flight.",
  "linked_entities": {
    "exercises": ["ex_step_ups_01"]
  }
}
```

### 3. ATLAS functional_event schema.json
**JSON schema for validation.**
- Enforces `FE_YYYY-MM-DD__NNN` format for event_id
- ISO 8601 timestamp requirement
- Enum validation for event_class and event_nature
- Strict schema (additionalProperties: false)

### 4. ATLAS_logging_rulebook.txt
**Rules for session logging structure.**

**Required Structure:**
```
exercise_id → sessions[] → session_date + sets[]
```

**Set Requirements:**
- `reps` (integer, required)
- Optional: `side`, `hold_time`, `duration_time`, `modifiers`

**Prohibited:**
- Top-level notes ❌
- Deprecated `duration_sec` ❌
- String reps (must be integer) ❌
- Empty sets[] ❌

**Example:**
```json
{
  "exercise_id": "ex_step_ups_01",
  "sessions": [
    {
      "session_date": "2025-01-15",
      "sets": [
        {"side": "left", "reps": 10},
        {"side": "right", "reps": 10},
        {"side": "left", "reps": 8}
      ]
    }
  ]
}
```

---

## Technical Patterns to Reuse

### iOS Color Scheme
```css
--ios-blue: #007AFF;
--ios-red: #FF3B30;
--ios-green: #34C759;
--ios-orange: #FF9500;
--ios-gray: #8E8E93;
--ios-background: #F2F2F7;
```

### Haptic Feedback Pattern
```javascript
function haptic(type) {
    if ('vibrate' in navigator) {
        switch(type) {
            case 'light': navigator.vibrate(10); break;
            case 'medium': navigator.vibrate(20); break;
            case 'success': navigator.vibrate([10, 50, 10]); break;
            case 'error': navigator.vibrate([20, 100, 20]); break;
        }
    }
}
```

### iOS Action Sheet Pattern
```javascript
function showActionSheet(message, onConfirm) {
    // Shows iOS-style confirmation from bottom
    // backdrop blur, destructive red button, blue cancel
}
```

### iOS Bottom Sheet Modal Pattern
```javascript
function showModal(title, fields) {
    // Slides up from bottom
    // Drag handle at top
    // iOS-style inputs with focus states
}
```

### Archive Pattern (Safe Deletion)
```javascript
// Don't delete - move to archive section
function archiveItem(item) {
    item.originalSection = currentSection;
    item.originalSubsection = currentSubsection;
    moveToSection(item, '✅ Completed Items', 'Archived');
}
```

### localStorage Persistence
```javascript
const STORAGE_KEY = 'pt_data';
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

---

## Key User Requirements

### 1. Counter/Timer Feature (HIGH PRIORITY)
**User quote:** "I'd love to have a counter I could tap and a timer or something that would countdown timed exercises and keep track of how many were done."

**Requirements:**
- Big tap target for counter (whole screen ideally)
- Visual countdown for timed holds
- Haptic feedback on each rep tap
- Audio cue when timer completes
- Auto-advance to next set
- Track completion in session logs

**Example UI:**
```
┌─────────────────────────────┐
│   Goblet Squat - Set 1/3    │
│                              │
│         [  12  ]             │  ← Big counter (tap anywhere)
│                              │
│    Progress: ████░░░░ 12/15  │
│                              │
│  [Previous Set] [Next Set]   │
└─────────────────────────────┘
```

For timed exercises:
```
┌─────────────────────────────┐
│   Plank Hold - Set 1/3       │
│                              │
│          00:23               │  ← Countdown timer
│                              │
│    Target: 30s               │
│    ████████████░░░░          │
│                              │
│  [Stop] [Complete Set]       │
└─────────────────────────────┘
```

### 2. Exercise Data Population
**User quote:** "I need a way to get all that data in there for multiple exercises. And I'll need gpt or Claude to do some of the initial answers on muscles, modifications/how to do/where to feel, not feel, etc."

**Proposed Workflow:**
1. User enters exercise name + dosage (e.g., "Goblet Squat S3x10")
2. Claude/GPT suggests:
   - Primary/secondary muscles
   - Anatomic regions
   - Execution tips ("where to feel, not feel")
   - Common modifications
   - Equipment options
3. User reviews suggestions in iOS modal
4. User edits/approves
5. Saves to localStorage (NO JSON editing!)

### 3. GUI-Based Management
**User quote:** "I don't know how I'd update it; gpt always gave me a json. It was really tedious."

**Requirements:**
- All CRUD operations through iOS modals
- No JSON editing
- Swipe to archive old exercises
- Long-press to edit
- Search and filter
- Tag-based organization

---

## Data Structure Recommendations

### Exercise Object
```javascript
{
  id: "ex_goblet_squat_01",
  name: "Goblet Squat",
  dosage: "S3x10",
  primaryMuscles: ["quadriceps", "gluteus_maximus"],
  anatomicRegions: ["knee", "hip"],
  executionTips: "Keep chest up, knees track over toes...",
  cues: {
    shouldFeel: ["quads", "glutes"],
    shouldNotFeel: ["lower back", "knees"]
  },
  modifiers: {
    weight: ["bodyweight", "light", "moderate", "heavy"],
    surface: ["floor", "unstable"]
  },
  tags: ["lower_body", "compound", "beginner"],
  archived: false,
  createdDate: "2025-01-15",
  lastUsed: "2025-01-20"
}
```

### Session Log Object
```javascript
{
  sessionId: "session_2025-01-20__001",
  date: "2025-01-20",
  exercises: [
    {
      exerciseId: "ex_goblet_squat_01",
      sets: [
        { setNum: 1, reps: 12, weight: "light", completed: true },
        { setNum: 2, reps: 10, weight: "light", completed: true },
        { setNum: 3, reps: 8, weight: "light", completed: true }
      ]
    }
  ],
  notes: "Felt strong today. Increased reps on set 1.",
  duration: 1800, // seconds
  completedAt: "2025-01-20T10:30:00Z"
}
```

### Functional Event Object
```javascript
{
  eventId: "FE_2025-01-20__001",
  timestamp: "2025-01-20T10:45:00-05:00",
  description: "Sharp pain in right knee during stairs",
  eventClass: "flare",
  eventNature: "pain",
  location: "right knee",
  severity: 6,
  possibleTriggers: ["stairs", "cold weather"],
  linkedExercises: ["ex_step_ups_01"],
  notes: "Same pain as last week"
}
```

---

## Implementation Phases

### Phase 1: Core Exercise Tracker (START HERE)
**Goal:** Simple counter/timer app for a single exercise

**Tasks:**
1. Create new HTML file (e.g., `pt_tracker.html`)
2. Implement tap counter with big target area
3. Add countdown timer for holds
4. Save session to localStorage
5. Use iOS patterns from packing list
6. Haptic + audio feedback

**Success Criteria:**
- User can track reps by tapping screen
- User can run countdown timer for holds
- Session data saves automatically
- Feels like native iOS app

### Phase 2: Exercise Library
**Tasks:**
1. Add exercise selection modal
2. Build AI-assisted exercise creator
3. Implement search/filter
4. Add favorites
5. Archive old exercises

### Phase 3: Functional Events
**Tasks:**
1. Create event logging modal
2. Link events to exercises
3. Build timeline view
4. Add severity slider
5. Tag suspected causes

### Phase 4: Analytics & Insights
**Tasks:**
1. Progress charts
2. Streak tracking
3. Pattern recognition (which exercises trigger which events)
4. Export to JSON for clinician review

---

## Next Steps

1. **Start new conversation** with this handoff document
2. **Begin with Phase 1** - Build simple counter/timer for one exercise
3. **Iterate quickly** - Get user feedback on UX
4. **Add AI assistance** for populating exercise data
5. **Expand incrementally** - Add features based on user feedback

---

## Files to Reference

**In current branch (`claude/enable-page-code-writing-MNryw`):**
- `/home/user/rukuba/claude.html` - Packing list with all iOS patterns
- `/home/user/rukuba/manifest.json` - PWA manifest

**In PT docs branch (`revert-5-Claude`):**
- `/home/user/rukuba/atlas_pt_min_250817.json` - Old exercise library (reference only)
- `/home/user/rukuba/ATLAS functional events logging.txt` - Event logging directive
- `/home/user/rukuba/ATLAS functional_event schema.json` - Event validation schema
- `/home/user/rukuba/ATLAS_logging_rulebook.txt` - Session logging rules

---

## Important Notes

1. **Don't import old JSON** - It's outdated. Use as reference for structure only.
2. **Focus on UX first** - Counter/timer is highest priority.
3. **GUI over JSON** - User should never edit JSON manually.
4. **Reuse iOS patterns** - All interaction patterns from packing list app.
5. **AI-assisted data entry** - Let Claude/GPT suggest exercise details.
6. **Archive, don't delete** - Keep data safe like packing list does.
7. **Mobile-first** - User will primarily use on iPhone.
8. **Offline-capable** - localStorage + future service worker.

---

## Contact & Context

**User:** vouser123 (Maisie)
**Use Case:** Personal PT tracking for chronic pain management
**Device:** Primarily iPhone
**Technical Comfort:** Comfortable with GitHub, prefers GUI over JSON editing

**Previous Successful Pattern:** We built the packing list app together and it works great. User wants the same level of polish and iOS-native feel for PT tracking.

---

*Last Updated: 2025-12-15*
*Handoff prepared for new conversation to build PT tracking PWA*
