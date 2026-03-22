# Agent Instructions for PT Rebuild Static Branch

This branch exists only to serve the legacy static PT Tracker app at the fallback subdomain.

Core rules:
- Treat this branch as the frozen legacy deployment surface unless the user explicitly asks for legacy-only fixes.
- Do not add new Next.js routes, components, hooks, or migration work here.
- Keep only the legacy static runtime, its required API helpers, and the minimal config needed for Vercel deployment.
- If a future change belongs to the modern app, do it on `nextjs`, not here.
- Preserve current legacy behavior unless the user explicitly approves a change.

Branch shape:
- `public/` holds the legacy browser-served app pages and assets.
- `api/` holds the serverless endpoints those pages call.
- `lib/` holds only the helpers needed by `api/`.
- `vercel.json` holds the legacy rewrites and cron config.
- `package.json` holds only the minimal runtime dependencies/config for this legacy deployment.

Change hygiene:
- Keep edits small and deployment-focused.
- If you add, remove, or repurpose a file in this branch, update [`README.md`](/Users/cindi/OneDrive/Documents/GitHub/rukuba-static/pt-rebuild/README.md) in the same change.
