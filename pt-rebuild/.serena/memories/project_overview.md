Project: pt-rebuild at C:\Users\cindi\OneDrive\Documents\GitHub\rukuba\pt-rebuild.

Purpose:
- PT Tracker rebuild / Next.js migration workspace.
- Rebuilds an existing PT tracking app with emphasis on behavioral parity, offline/PWA behavior, and iOS-safe interactions.
- Deploys via Vercel and uses Supabase as a backend.

Tech stack:
- Next.js 14
- React 18
- JavaScript/TypeScript ecosystem (Serena uses TypeScript language tooling for this project)
- Supabase JS
- Playwright for end-to-end testing
- Beads (bd) for active NextJS migration/workstream tracking

Structure:
- pages, components, hooks, lib, api, public, styles are core application folders.
- docs contains workflow, architecture, testing, and Beads references.
- scripts contains repo automation such as Beads quickref and dev-notes generation.
- supabase, db, tests, test, and output folders support backend, verification, and generated artifacts.

Operational note:
- Canonical instructions live in pt-rebuild/AGENTS.md.
- Beads with prefix pt- is the active tracker for NextJS migration/workstream items.