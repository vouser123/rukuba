# Next.js Strangler Fig Migration

**Branch:** `nextjs` (merge to `main` after each page is verified — see Branch Strategy below)
**Dev note:** DN-033
**Status:** Phase 1 complete — `pages/rehab.js` built and verified; ready to merge to main

---

## Branch Strategy

**Current recommendation: merge `nextjs` → `main` after Phase 1 is verified.**

The original reason for a long-lived branch was to protect main from broken Next.js builds. Now that the scaffold works, that risk is gone. Keeping code on a branch means Codex (when used from the website) can't see it — Codex always clones `main`.

**After verification of each page:**
1. Merge `nextjs` → `main` (GitHub Desktop: switch to `nextjs`, click "Create Pull Request")
2. Verify on production
3. Retire the old HTML file
4. Continue future migration work directly on `main`

**Escape hatch:** If the build ever breaks on main, revert the Next.js changes. The vanilla JS pages in `public/` are completely unaffected — they don't depend on Next.js at all.

**Vercel preview URL for `nextjs` branch:**
`https://pt-rehab-git-nextjs-pt-tracker.vercel.app`

---

## Strategy Overview

Strangler Fig pattern: Next.js is added *alongside* the existing vanilla JS app. Existing pages keep working throughout. New pages are built in Next.js one at a time. Old HTML is retired only after the Next.js version is verified in production.

**Key rule:** Never create `pages/index.js` until `public/index.html` is retired. `pages/` takes precedence over `public/` for matching routes.

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
`SUPABASE_URL` and `SUPABASE_ANON_KEY` already exist in Vercel for All Environments — no new Vercel dashboard variables needed.

### `pages/_app.js` — minimal pass-through
```jsx
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

---

## Shared Architecture ("Designed for Forward")

Every Next.js page uses these shared pieces. Build them once, use everywhere. The index migration gets the infrastructure for free.

### `lib/supabase.js` — single shared Supabase client
```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```
**Do NOT** call `createClient()` anywhere else. All pages import `supabase` from here.

### `hooks/useAuth.js` — shared auth hook
```js
const { session, loading, signIn, signOut } = useAuth();
```
- `session` — Supabase session object (has `.user` and `.access_token`), or null
- `loading` — true until the initial session check resolves (show nothing, not a loading spinner)
- `signIn(email, password)` — returns error string or null
- `signOut()` — signs out and clears session

### `components/AuthForm.js` — shared sign-in form
```jsx
<AuthForm title="Coverage Analysis Sign In" onSignIn={signIn} />
```
Pass `signIn` from `useAuth()` directly. AuthForm manages its own input state and shows errors.

### `components/NavMenu.js` — React nav (replaces window.HamburgerMenu)
```jsx
<NavMenu
    user={session.user}
    isAdmin={userRole !== 'patient'}
    onSignOut={signOut}
    currentPage="rehab_coverage"
    actions={[{ action: 'refresh-data', icon: '🔄', label: 'Refresh Data' }]}
    onAction={(action) => { if (action === 'refresh-data') loadData(); }}
/>
```
Place inside your `header-actions` div. NavMenu renders the ☰ button + overlay + panel internally. No `window.*`, no `Script` tags, no `useRef` plumbing.

**CSS note:** Hamburger styles are in `rehab-coverage.css` for now. When more pages are migrated, move the hamburger CSS block to `main.css` so all pages share it without loading `rehab-coverage.css`.

### `NAV_PAGES` in `components/NavMenu.js`
Update hrefs here as pages are migrated:
```js
{ id: 'index',          href: '/index.html',          label: '📱 PT Tracker',       adminOnly: false },
{ id: 'pt_view',        href: '/pt_view.html',         label: '📊 View History',     adminOnly: false },
{ id: 'pt_editor',      href: '/pt_editor.html',       label: '✏️ Exercise Editor',  adminOnly: true  },
{ id: 'rehab_coverage', href: '/rehab',                label: '📈 Coverage Analysis', adminOnly: false },
```
When `pt_view.html` is migrated to `/pt-view`, update that href. When `pt_editor.html` is migrated, update that one. Do NOT update `hamburger-menu.js` (the vanilla JS file) for migrated pages anymore — that file is only for the old HTML pages.

---

## Migration Phases

### Phase 1: Scaffold + rehab_coverage (DN-033) — COMPLETE

**Files created:**

| File | Purpose |
|------|---------|
| `pt-rebuild/lib/supabase.js` | Shared Supabase client instance |
| `pt-rebuild/hooks/useAuth.js` | Shared auth hook |
| `pt-rebuild/components/NavMenu.js` | React nav sidebar (no globals) |
| `pt-rebuild/components/AuthForm.js` | Shared sign-in form |
| `pt-rebuild/public/css/rehab-coverage.css` | CSS extracted from `rehab_coverage.html` |
| `pt-rebuild/lib/rehab-coverage.js` | Pure coverage calculation functions |
| `pt-rebuild/pages/rehab.js` | React page replacing `rehab_coverage.html` |
| `pt-rebuild/pages/_app.js` | Pages Router pass-through |
| `pt-rebuild/next.config.mjs` | ESM Next.js config |

**Files updated:**

| File | Change |
|------|--------|
| `pt-rebuild/package.json` | Added next/react/react-dom + scripts |
| `pt-rebuild/public/js/hamburger-menu.js` | Updated NAV_PAGES rehab_coverage href to `/rehab` |

**Verification checklist:**
- [ ] `rehab_coverage.html` still loads and works (old page untouched)
- [ ] `/rehab` loads, auth works, coverage matrix renders
- [ ] Hamburger menu (NavMenu) opens, shows correct nav links, Refresh Data works
- [ ] Navigate from `/rehab` to other pages — no re-login required
- [ ] No console errors on `/rehab`
- [ ] All existing pages (`/`, `/pt`, `/pt_view.html`, `/pt_editor.html`) unaffected

**After production verify:**
- Retire `public/rehab_coverage.html`
- Add redirect in `vercel.json`: `/rehab_coverage.html` → `/rehab`
- Merge `nextjs` → `main`
- Close DN-033

---

### Phase 2: pt_view (future)

**Target URL:** `/pt-view` (retire `pt_view.html` after verification)

**What it does:**
- Auth → `useAuth()` (already built)
- Nav → `<NavMenu />` (already built)
- Fetches logs, exercises
- Renders log history as a list
- Offline queue for log submission

**React mapping:**
- `useOfflineQueue` hook → replaces `offlineQueue` global + sync logic
- `LogList` component → replaces DOM manipulation in `renderLogs()`
- New `lib/pt-view.js` for view-specific data logic (same pattern as `lib/rehab-coverage.js`)

**When starting Phase 2:**
Update NAV_PAGES in `components/NavMenu.js`: `pt_view` href from `/pt_view.html` → `/pt-view`

---

### Phase 3: pt_editor (future)

**Target URL:** `/pt` (retire `pt_editor.html` after verification — note: currently served at `/pt` via `vercel.json` rewrite)

**What it does:**
- Auth, Nav (already built)
- Exercise management (add/edit/delete)
- Log entry creation with timer
- Audio cues (pocket mode)
- Offline queue

**React mapping:**
- `useAudio` hook → replaces audio system
- `usePocketMode` hook → replaces pocket mode toggle + timer
- `useOfflineQueue` hook → replaces offline queue

---

### Phase 4: index (future — last)

The main app entry. Must be migrated last because `pages/index.js` takes precedence over `public/index.html`.

**Target URL:** `/` (only possible after `public/index.html` is retired)

---

## Pattern for Every New Page

```jsx
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import NavMenu from '../components/NavMenu';
import AuthForm from '../components/AuthForm';

export default function MyPage() {
    const { session, loading: authLoading, signIn, signOut } = useAuth();
    const [userRole, setUserRole] = useState('patient');

    // Load data when session is available
    useEffect(() => {
        if (session) loadData(session.access_token);
    }, [session]);

    return (
        <>
            <Head>...</Head>
            {!session && !authLoading && (
                <AuthForm title="My Page Sign In" onSignIn={signIn} />
            )}
            {session && (
                <>
                    <div className="header">
                        <h1>My Page</h1>
                        <div className="header-actions">
                            <NavMenu
                                user={session.user}
                                isAdmin={userRole !== 'patient'}
                                onSignOut={signOut}
                                currentPage="my_page_id"
                                actions={[]}
                                onAction={() => {}}
                            />
                        </div>
                    </div>
                    {/* page content */}
                </>
            )}
        </>
    );
}
```

---

## Working on This from claude.ai (Codex or Chat)

**Important:** Codex from the website clones `main`. After Phase 1 is merged to main, everything is visible.

To continue migration work from claude.ai:
1. Reference this file: `pt-rebuild/docs/NEXTJS_MIGRATION.md`
2. Reference `pt-rebuild/docs/dev_notes.json` (DN-033 and later)
3. Say: "Continue the Next.js migration per NEXTJS_MIGRATION.md — next phase is [Phase 2: pt_view]"

All context needed for the next phase is in this document.

---

## After Each Page Migration

1. Verify on preview URL
2. Test: auth, data load, NavMenu, navigation between pages, no console errors
3. Merge `nextjs` → `main` (or commit directly to main if already there)
4. Verify on production (`pttracker.app`)
5. Retire old HTML file
6. Add redirect in `vercel.json`
7. Update NAV_PAGES hrefs in `components/NavMenu.js`
8. Close dev note, open next phase dev note
