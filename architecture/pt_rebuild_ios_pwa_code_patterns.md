# PT Rebuild — iOS/PWA Code Patterns (Reference Implementations)

This document provides **self-contained reference implementations** for iOS/PWA‑safe patterns that historically required multiple iterations to behave reliably. These are **examples** for the rebuild and can be adapted, but the interaction and safety semantics should remain consistent.

---

## 1. Pointer‑safe event binding (iOS Safari/PWA)

Use `pointerup` for touch reliability and keyboard support for accessibility.

```html
<button data-action="save-session" class="primary">Save</button>
```

```js
/**
 * Bind pointer and keyboard handlers for elements that declare data-action.
 * Avoids unreliable click handlers on iOS Safari/PWA.
 */
function bindActionHandlers(root = document) {
  const actionElements = root.querySelectorAll("[data-action]");

  actionElements.forEach((el) => {
    const actionName = el.getAttribute("data-action");

    el.addEventListener("pointerup", (event) => {
      event.preventDefault();
      handleAction(actionName, event);
    });

    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleAction(actionName, event);
      }
    });
  });
}

/**
 * Centralized action dispatcher for UI events.
 * Replace with a map of handlers as needed.
 */
function handleAction(actionName) {
  if (actionName === "save-session") {
    queueMutation({ type: "save_session" });
  }
}
```

---

## 2. Offline mutation queue envelope (client)

Define a stable, idempotent envelope for offline writes. `device_id` should be the UUID assigned when registering the device.

```json
{
  "mutation_id": "2b9db87b-7071-4f3e-8f12-5638f09f0e91",
  "device_id": "d4f1c9a1-1a1b-4a6f-8f2e-5e4b79a4c2d3",
  "user_id": "f5b7a54c-cc0b-4c79-8c9d-dc7d4a92f8e9",
  "entity_type": "session_set",
  "entity_id": "4d9c0f6c-2e2d-44c1-8a91-1c96d93f3b0a",
  "client_timestamp": "2026-05-20T14:07:11.220Z",
  "base_version": "v17",
  "payload": {
    "session_id": "5abf0c7e-3f6c-4e52-9f6b-2e9c6b2c3a9a",
    "reps_achieved": 12,
    "side": "left",
    "form_params": {
      "example_param": "value"
    }
  }
}
```

---

## 3. Queue processing with strict order + idempotency

Ensure ordered replay and a hard stop on conflict/validation failures.

```js
/**
 * Process queued mutations in strict order.
 * Halt on validation or conflict to avoid data loss.
 */
async function processQueue(queue) {
  for (const mutation of queue) {
    const result = await sendMutation(mutation);

    if (result.status === "conflict" || result.status === "invalid") {
      surfaceSyncError(mutation, result);
      break;
    }
  }
}
```

---

## 4. Visibility‑based resubscribe + rehydrate (iOS background)

iOS often suspends realtime channels; resubscribe on foreground.

```js
/**
 * Rehydrate and resubscribe when app returns to foreground.
 * Guarantees current state even if backgrounded.
 */
function bindVisibilitySync() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resubscribeRealtimeChannels();
      refreshLatestState();
    }
  });
}
```

---

## 5. Service worker registration with versioned cache busting

Use versioned file names (or a query param) and force a check on load.

```js
/**
 * Register the service worker and prompt users when a new version is ready.
 */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.register("/sw-pt.js?v=2026-05-20");
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }
    });
  });
}
```

---

## 6. Manual reload action for recovery

Every page must provide a visible reload action.

```html
<button class="reload-button" data-action="reload">Reload</button>
```

```js
/**
 * Standardized reload behavior for recovery after reinstall/storage eviction.
 */
function bindReloadButton() {
  document.querySelectorAll("[data-action='reload']").forEach((button) => {
    button.addEventListener("pointerup", () => {
      window.location.reload();
    });
  });
}
```
