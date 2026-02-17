# PT App Status - 2026-01-06

## ✅ COMPLETED

### pt_editor.html (v0.4.12)
- Auth working (shared Firebase instance)
- Loads 30 exercises from `pt_shared/exercise_library`
- Event handlers: bindPointerHandlers pattern (iOS-safe)
- Role region dropdown: loads from `pt_shared/exercise_roles_schema`
- Equipment autocomplete: union from all exercises
- Debug panel: shows auth, exercises, roles, localStorage

### pt_data_api.js
- Fixed: getAllExercises() reads from `pt_shared/exercise_library` (old schema)
- Fixed: Shared db/auth from firebase.js (version 12.7.0)
- Ready: After migration, switch to `exercise_definitions/{id}/versions/vX`

### Firestore Rules
- Deployed: Rules for `exercise_definitions` collection (for future migration)
- Working: `pt_shared` collection accessible to authenticated users

### offline_queue.js
- Complete: IndexedDB queue manager
- Complete: Auto-replay on connection restored
- Complete: withOfflineQueue wrapper for API functions

### rehab_coverage.html
- Fixed: Save button for roles now working
- Fixed: saveExerciseRolesShared made globally accessible
- Working: addRole() and deleteRole() persist to Firestore

## ⚠️ TODO (CRITICAL)

### pt_editor.html
1. **Save functionality NOT TESTED** - actionHandlers.saveExercise needs testing
2. **Roles save** - createRole/deleteRole need testing
3. **Dosage save** - updateDosage needs testing
4. **Exercise list rendering** - May need dropdown like pt_view instead of cards

### pt_tracker.html (Phase 2)
**NOT STARTED** - Still uses old saveSessionWithNotes() direct to Firestore
- Need to replace with insertExerciseCompletion from pt_data_api.js
- Need to add transaction toast
- Need to add offline indicator

## 📋 NEXT STEPS

1. Test pt_editor.html save on localhost:8000
2. Fix any handler issues
3. Deploy to GitHub Pages
4. Implement Phase 2 (pt_tracker integration)
5. Execute Phase 5 (migration with downtime)

## 🗂️ File Locations

- pt/pt_editor.html (v0.4.12)
- pt/shared/pt_data_api.js
- pt/shared/offline_queue.js
- pt/shared/pt_event_handlers.js
- pt/shared/legacy_adapter.js
- firestore.rules (deployed)

## 🔑 Key Patterns

**Event Binding (iOS-safe):**
```javascript
bindPointerHandlers(root); // Uses actionHandlers object
```

**Data Loading:**
```javascript
getAllExercises() // → pt_shared/exercise_library.exercises[]
loadExerciseRolesSchemaShared() // → pt_shared/exercise_roles_schema
```

**Firebase:**
```javascript
import { db, auth } from './firebase.js'; // Shared instance
```
