# Legacy Dev Notes Workflow (`pt-rebuild`)

`docs/archive/dev-notes/dev_notes.json` and `docs/archive/dev-notes/DEV_NOTES.md` are now legacy archive material, not the active tracker.

## Active Rule

- Use Beads for all active work in `pt-rebuild`.
- Do not create new `DN-*` items.
- If historical context from a `DN-*` item matters, reference it from Beads with `--external-ref DN-###`.

## Legacy Archive Handling

- `docs/archive/dev-notes/dev_notes.json` remains the canonical source for the legacy archive.
- `docs/archive/dev-notes/DEV_NOTES.md` remains a generated view of that archive.
- Only update the legacy archive when preserving history or recording archive-maintenance changes.
- Do not hand-edit `docs/archive/dev-notes/DEV_NOTES.md`.

## Legacy Maintenance Commands

Run from `/pt-rebuild` only if the legacy archive itself changes:

```bash
npm run dev-notes:build
npm run dev-notes:check
```
