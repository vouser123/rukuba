# File Structure Guidelines

Authoritative rules for `pt-rebuild/` code organization. Apply to all Next.js pages. Do not re-evaluate these decisions per session.

**Loaded by:** `AGENTS.md`, `NEXTJS_MIGRATION.md`

---

## Size Limits

| File type | Aim | Hard cap | At cap: required action |
|-----------|-----|----------|------------------------|
| Page (`pages/*.js`) | 350L | 500L | Extract an inline component before adding more code |
| Component (`components/*.js`) | 200L | 300L | Split into two components before adding more code |
| Hook (`hooks/use*.js`) | 100L | 150L | Split by concern before adding more code |
| Lib (`lib/*.js`) | 300L | 450L | Apply cohesion check (below) before adding more code |
| CSS Module (`*.module.css`) | 350L | 500L | Extract the component that owns the large CSS section |
| `styles/globals.css` | — | 100L | Hard stop — CSS variables + reset only, no exceptions |

**At or above cap:** Must resolve before adding more code. No exceptions.

**Between aim and cap:** Acceptable. Take no action.

**When no clean split exists:** Do not violate the cap unilaterally. Surface to the user: state the file size, the cap, and why no clean split is apparent. Wait for a decision.

---

## Core Principle (Why These Rules Exist)

One file = one complete concern — not one file = smallest possible file. When an agent makes a change, it loads every file needed to understand the context. Two files that are always loaded together are worse than one moderate file. The right split is along true domain boundaries: things used independently belong in separate files; things always loaded together belong in one file. Caps exist to catch files that have grown beyond one concern, not to force artificial fragmentation.

---

## Cohesion Check (Apply Before Any Split)

**Filename domain test:** Before adding a function to an existing file or before splitting a file, ask:

> "Would I need to rename this file to accurately describe what it contains after adding this?"

- If **yes** → the addition does not belong here. Place it in a different file.
- If **no** → the file is still one domain. Continue.

**File header comment is a contract:** Every file must have a 1-line header comment describing its domain. The comment must accurately reflect the file's actual contents. If writing the comment would require joining two different feature areas, the file must be split.

| Header comment | Verdict |
|----------------|---------|
| `// lib/pt-view.js — fetches logs, programs, messages; transforms for display` | ✓ commas OK — all pt-view data |
| `// lib/pt-view.js — fetches pt-view data, handles email sending` | ✗ email ≠ pt-view domain → move `sendEmail` to `lib/email.js` |
| `// lib/pt-view.js — pt-view AND email data` | ✗ two domains — split |
| `// lib/pt-view.js — general data utilities` | ✗ vague — avoids the test; must rewrite the comment to be accurate or split |

---

## Split Decision Rules (Apply in Order)

1. **Is a cap violated?** → Must split (or surface to user if no clean split)
2. **Does the cohesion check fail?** → Must split regardless of size
3. **Would the split pieces always be loaded together?** → Do NOT split (artificial fragmentation)
4. **Is the file under cap and cohesion OK?** → Do not split

Do not split to reach the aim number. A 350L lib covering one domain is correct. A 150L lib mixing two domains must split.

---

## Import Layer Rules

| Layer | May import from |
|-------|----------------|
| `pages/` | `components/`, `hooks/`, `lib/`, own CSS module |
| `components/` | own CSS module only — all data arrives via props |
| `hooks/` | `lib/` only |
| `lib/` | `lib/supabase.js`, `lib/utils.js` only — no React, no hooks, no other lib files |
| `styles/globals.css` | nothing |

An import outside these rules signals misplaced responsibility. Fix the placement, not the import.

---

## Folder Structure

```
pt-rebuild/
├── pages/              # Next.js pages — one file per route
│   ├── _app.js         # Global wrapper — do not modify except to add global imports
│   ├── rehab.js        # /rehab — Coverage Analysis (Phase 1)
│   ├── pt-view.js      # /pt-view — History Dashboard (Phase 2)
│   └── *.module.css    # CSS Module for its page — lives here, not in styles/
│
├── components/         # UI components — shared or self-contained (modals, nav)
│   ├── NavMenu.js      # Used on every page
│   ├── AuthForm.js     # Used on every page
│   ├── [Name].js
│   └── [Name].module.css  # CSS Module lives next to its component
│
├── hooks/              # Custom React hooks — state + effects, no JSX
│   ├── useAuth.js      # Used on every page (session management)
│   └── use[Name].js
│
├── lib/                # Pure data functions — no React, no hooks
│   ├── supabase.js     # Supabase client singleton — only place createClient() is called
│   ├── rehab-coverage.js   # Data functions for /rehab
│   ├── pt-view.js      # Data functions for /pt-view
│   └── utils.js        # Cross-domain utilities (date formatting, etc.)
│
├── styles/
│   └── globals.css     # CSS variables + reset ONLY — no component styles
│
├── api/                # Vercel serverless functions — DO NOT MODIFY during migration
├── public/             # Legacy HTML — being retired one page at a time
└── docs/               # Documentation — not loaded at runtime
```

**Placement decisions:**
- New UI piece with state or reuse → `components/`; otherwise inline in page (if < 40L, no state, page-only)
- New data function → `lib/[domain].js`
- New state + effects logic reused ≥2 pages → `hooks/use[Name].js`; otherwise inline in page if ≤20L
- New styles → CSS Module next to the JS file it belongs to; CSS variables → `styles/globals.css` only

---

## Pages (`pages/`)

**Aim: 350L. Hard cap: 500L.**

**Contains:**
- `useAuth()` call + auth guard
- `useEffect` for initial data load
- Page-level `useState` (filters, loading, error, data)
- JSX layout: header, main sections, modal invocations
- Small inline sub-components meeting the inline rule below

**Must not contain:** business logic, API calls, or hooks with complex state — those go in `lib/` and `hooks/`.

**Inline sub-component rule.** A function like `function PatientNotes({ ... })` may stay in the page file only if ALL four conditions are met:
1. Used only on this one page
2. Has no state of its own (reads parent state via props only)
3. < 40 lines of JSX
4. Its CSS is < 30 lines in the page CSS module

If any condition is false → extract to `components/`.

| Example | Decision |
|---------|----------|
| `function SummaryStats({ totalSets })` — 15L JSX, no state, page-only | ✓ stay inline |
| `function PatientNotes({ notes })` — has own `isCollapsed` state | ✗ extract to `components/PatientNotes.js` |
| `function HistoryList({ logs })` — 80L JSX | ✗ extract (over 40L limit) |

---

## Components (`components/`)

**Aim: 200L. Hard cap: 300L.**

**Always extract (no exceptions):**
- Any modal or overlay
- Any UI used on ≥2 pages or ≥2 components
- Any JSX block with its own state (`useState`/`useEffect`)

**File naming:** PascalCase noun — `MessagesModal.js`, `NavMenu.js`

**Must have:** paired `ComponentName.module.css` in the same folder.

**Must not contain:** API calls, business logic, or calculations. All data arrives via props.

---

## Hooks (`hooks/`)

**Aim: 100L. Hard cap: 150L.**

**One concern per file.** `useAuth` = auth only. `useMessages` = messages only. Never merge two unrelated concerns.

**File naming:** `use` + PascalCase concern — `useAuth.js`, `useMessages.js`

**Required patterns:**
- Cleanup on unmount: return a cleanup function from any `useEffect` that sets an interval, listener, or subscription
- `localStorage` reads in `useState` initializer (not `useEffect`) with `typeof window !== 'undefined'` guard
- Return a named object (`{ messages, send, archive }`), not a bare array

---

## Lib (`lib/`)

**Aim: 300L. Hard cap: 450L.**

**Pure functions only.** No React imports, no hooks, no side effects outside the returned value.

**One domain per file.** When a lib file hits its cap, apply the cohesion check: if all functions are one domain (e.g., all rehab coverage), add `// NOTE: cohesive domain — [N] functions all serve [domain]` and document the decision. Only split if sub-domains exist and would be loaded independently:
- API fetchers: `lib/[domain]-data.js`
- Pure calculations: `lib/[domain]-calc.js`

**API call signature:** Always `(token, ...args)`. Never read session from a global or closure.

**File naming:** kebab-case domain — `pt-view.js`, `rehab-coverage.js`

---

## Styling

**Aim: 350L. Hard cap: 500L per CSS Module.**

**A growing CSS module is a symptom, not the problem.** The fix is to extract the component that owns the large CSS section — the CSS moves with the component. Do not split a CSS file without also extracting its component: that creates orphaned styles with no owner.

| Action | Verdict |
|--------|---------|
| Create `pt-view-notes.module.css`, move notes styles | ✗ orphaned CSS — no component owner |
| Extract `components/PatientNotes.js` + `components/PatientNotes.module.css` | ✓ CSS and component move together; page CSS module shrinks naturally |

**`styles/globals.css`:** CSS variables + reset only. Hard cap 100L. No component or layout styles.

**CSS Module placement:** Next to its JS file in the same folder.

**Dark mode:** `@media (prefers-color-scheme: dark)` blocks in each CSS Module. No separate dark files, no JS toggling.

**Class naming:** `styles['hyphenated-name']` or `styles.camelCase`. Conditional: `` `${styles.base} ${condition ? styles.active : ''}` ``. Inline styles only for dynamically computed values.

---

## Shared Code Rule

**Used in ≥2 places → extract immediately.**

| Used in | Extract to |
|---------|-----------|
| ≥2 pages | `components/` (UI), `lib/` (logic), or `hooks/` (state) |
| ≥2 components | `components/` (UI) or `lib/` (logic) |
| 1 place only | Stay inline until second use |

Extract on the second use, not the third.

---

## File Header Comments (Required)

Every file in `pages/`, `components/`, `hooks/`, and `lib/` must start with a 1-line comment:

```js
// lib/pt-view.js — pure data functions for the pt-view history dashboard
// components/MessagesModal.js — slide-up messages panel with compose and archive
// hooks/useMessages.js — polls for messages every 30s; send, archive, markRead
```

Commas listing same-domain operations are fine. The comment is a domain contract — it must accurately describe the file's actual contents. Scan the first line to determine a file's domain without loading the full file.

---

## Decision Examples

**Adding a function to lib:**
- Adding `sendEmailNotification()` to `lib/pt-view.js` → ✗ wrong file; email ≠ pt-view data domain → create `lib/email.js`
- Adding `computeDaysStreak()` to `lib/pt-view.js` → ✓ correct; it's a pt-view data transformation

**Extracting a component:**
- `PatientNotes` section in `pt-view.js`: 60L JSX with own expand/collapse state → ✗ not inline-eligible (has state + over 40L) → extract to `components/PatientNotes.js` + `PatientNotes.module.css`

**When NOT to split:**
- `MessagesModal.js` (183L) contains list, compose, and archive undo — ✗ do not split into three files; they are always loaded together; one file is correct
- Apply Split Decision Rule 3: would split pieces always be loaded together? Yes → keep as one file

**Reuse trigger:**
- Inline `useLocalFilter` hook (15L) exists in `pt-view.js`; Phase 3 `pt-editor.js` needs the same logic → extract to `hooks/useLocalFilter.js` immediately on second use

---

## Function Naming

Exported functions: verb + noun.
- `fetchLogs` not `getLogs` or `logs`
- `computeSummaryStats` not `getSummaryStats`
- `applyFilters` not `filter`
- `groupLogsByDate` not `groupLogs`

Internal helpers may be shorter: `toLabel`, `isUrgent`.

---

## Event Handlers

**`onPointerUp` not `onClick` for interactive elements.** iOS Safari requirement — non-negotiable. Applies to: buttons, card taps, overlay close handlers, divs acting as buttons.

Correct for non-touch targets:
- `onChange` on `<input>`, `<select>`, `<textarea>`
- `onKeyDown` for keyboard shortcuts (e.g., Enter-to-send)

---

## What Must Not Happen

- `window.*` globals — use props, hooks, or module constants
- `createClient()` outside `lib/supabase.js`
- `useRef` for DOM manipulation that CSS or state can handle
- Redux, Zustand, or React Context — session is managed by Supabase
- TypeScript
- `console.log` in committed code
- Splitting a CSS file without extracting the corresponding component

---

## Required Fixes — Files Currently Over Cap

These files were written before this document existed and are out of compliance. They must be brought within cap before they are extended with new features. This is a separate task from creating this document.

| File | Lines | Cap | Fix |
|------|-------|-----|-----|
| `lib/rehab-coverage.js` | 588 | 450L | Apply cohesion check: if all functions serve one domain, add `// NOTE: cohesive domain` comment; if two independent sub-domains exist, split into `rehab-coverage-data.js` + `rehab-coverage-calc.js` |
| `pages/pt-view.module.css` | 670 | 500L | Extract inline sections (PatientNotes, NeedsAttention, SummaryStats, FiltersPanel, HistoryList) as components — each takes its CSS block; page CSS module shrinks naturally |
| `pages/rehab.module.css` | 478 | 500L | Extract inline section components; CSS follows the component |
| `pages/pt-view.js` | 440 | 500L | Within cap — no action until component extractions above are done (file will shrink) |
| `pages/rehab.js` | 452 | 500L | Within cap — no action until component extractions above are done |
