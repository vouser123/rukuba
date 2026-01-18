# PT Tracker Rebuild — Reference-Only Artifacts

This file lists **legacy-only** artifacts that are **not valid inputs** for the rebuild runtime. They may be used **only** for migration, audit comparison, or exported backups.

---

## 1. Firebase / Firestore Artifacts (Reference Only)
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- Any Firebase auth flows, Firestore collections, or Firestore offline persistence behavior.

---

## 2. Bundled JSONs (Reference / Export Only)
These JSONs must **not** be used as runtime inputs in the rebuild:
- `pt/exercise_library.json`
- `pt/exercise_roles.json`
- `pt/exercise_roles_vocabulary.json`
- `pt/exercise_library_vocabulary.json`
- Schema JSONs under `pt/schema/*`

Allowed usage:
- legacy export backups,
- migration verification,
- audit comparison.

---

## 3. Legacy Seeding & Migration Utilities (Reference Only)
- `pt/seed_firestore.html`
- `pt/migrate_roles.html`
- Any scripts that seed Firestore or write JSON payloads upstream.

---

## 4. Legacy Transport Formats (Export Only)
- `PT_DATA` / `PT_MODIFICATIONS` payload formats are permitted **only** for export/backups and migration compatibility.

---

## 5. Deprecated / Excluded UI Elements
- **Body heatmap UI** and **heatmap tags** are excluded from the rebuild. Any references to heatmap tags in legacy JSONs are for historical comparison only.

