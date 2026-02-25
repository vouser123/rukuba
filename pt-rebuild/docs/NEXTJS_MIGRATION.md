# Next.js Strangler Fig Migration

**Branch:** `nextjs`
**Dev note:** DN-033
**Status:** In progress — scaffold complete, first page (`rehab_coverage`) in progress

---

## Strategy Overview

Strangler Fig pattern: Next.js is added *alongside* the existing vanilla JS app. Existing pages keep working throughout. New pages are built in Next.js one at a time. Old HTML is retired only after the Next.js version is verified in production.

**Key rule:** Never create `pages/index.js` until `public/index.html` is retired. `pages/` takes precedence over `public/` for matching routes.

**Escape hatch:** If migration is abandoned, delete the `nextjs` branch. Main is untouched. Zero cleanup needed.

---

## Branch Strategy

All migration work happens on the `nextjs` branch. Main stays as pure vanilla JS — production-safe and hotfix-friendly throughout.

**Vercel preview URL for `nextjs` branch:**
`https://pt-rehab-git-nextjs-pt-tracker.vercel.app`

**Merge strategy:** One page = one merge to main. Verify on preview first, then merge, then retire the old HTML.

---

## What Does NOT Change

| Path | Why |
|------|-----|
| `api/` | All existing serverless functions stay — they coexist with Next.js on Vercel |
| `lib/auth.js`, `lib/db.js` | Used by `api/` routes — untouched |
| `public/index.html` | Not yet migrated — stays as primary app entry at `/` |
| `public/pt_view.html`, `public/pt_editor.html` | Not yet migrated |
| `public/rehab_coverage.html` | Kept during verification — retired after `/rehab` is confirmed good |
| `vercel.json` | `/pt` and `/track` rewrites unchanged; cron unchanged |

---

## Technical Setup (Already Done)

### `package.json` — added deps and scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

### `next.config.mjs` — ESM config (avoids `"type":"module"` conflict)
```js
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};
export default nextConfig;
```
`SUPABASE_URL` and `SUPABASE_ANON_KEY` already exist in Vercel for All Environments — no new Vercel dashboard variables needed. The `env` block forwards them as `NEXT_PUBLIC_*` at build time.

### `pages/_app.js` — minimal pass-through
```jsx
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

---

## Migration Phases

### Phase 1: Scaffold + rehab_coverage (DN-033) — IN PROGRESS

**Files to create:**

| File | Purpose |
|------|---------|
| `pt-rebuild/public/css/rehab-coverage.css` | CSS extracted from `rehab_coverage.html` `<style>` block |
| `pt-rebuild/lib/rehab-coverage.js` | Pure calculation functions extracted from `rehab_coverage.html` |
| `pt-rebuild/pages/rehab.js` | React page replacing `rehab_coverage.html` |

**Files to update:**

| File | Change |
|------|--------|
| `pt-rebuild/public/js/hamburger-menu.js` | Update `NAV_PAGES` rehab_coverage href from `rehab_coverage.html` → `/rehab` |

**Verification checklist:**
- [ ] `rehab_coverage.html` still loads and works (old page untouched)
- [ ] `/rehab` loads, auth works, coverage matrix renders
- [ ] Hamburger menu on `/rehab` opens, shows correct nav links, Refresh Data works
- [ ] Navigate from `/rehab` to other pages — no re-login required
- [ ] No console errors on `/rehab`
- [ ] All existing pages (`/`, `/pt`, `/pt_view.html`, `/pt_editor.html`) unaffected

**After production verify:**
- Retire `public/rehab_coverage.html`
- Add redirect in `vercel.json`: `/rehab_coverage.html` → `/rehab`
- Close DN-033

---

### Phase 2: pt_view (future)

**What it does:**
- Auth (same Supabase pattern)
- Fetches logs, exercises
- Renders log history as a list
- HamburgerMenu nav
- Offline queue for log submission

**React mapping:**
- `useOfflineQueue` hook → replaces `offlineQueue` global + sync logic
- `LogList` component → replaces DOM manipulation in `renderLogs()`
- Same `lib/rehab-coverage.js` auth pattern, new `lib/pt-view.js` for view-specific logic

**Target URL:** `/pt-view` (retire `pt_view.html` after verification)

---

### Phase 3: pt_editor (future)

**What it does:**
- Auth
- Exercise management (add/edit/delete)
- Log entry creation with timer
- Audio cues (pocket mode)
- Offline queue

**React mapping:**
- `useAudio` hook → replaces audio system
- `usePocketMode` hook → replaces pocket mode toggle + timer
- `useOfflineQueue` hook → replaces offline queue
- Exercise list as component state

**Target URL:** `/pt` (retire `pt_editor.html` after verification — note: `pt_editor.html` is currently served at `/pt` via `vercel.json` rewrite)

---

### Phase 4: index (future — last)

The main app entry. Must be migrated last because `pages/index.js` takes precedence over `public/index.html`.

**Target URL:** `/` (only possible after `public/index.html` is retired)

---

## `lib/rehab-coverage.js` — What Goes Here

Pure calculation functions extracted from `rehab_coverage.html`. No DOM, no fetch, no globals.

Functions:
- `COVERAGE_CONSTANTS` — thresholds, weights, color config
- `calculatePercent(done, total)` → number
- `calculateColorScore(percent)` → number 0–100
- `calculateOpacity(score)` → number 0–1
- `colorScoreToRGB(score)` → `{r, g, b}`
- `calculateRegionBar(exercises, logs)` → bar data
- `daysBetween(date1, date2)` → number
- `average(arr)` → number
- `weightedAverage(arr, weights)` → number
- `groupExercisesByFocus(exercises)` → Map

All exported as named exports. Import in `pages/rehab.js` and any future pages that need coverage calculations.

---

## `pages/rehab.js` — Architecture

```
state:
  session / loading / authError
  email / password (sign-in form)
  coverageData: { logs, exercises, userRole }

effects:
  mount: getSession() → if session, loadData(); else show auth form
  onAuthStateChange: handle SIGNED_IN / SIGNED_OUT

loadData(token):
  fetch /api/logs, /api/exercises, /api/roles in parallel
  set coverageData → triggers CoverageMatrix re-render
  init HamburgerMenu after data loads

render:
  if !session: <AuthForm />
  if session: <Header />, <CoverageMatrix />, <Scripts />
```

**HamburgerMenu integration:** Existing `hamburger-menu.js` loaded via `<Script strategy="afterInteractive" onLoad={...}>`. This is transitional — stays as-is until HamburgerMenu is rewritten as a React component (out of scope for Phase 1).

**CSS:** `<link rel="stylesheet" href="/css/rehab-coverage.css">` in `<Head>`. Plus existing `/css/main.css`.

**`data-action` buttons:** Header buttons use `data-action="toggle-hamburger"` and `data-action="refresh-data"`. `HamburgerMenu.bindHandlers()` handles `toggle-hamburger`. `refresh-data` is handled by `onAction` in `HamburgerMenu.init()`.

---

## Working on This from claude.ai

If you're working on this migration from the Claude website (not locally):

1. The `nextjs` branch is at `https://github.com/[repo]/tree/nextjs`
2. All context is in `pt-rebuild/docs/dev_notes.json` (DN-033) and this file
3. The subagent can read `rehab_coverage.html` and `hamburger-menu.js` directly from the repo
4. Reference the plan in your prompt: "Continue DN-033 per NEXTJS_MIGRATION.md"

The branch produces a preview deployment automatically at:
`https://pt-rehab-git-nextjs-pt-tracker.vercel.app`

---

## After Each Page Migration

1. Verify on preview URL (not production)
2. Test auth, data load, hamburger, navigation, no console errors
3. Merge `nextjs` → `main`
4. Verify on production (`pttracker.app`)
5. Retire old HTML file
6. Add redirect in `vercel.json`
7. Close dev note, open next phase dev note
