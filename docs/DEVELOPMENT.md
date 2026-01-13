# Development Notes

## PT report lifecycle normalization (2026-02-01)
- `pt_report.html` now normalizes exercise lifecycle data before rendering.
- The normalizer maps legacy `archived` booleans into `lifecycle.status` and ensures lifecycle dates are present, so archived exercises no longer appear active when loading from Firestore runtime, file imports, or pasted PT data.
