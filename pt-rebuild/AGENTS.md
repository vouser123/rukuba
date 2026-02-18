# Agent Instructions for PT Rebuild (`/pt-rebuild`)

This file governs agent behavior for work inside `pt-rebuild/`.

## Canonical References

- `pt-rebuild/docs/DEVELOPMENT.md` - architecture and implementation reference
- `pt-rebuild/docs/DEV_PRACTICES.md` - day-to-day workflow and troubleshooting
- `pt-rebuild/docs/vocabularies.md` - canonical field names and data contracts

## Core Rules

- Use a docs-first workflow: check the canonical references before editing code.
- Do not invent new field names when existing vocabulary/schema terms are available.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns (`pointerup`, touch-safe UI behavior).
- Respect Vercel/serverless limits: avoid endpoint sprawl and prefer extending existing handlers.

## iOS PWA Interaction Rules

- Always use `touch-action: manipulation` on interactive elements.
- Use `pointerup` events instead of `onclick` for reliable touch handling.
- Include `-webkit-tap-highlight-color: transparent` on buttons.
- Minimum touch target size: 44px (Apple HIG).

## Required Final Step

Before reporting any fix/feature/behavior change as complete, append a dated note to:

- `pt-rebuild/docs/DEV_NOTES.md`

Use the `Entry Schema` in `DEV_NOTES.md` for new dated entries:

- `Problem:`
- `Root cause:`
- `Change made:`
- `Files touched:`
- `Validation:`
- `Follow-ups:`
- `Tags: [...]`

If the change resolves an outstanding item, update `Open Items` in `DEV_NOTES.md` (close-loop: remove resolved item and reference the dated entry).

## Change Hygiene

- Keep instructions concise and avoid duplicating detailed architecture from docs.
- If guidance conflicts within `pt-rebuild/`, `AGENTS.md` is the operational source of truth.
