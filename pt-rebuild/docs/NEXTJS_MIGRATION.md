# Next.js Strangler Fig Migration

**Branch:** `nextjs` (incremental page-by-page merges to `main` after verification — see Branch Strategy below)
**Dev note:** DN-033
**Status:** Phase 2 complete — `/rehab` and `/pt-view` both verified on preview URL
**Policy note (2026-03-01):** This document was updated to explicitly confirm incremental merges to `main` as the active strategy (not full-freeze until final cutover).

---

## Branch Strategy

**All migration work stays on the `nextjs` branch until the full migration is complete.**

Main stays as pure vanilla JS throughout — production-safe and hotfix-friendly. The `nextjs` branch is a long-lived feature branch that gets merged to main only when all pages are migrated and verified.

**Decision record — 2026-03-01:** Use incremental releases. As each migrated page is verified on preview, merge that page slice to `main`, verify production, then retire the corresponding legacy HTML route.

**Escape hatch:** If the migration is abandoned, delete the `nextjs` branch. Main is untouched. Zero cleanup needed.

**Note on Codex:** When using Codex from the claude.ai website, it clones `main` and cannot see the `nextjs` branch. For migration work with Codex, use it locally where you can specify the branch. Hotfixes to the vanilla JS app can be done on `main` at any time — the branches don't conflict.

**Vercel preview URL for `nextjs` branch:**
`https://pt-rehab-git-nextjs-pt-tracker.vercel.app`

**Merge strategy (active):** One page = verified on preview → merge to main → verify on production → retire old HTML → next page.

---

## Vercel CLI Notes (2026-03-01)

Use these commands for migration verification in this repo:

- Preview deployments list (JSON): `npx vercel@latest ls --environment preview --format json`
- Inspect deployment summary: `npx vercel@latest inspect <deployment-url-or-id>`
- Inspect build logs: `npx vercel@latest inspect <deployment-url-or-id> --logs`
- Runtime logs (historical window): `npx vercel@latest logs --environment preview --level error --since 2h --no-branch --limit 200`
- Runtime logs for deployment URL (historical): `npx vercel@latest logs <deployment-url> --no-follow`

Known syntax pitfalls seen during DN-039:

- `vercel ls` does **not** support `--branch`
- `vercel inspect` does **not** support `--no-clipboard`
- `vercel logs` with deployment URL implies follow mode; use `--no-follow` when filtering by time

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

## Architecture Guidelines

These are committed rules for all Next.js pages in this migration. They are not suggestions to be re-evaluated per conversation — follow them. A new Claude session (local or cloud) must not make these decisions from scratch.

**Full reference: `pt-rebuild/docs/NEXTJS_STRUCTURE.md`** — file size limits (with hard caps), cohesion checks, split decision rules, folder structure, naming conventions, and worked examples. `NEXTJS_STRUCTURE.md` is the authoritative source; the rules below are a summary. When in doubt, load the full doc.

### Component Extraction Rules

**When to extract into a standalone file in `components/`:**

| Rule | Example |
|------|---------|
| Used in **≥2 places** (2 or more distinct pages or components) | `NavMenu`, `AuthForm` |
| Has its own significant state or lifecycle | `MessagesModal` (draft, sending, undoTarget, scroll ref) |
| Modal or overlay — **always extract** | `MessagesModal`, `ExerciseHistoryModal` |
| Would push the parent file past its signal size | `ExerciseHistoryModal` extracted from `pt-view.js` |

**≥2 places means used in 2 or more distinct pages/components (i.e., ≥2, not >2).** A component used exactly once but with its own state machine (modal) still gets extracted.

**When a local function inside the page file is acceptable:**
- Simple display components with no state, used only on that one page
- Sub-components that directly share the parent's state without prop-drilling or lifting
- Example: `PatientNotes`, `NeedsAttention`, `SummaryStats`, `FiltersPanel`, `HistoryList` in `pt-view.js` — all page-specific, no reuse elsewhere, all share the page's state directly

### File Size Guidelines

Targets and signals-to-split. "Signal" means: pause and review whether to split. Not a hard stop — do not split just to hit a number.

| File type | Target | Signal to split |
|-----------|--------|-----------------|
| Component JS | 200 lines | 350 lines |
| Page JS | 350 lines | 500 lines |
| Custom hook | 100 lines | 200 lines |
| Lib (pure functions) | 250 lines | 400 lines |
| CSS Module | 350 lines | 500 lines |

When a file hits its signal size: look for a natural split (separate concern, extractable component). If no clean split exists, continue — the signal is a trigger to think, not a mandate to split artificially. Three pages of cohesive logic in one file is better than three thin files with a weak abstraction between them.

### Hooks (`hooks/`)

- One concern per hook file. `useAuth` = auth only. `useMessages` = messages only. Do not merge unrelated concerns into one hook.
- Hooks that are small and page-specific may be defined inline in the page file. Once they would be reused across ≥2 pages, move to `hooks/` immediately.
- **Cleanup on unmount is required** for any `setInterval`, event listener, or subscription — return a cleanup function from `useEffect`.
- Read localStorage in `useState` initializer functions (not `useEffect`) to avoid hydration flicker. **Always guard with `typeof window !== 'undefined'`** — Next.js runs `useState` initializers during SSR where `localStorage` doesn't exist:
  ```js
  const [notesCollapsed, setNotesCollapsed] = useState(
      () => typeof window !== 'undefined' && localStorage.getItem('notesCollapsed') === 'true'
  );
  const [dismissed, setDismissed] = useState(
      () => typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('dismissed') ?? '[]') : []
  );
  ```

### Lib (`lib/`)

- **Pure functions only** — no React imports, no hooks, no side effects outside the returned value.
- Group by feature domain: `lib/pt-view.js` contains all data functions for the pt-view page. Do not scatter related functions across multiple lib files without a clear domain reason.
- API call functions always take `(token, ...args)` as their first argument — never read the session from a global or closure.
- Utility functions shared across multiple feature domains → `lib/utils.js`.

### State Management

Escalation ladder — start at the lowest level that works, escalate only when necessary:

1. **Local `useState`** in the component that owns it
2. **Lift to page** when a child needs to read or set the parent's state
3. **Custom hook** when state logic is complex enough to warrant isolation (≥2 state variables + effects that belong together)
4. **No global store** — no Redux, no Zustand, no React Context. The app is small; session is managed by Supabase.

### Styling

- CSS Module per component (`NavMenu.module.css`) and per page (`pt-view.module.css`). One module per file — no shared modules between unrelated components.
- `styles/globals.css` = CSS variables + body/html reset only. No component styles in globals.
- Dark mode: handled in each CSS Module with `@media (prefers-color-scheme: dark)`. No JS-based theme toggle.
- Class names: use `styles['class-name']` for hyphenated names, `styles.className` for camelCase. Conditional classes: `` `${styles.base} ${condition ? styles.active : ''}` ``. No runtime class name libraries.
- Inline styles only for dynamically computed values (e.g. `style={{ borderLeft: '4px solid ' + color }}`). Never for static styles that belong in the CSS Module.

### Event Handlers

**Always `onPointerUp`, never `onClick` for interactive elements.** This is a non-negotiable iOS Safari requirement — `onClick` fires with a 300ms delay or fails entirely on some touch targets. Applies to: buttons, divs acting as buttons, card taps, overlay close handlers.

Correct use of `onClick`/`onChange`/`onKeyDown`:
- `onChange` on form inputs (`<input>`, `<select>`, `<textarea>`) — these are not touch targets
- `onKeyDown` for keyboard shortcuts like Enter-to-send

### What NOT To Do

- Do not add `window.*` globals. Everything through props, hooks, or module-level constants.
- Do not call `createClient()` anywhere except `lib/supabase.js`. All pages import `supabase` from there.
- Do not use `useRef` for DOM manipulation that can be done declaratively with CSS or state.
- Do not introduce Redux, Zustand, or React Context — the app does not need a global store.
- Do not add TypeScript — the project is JavaScript throughout.
- Do not add `console.log` debugging calls to committed code.

---

## Standard Verification Checklist

Run after every phase or sub-phase on `https://pt-rehab-git-nextjs-pt-tracker.vercel.app`.

**Every phase:**
- [ ] Old HTML page still loads (`/{page}.html` — same content as before)
- [ ] New Next.js page loads — auth form renders, sign in works
- [ ] Data loads correctly — all sections visible with real data
- [ ] NavMenu: ☰ opens panel, shows "Signed in as" + email, Close button and overlay both close it
- [ ] Nav links — from this page, each link navigates without requiring re-login:
  - [ ] → PT Tracker (`/index.html`)
  - [ ] → View History (`/pt_view.html` or `/pt-view` once migrated)
  - [ ] → Exercise Editor (`/pt_editor.html` or `/pt` once migrated) — admin only
  - [ ] → Coverage Analysis (`/rehab`)
- [ ] No unexpected console errors
- [ ] Dark mode (`prefers-color-scheme: dark`) — colors and layout correct

**Page-specific checklist:** listed under each phase below.

---

## Migration Phases

### Phase 1: Scaffold + rehab_coverage (DN-033) — COMPLETE

**Files created:**

| File | Purpose |
|------|---------|
| `pt-rebuild/lib/supabase.js` | Shared Supabase client instance |
| `pt-rebuild/hooks/useAuth.js` | Shared auth hook |
| `pt-rebuild/components/NavMenu.js` | React nav sidebar (no globals) |
| `pt-rebuild/components/NavMenu.module.css` | Scoped hamburger/nav panel styles |
| `pt-rebuild/components/AuthForm.js` | Shared sign-in form |
| `pt-rebuild/components/AuthForm.module.css` | Scoped auth form styles |
| `pt-rebuild/styles/globals.css` | CSS variables + body reset (imported in `_app.js`) |
| `pt-rebuild/public/css/rehab-coverage.css` | CSS kept for `rehab_coverage.html` (old page) |
| `pt-rebuild/lib/rehab-coverage.js` | Pure coverage calculation functions |
| `pt-rebuild/pages/rehab.js` | React page replacing `rehab_coverage.html` |
| `pt-rebuild/pages/rehab.module.css` | Scoped coverage/summary/legend styles |
| `pt-rebuild/pages/_app.js` | Pages Router pass-through + global CSS import |
| `pt-rebuild/next.config.mjs` | ESM Next.js config |

**Files updated:**

| File | Change |
|------|--------|
| `pt-rebuild/package.json` | Added next/react/react-dom + scripts |
| `pt-rebuild/public/js/hamburger-menu.js` | Updated NAV_PAGES rehab_coverage href to `/rehab` |

**CSS architecture (CSS Modules):**
- Component styles are self-contained — importing a component gets its CSS automatically
- `styles/globals.css` → CSS variables + resets, loaded once in `_app.js`
- `NavMenu.module.css` → hamburger/panel styles scoped to NavMenu
- `AuthForm.module.css` → auth form styles scoped to AuthForm
- `rehab.module.css` → coverage/legend/summary styles scoped to the rehab page
- `public/css/main.css` and `public/css/rehab-coverage.css` untouched — vanilla JS pages still use them
- `public/css/hamburger-menu.css` kept — used by `pt_editor.html`

**Verification checklist (standard):**
- [x] `rehab_coverage.html` still loads and works (old page untouched)
- [x] `/rehab` loads — auth form renders, sign in works
- [x] Coverage matrix renders with real data
- [x] NavMenu: ☰ opens panel, shows "Signed in as" + email, Close and overlay both close it
- [x] Nav links navigate without requiring re-login
- [x] No unexpected console errors
- [x] Dark mode — verified (page uses dark CSS vars by default; dark mode media query confirmed rendering correctly)

**Page-specific:**
- [x] Refresh Data action in NavMenu works
- [x] All existing pages (`/`, `/pt`, `/pt_view.html`, `/pt_editor.html`) unaffected

**After production verify:**
- Retire `public/rehab_coverage.html`
- Add redirect in `vercel.json`: `/rehab_coverage.html` → `/rehab`
- Merge `nextjs` → `main`
- Close DN-033

---

### Phase 2: pt_view (COMPLETE — DN-034)

**Target URL:** `/pt-view` (retire `pt_view.html` after verification)

**What it does:**
- Auth → `useAuth()` (already built)
- Nav → `<NavMenu />` (already built)
- Fetches logs, programs, users, messages
- Read-only history dashboard — **no offline queue** (pt_view.html does not submit logs)
- Messages with polling, send, archive, read receipts
- Patient notes, needs attention, summary stats, filters, exercise history modal

**Note:** `useOfflineQueue` is NOT needed here — that belongs to Phase 4 (index.html), which has the offline log submission queue.

**Files created:**

| File | Purpose |
|------|---------|
| `pt-rebuild/lib/pt-view.js` | Pure data logic (fetchLogs, fetchPrograms, fetchUsers, fetchMessages, sendMessage, patchMessage, deleteMessage, patchEmailNotifications, groupLogsByDate, findNeedsAttention, needsAttentionUrgency, computeSummaryStats, detectKeywords, applyFilters, countUnreadMessages, countRecentSent) |
| `pt-rebuild/pages/pt-view.module.css` | Scoped styles from pt_view.html embedded style block |
| `pt-rebuild/pages/pt-view.js` | React page replacing `pt_view.html` (local sub-components: PatientNotes, NeedsAttention, SummaryStats, FiltersPanel, HistoryList) |
| `pt-rebuild/hooks/useMessages.js` | Fetch, poll (30s interval), send, archive, markRead — shared across all pages that need messaging |
| `pt-rebuild/components/MessagesModal.js` | Messages panel: bubble list (sent/received), archive with undo, email notification toggle, compose with Enter-to-send |
| `pt-rebuild/components/MessagesModal.module.css` | Scoped styles for MessagesModal |
| `pt-rebuild/components/ExerciseHistoryModal.js` | Per-exercise history detail: search by date/notes, sorted newest first, set breakdown |
| `pt-rebuild/components/ExerciseHistoryModal.module.css` | Scoped styles for ExerciseHistoryModal |

**Files updated:**

| File | Change |
|------|--------|
| `pt-rebuild/components/NavMenu.js` | NAV_PAGES: `pt_view` href updated from `/pt_view.html` → `/pt-view` |

**Verification checklist (standard):**
- [x] `pt_view.html` still loads and works (old page untouched)
- [x] `/pt-view` loads — auth form renders, sign in works
- [x] History list renders with real data, grouped by date
- [x] NavMenu: ☰ opens panel, shows "Signed in as" + email, Close and overlay both close it
- [x] Nav links navigate without requiring re-login
- [x] No unexpected console errors
- [x] Dark mode — colors and layout correct

**Page-specific:**
- [x] Patient notes: shows 7 notes with keyword highlighting; dismiss buttons present; collapse/expand toggle visible
- [x] Needs Attention section: shows 10 never-performed exercises with red borders
- [x] Summary stats: 10 days active, 16 exercises covered, 79 total sessions
- [x] Filters: exercise dropdown populated (34 options), date range inputs, search input; localStorage state persists on reload
- [x] Sessions show inline set detail (reps, seconds, side)
- [x] Messages modal: opens, 7 sent messages with "✓ Read" status, Archive buttons, email toggle
- [x] Exercise history modal: opens from Needs Attention card; shows "0 sessions" for never-performed exercise
- [x] Email notification toggle: checkbox renders checked

---

### Phase 3: pt_editor — broken into sub-phases

**Target URL:** `/program` (chosen over `/pt` which conflicts with `vercel.json` rewrite; over `/exercises` which is too narrow; page covers exercises + roles + dosages + vocab)
**NavMenu label:** `📋 Program Editor`
**Retire:** `pt_editor.html` after Phase 3 verified in production

Split into sub-phases because pt_editor has 4 distinct feature areas, each independently testable.

#### Phase 3a: Exercise management ✅ COMPLETE (DN-041, verified 2026-03-01)
- Page skeleton + auth + NavMenu: `pages/program.js`, `pages/program.module.css`
- Exercise list (search, archive toggle, select), add / edit exercises — full 8-section form
- Lifecycle & Status extracted to `components/ExerciseFormLifecycle.js` (supersedes relationship, bi-directional update)
- Files: `lib/pt-editor.js`, `components/ExerciseForm.js`, `components/ExerciseFormCore.js`, `components/ExerciseFormCues.js`, `components/ExerciseFormLifecycle.js`, `components/ExerciseForm.module.css`
- No new API routes (uses existing `/api/exercises`, `/api/vocab`, `/api/reference-data`)

#### Phase 3b: Roles editing + DosageModal (DN-042)
**Roles:**
- Makes Roles section (section 7) editable in `ExerciseFormCues.js` — was read-only in 3a
- Add role: region × capacity × focus (optional) × contribution; POST `/api/roles`
- Remove role: soft-delete (sets `active=false`); DELETE `/api/roles/:id`
- No PUT on roles — create or delete only
- Callbacks flow: `ExerciseForm.js` → `ExerciseFormCues.js` (no API calls in components)
- Guard: Add/Remove disabled on unsaved new exercises (no ID yet)

**DosageModal:**
- New shared component `components/DosageModal.js` + `DosageModal.module.css`
- Fields: sets (always), reps (hidden for duration/distance exercises), seconds (for hold/duration), distance (for distance modifier)
- Props: `exercise`, `program`, `onSave(formData)`, `onClose()` — parent handles API call
- Triggered from `/program` selector panel (Dosage button appears when exercise is selected)
- Programs loaded at page load via GET `/api/programs?patient_id=X`, keyed by `exercise_id`
- Reusable: same component used from future tracker page migration (Phase 4)
- API calls in `lib/pt-editor.js`: `addRole`, `deleteRole`, `fetchPrograms`, `createProgram`, `updateProgram`
- No new API routes

#### Phase 3c: Vocabulary Editor
- Section 4: controlled vocab CRUD (`/api/vocab` POST/PUT/DELETE)
- Admin/therapist only
- Added to `pages/program.js`

**When starting Phase 3:** ✅ Done — NavMenu updated: `pt_editor` href `/pt_editor.html` → `/program`, label → `📋 Program Editor`

---

### Phase 4: index (future — last, structure-first split)

The main app entry. Must be migrated last because `pages/index.js` takes precedence over `public/index.html`.

**Target URL:** `/` (only possible after `public/index.html` is retired)

This phase is split by **domain ownership** per `NEXTJS_STRUCTURE.md` (page shell vs component UI vs hooks state/effects vs pure lib transforms) to reduce regression risk on the highest-traffic page.

#### Planned structure for index migration

**Page shell**
- `pages/index.js` — route shell only (auth guard, top-level state orchestration, section composition)
- `pages/index.module.css` — page layout styles only

**Components**
- `components/ExercisePicker.js` + `ExercisePicker.module.css`
- `components/SessionLoggerModal.js` + `SessionLoggerModal.module.css`
- `components/TimerPanel.js` + `TimerPanel.module.css`
- `components/HistoryPanel.js` + `HistoryPanel.module.css`
- `components/BottomNav.js` + `BottomNav.module.css`
- `components/PwaInstallPrompt.js` + `PwaInstallPrompt.module.css`

**Hooks**
- `hooks/useIndexData.js` — exercises/programs/logs loading state
- `hooks/useSessionLogging.js` — create/update log submission state machine
- `hooks/useIndexOfflineQueue.js` — queue/sync lifecycle with user-scoped keys
- `hooks/useTimerSpeech.js` — timer/counter/voice behavior

**Lib (pure functions only)**
- `lib/index-data.js` — fetch adapters + payload shaping helpers
- `lib/index-history.js` — grouping/filter/prefilter transforms
- `lib/index-offline.js` — queue/idempotency helpers

#### Phase 4a: Shell + auth + data bootstrap
- Wire `useAuth`, `AuthForm`, and `NavMenu`
- Bring over initial page bootstrap and route guards
- Keep API surface unchanged (no new routes)

#### Phase 4b: Exercise selection domain
- Port exercise list/search/select behavior into `ExercisePicker`
- Preserve current program-based loading behavior and role visibility

#### Phase 4c: Logging domain
- Port log modal + submit flow into `SessionLoggerModal` and `useSessionLogging`
- Preserve existing set/form-data permutations and idempotency behavior

#### Phase 4d: Timer/counter/speech domain
- Port rep counter, timer variants, and voice cues into `TimerPanel` + `useTimerSpeech`
- Preserve iOS-safe interaction rules (`onPointerUp`, touch-safe targets/styles)

#### Phase 4e: History + nav domain
- Port history rendering and filtering into `HistoryPanel`
- Port bottom navigation into `BottomNav`
- Include exercise-context prefilter behavior (DN-014)

#### Phase 4f: UX parity fixes during migration
- Add exercise ordering persistence behavior (DN-012)
- Resolve intermittent `Signed in as -` timing on initial load (DN-015)

#### Phase 4g: Offline/sync domain
- Port localStorage queue/sync flow into `useIndexOfflineQueue`
- Scope queue by user to prevent cross-account carryover on shared devices (DN-022 concern)
- Do not re-introduce deprecated `/api/sync` flow

#### Phase 4h: PWA/install domain
- Port service worker registration and install prompt behavior into `PwaInstallPrompt`
- Verify offline shell and install flow parity

#### Phase 4i: Cutover + retirement
- Verify preview then production parity
- Retire `public/index.html` and update routing/nav references
- Keep rollback path documented before final cutover

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
3. Say: "Continue the Next.js migration per NEXTJS_MIGRATION.md — next phase is [Phase 3: pt_editor]"

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
