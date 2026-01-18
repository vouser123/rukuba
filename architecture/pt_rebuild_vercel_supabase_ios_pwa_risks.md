# PT rebuild — Vercel + Supabase iOS/PWA risk checklist

This document enumerates potential issues, gotchas, and edge cases to address when rebuilding the PT app using Vercel (hosting/edge) and Supabase (auth/db/storage), with special focus on iOS Safari and PWA behavior.

## PWA installability & iOS Safari quirks

- **Service worker scope mismatch**: iOS Safari is strict about scope. If the app is hosted under a subpath (e.g., `/pt/`), the service worker and manifest must be served from the same scope or higher, or installation/offline behavior fails silently.
- **Manifest caching**: iOS aggressively caches the manifest. Changes to icons, `start_url`, or `display` can take days to propagate without cache-busting. Plan a versioned manifest URL or query string.
- **Standalone mode bugs**: iOS PWAs often ignore `beforeinstallprompt` and do not show install banners. Provide explicit instructions to “Add to Home Screen”.
- **Navigation history oddities**: `history.pushState` + `back` can behave differently in standalone mode; avoid deep-link reliance without robust fallback handling.
- **WebKit storage eviction**: iOS can purge IndexedDB, Cache Storage, and LocalStorage under storage pressure. Ensure offline-first flows tolerate partial cache loss and rehydrate without crashes.
- **Uninstall / reinstall wipes data**: removing a PWA deletes local storage. The app must surface a persistent “Unsynced” banner, provide explicit sync/export actions, and warn before any sign-out/reset flows.
- **Wake lock / background throttling**: background tasks and timers are aggressively throttled on iOS. Do not rely on background sync or long-running tasks when the app is in the background or screen locked.

## Vercel hosting/edge concerns

- **Service worker caching vs. Vercel caching**: Vercel’s CDN caching can serve stale service worker files unless headers are configured to bypass cache for `sw-*.js`. Ensure `Cache-Control: no-store` (or very short TTL) for the service worker and manifest.
- **Immutable assets**: If static assets are fingerprinted, ensure the app shell references the correct hashed files so that iOS uses the latest. If not fingerprinted, iOS caching may stick to old files.
- **Edge middleware redirects**: Vercel edge middleware can create loops or subtle cache poisoning on iOS if it rewrites `start_url` or offline fallback. Test offline and cold-start flows.
- **HTTPS + certificate pinning**: PWAs require HTTPS; iOS is picky about mixed content and certificate changes. Ensure all assets are served securely and avoid HTTP references.
- **Headers for manifest + icons**: Missing `Content-Type` or incorrect caching headers on `manifest.json` and icon assets can break installability or show stale icons.

## Supabase auth & session handling

- **OAuth redirects in PWA**: iOS PWA uses `ASWebAuthenticationSession` and sometimes drops state or blocks popups. Prefer PKCE flows that work in embedded browsers and handle deep-link return URLs.
- **Cookie vs. localStorage sessions**: iOS Safari can block third‑party cookies and may evict local storage. Prefer explicit session refresh logic and avoid relying solely on cookies in iframes.
- **Refresh token persistence**: PWA standalone can lose tokens after OS cleanup. Build a resilient “re-auth” path that does not corrupt offline data.
- **Multi-tab vs. standalone**: iOS PWA runs in its own process; session state might differ from Safari. Ensure auth logic does not assume shared storage across contexts.
- **Clock skew**: iOS devices with incorrect time can cause JWT `exp` issues; add server-side checks and client-side retry logic.

## Supabase data & offline-first behavior

- **Offline write queue**: Supabase JS client is not offline-first by default. If you need offline capture, design a local queue + retry strategy, with deduplication to avoid double inserts on reconnect. Supabase does not automatically resolve offline edits without an explicit client-side queue and reconciliation policy.
- **Conflict resolution**: Concurrent edits from offline sessions can result in last-write-wins. Define deterministic conflict resolution (e.g., server timestamps + merging strategy).
- **Row-level security**: RLS rules can break offline replayed writes after auth expires. When reconnecting, make sure to refresh session and surface actionable errors.
- **Realtime & polling**: iOS background suspension can break realtime subscriptions. Ensure the app resubscribes on visibility changes and rehydrates state cleanly.
- **Large payloads**: iOS memory limits can crash heavy sync on cold start. Chunk large syncs and paginate queries.

## PWA + Supabase file uploads (if used)

- **Large uploads on iOS**: Safari has stricter memory limits; base64 encoding and large file blobs can cause crashes. Stream uploads or limit size.
- **Background uploads**: iOS may pause or cancel uploads if the app is backgrounded. Provide retry UX and avoid assuming completion after a page hide event.
- **Deferred scope**: If uploads are not in the initial rebuild, keep upload-related UI and storage rules out of scope to reduce iOS memory and background-task risk.

## Build & deployment gotchas

- **Environment variables**: Ensure Vercel has distinct env vars for preview vs. production. iOS PWA caches aggressively; use environment-aware version markers to avoid mixing endpoints.
- **Supabase URL origin changes**: Changing the Supabase project URL can invalidate stored sessions and break cached app shells; plan migration and invalidation strategy.
- **Service worker update UX**: iOS often delays SW updates until all tabs are closed. Build an update banner or “refresh available” flow that survives iOS behavior.

## Testing checklist (iOS/PWA)

- **Install PWA from Safari** and verify:
  - Cold start offline behavior
  - Token persistence after app relaunch
  - Navigation + deep links
  - Service worker update flow
- **Network transitions**: airplane mode → online; ensure no data loss and no double inserts.
- **Storage eviction simulation**: clear Safari website data and validate recovery.
- **Multiple devices**: test iPhone + iPad; PWA behaviors can differ.

## Rebuild requirements confirmed

1. All pages that currently work must continue to work offline in the rebuilt iOS PWA (no read-only carveouts).
2. Data loss is not acceptable; offline edits must be preserved and reliably reconciled once connectivity returns.
3. File uploads are out of scope for the initial rebuild; plan for later support but do not ship upload flows now.
4. Realtime updates are desirable; if realtime is unstable on iOS backgrounding, use foreground rehydration and resubscribe logic.

## UX requirements (menus + recovery)

- **Reload button on every page**: Each PWA page must include a visible reload action to refresh the view, recover from stale state, and rehydrate after storage eviction or reinstall. This is required due to prior data loss caused by PWA removal/reinstall and to give users a reliable recovery path.
- **Consistent hamburger menu**: Each page should use the same hamburger menu design and slide‑out behavior across all pages, with identical structure, labels, and interaction rules to avoid divergent navigation patterns.

### Reference implementation (new rebuild, not based on existing HTML)

Use this baseline markup, styles, and behavior for the menu and reload action in every page. Adjust labels and links as needed, but keep the structure and interaction rules consistent.

```html
<header class="app-header">
  <button class="menu-button" id="menuButton" aria-label="Open menu" aria-controls="appMenu" aria-expanded="false">
    ☰
  </button>
  <h1 class="app-title">PT</h1>
  <button class="reload-button" id="reloadButton" aria-label="Reload page">↻</button>
</header>

<nav class="app-menu" id="appMenu" aria-hidden="true">
  <div class="menu-backdrop" id="menuBackdrop"></div>
  <div class="menu-panel" role="menu">
    <a role="menuitem" href="/pt/tracker">Tracker</a>
    <a role="menuitem" href="/pt/coverage">Coverage</a>
    <a role="menuitem" href="/pt/report">Report</a>
    <a role="menuitem" href="/pt/view">View</a>
  </div>
</nav>
```

```css
.app-header {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #111827;
  color: #fff;
}

.menu-button,
.reload-button {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #1f2937;
  color: #fff;
  font-size: 18px;
}

.app-menu[aria-hidden="true"] {
  display: none;
}

.app-menu {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.menu-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.menu-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 80%;
  max-width: 280px;
  height: 100%;
  background: #111827;
  color: #fff;
  padding: 16px;
  display: grid;
  gap: 12px;
  transform: translateX(-100%);
  transition: transform 160ms ease-out;
}

.app-menu[data-open="true"] .menu-panel {
  transform: translateX(0);
}

.menu-panel a {
  color: #fff;
  text-decoration: none;
  padding: 8px 0;
}
```

```js
/**
 * Bind shared menu + reload interactions for all pages.
 * Use pointerup for iOS touch reliability.
 */
function bindGlobalChrome() {
  const menu = document.getElementById("appMenu");
  const menuButton = document.getElementById("menuButton");
  const menuBackdrop = document.getElementById("menuBackdrop");
  const reloadButton = document.getElementById("reloadButton");

  function openMenu() {
    menu.dataset.open = "true";
    menu.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.dataset.open = "false";
    menu.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
  }

  menuButton.addEventListener("pointerup", () => {
    const isOpen = menu.dataset.open === "true";
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  });

  menuBackdrop.addEventListener("pointerup", closeMenu);

  reloadButton.addEventListener("pointerup", () => {
    window.location.reload();
  });

  closeMenu();
}

document.addEventListener("DOMContentLoaded", bindGlobalChrome);
```
