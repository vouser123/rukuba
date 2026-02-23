# Claude Instructions for PT (Legacy Firebase App)

This folder contains the original Firebase/Firestore implementation of the PT tracker.
It is **archived and not under active development**. Do not make changes here.

The active app is in `/pt-rebuild/`. See `/pt-rebuild/CLAUDE.md` for current development instructions.

---

## Legacy Reference: Firebase/Firestore Patterns

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

## Legacy Quick Reference

- **Main docs**: `pt/docs/DEVELOPMENT.md`
- **Practices**: `pt/docs/DEV_PRACTICES.md`
- **Dev notes**: `pt/docs/DEV_NOTES.md`
- **V2 payload format**: `pt/docs/export-import-v2.md`
- **Vocabulary docs**: `pt/docs/vocabularies.md`
- **Service worker**: `pt/sw-pt.js`
- **Firebase config**: `pt/firebase.js`

## Legacy Dev Workflow (for reference only)

### Commenting
All new functions and non-trivial code blocks must include comments.

### Dev Notes Format
```markdown
- **YYYY-MM-DD** — **Problem:** [Description]. **What I did:** [Fix and files changed].
```
