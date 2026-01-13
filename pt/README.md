# PT Tracker

Progressive Web App (PWA) for tracking physical therapy exercises and monitoring rehab coverage.

## Quick Start

1. **PT Tracker** (`pt_tracker.html`) - Main exercise tracking interface
2. **Coverage View** (`rehab_coverage.html`) - Analyze exercise coverage by region/capacity/focus

## Documentation

- **[Development Guide](docs/DEVELOPMENT.md)** - Architecture, data model, and roadmap
- **[Development Practices](docs/DEV_PRACTICES.md)** - Workflow, best practices, troubleshooting
- **[Development Notes](docs/DEV_NOTES.md)** - Dated fixes, audits, TODOs (add a note after fixes)
- **[Vocabularies](docs/vocabularies.md)** - Legacy vocabulary reference (pre-roles system)

## Key Files

| File | Purpose |
|------|---------|
| `exercise_library.json` | Exercise database (immutable) |
| `exercise_roles.json` | Maps exercises to functional roles |
| `exercise_roles_vocabulary.json` | Human-readable term definitions |
| `schema/exercise_roles.schema.json` | Schema (source of truth for enums) |

## Common Tasks

### Add a new exercise role
Edit `exercise_roles.json`:
```json
"01EXERCISEID123": {
  "name": "Exercise Name",
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

### Force cache refresh
Edit `sw-pt.js`:
```javascript
const CACHE_NAME = 'pt-tracker-v1.11.0'; // Increment version
```

### Debug coverage issues
Open Coverage → Tap 🐛 button → Check session count and ID matches

## Troubleshooting

**Coverage shows everything as "not done"**
1. Tap 🐛 debug button in Coverage view
2. Check "Sessions" count (should be > 0)
3. Check "Matching IDs" count (should show exercises)
4. If sessions = 0: Navigate to Coverage FROM PT Tracker (don't bookmark separately)

**Service worker not updating**
1. Bump cache version in `sw-pt.js`
2. Force reload (🔄 button)
3. On iOS: Close PWA completely and reopen

For detailed technical documentation, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
