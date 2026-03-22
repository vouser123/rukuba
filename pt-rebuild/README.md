# PT Rebuild Static Branch

This branch is the legacy static deployment surface for PT Tracker.

What lives here:
- `public/`: the static app pages and browser-served assets
- `api/`: the serverless endpoints the static pages call
- `lib/`: only the auth/db/helpers required by `api/`
- `vercel.json`: legacy rewrites and cron config
- `package.json`: minimal runtime dependencies for the legacy deployment

What does not belong here:
- Next.js routes under `pages/`
- React components/hooks
- migration planning docs
- unrelated repo-level project history and experiments

Use this branch for:
- keeping the legacy fallback deployment working
- legacy-only fixes the user explicitly wants

Use `nextjs` for:
- modern app work
- migration and cutover work
- new feature development
