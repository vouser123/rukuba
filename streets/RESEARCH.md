# Streets App — Large Text Accessibility Research

## Purpose
Reference for implementing Safari 300% text enlargement support in `streets/index.html`.
Compiled 2026-03-26. Sources: Apple developer docs, web.dev, WCAG, agent web research.

---

## 1. What "300% Text Enlargement" Actually Means on iOS Safari

### Two distinct mechanisms — behave very differently

| Mechanism | Range | CSS override possible? | Who controls it |
|-----------|-------|------------------------|-----------------|
| **iOS Accessibility › Larger Text** (Dynamic Type) | Up to ~310% in accessibility sizes | No — browser ignores it for web by default | System-wide |
| **Safari AA button** (per-site font size, iOS 16+) | 50% – 300% | No — Safari forces it at browser level | User, per site |
| **Pinch-to-zoom** | Unlimited | No — user-controlled | User |

**Key fact:** The Safari AA button cannot be blocked by CSS. It changes the root font size at the browser engine level. If your CSS uses `rem` or `em`, everything scales. If it uses `px`, those values do not scale.

### What `-webkit-text-size-adjust: 100%` does and does NOT do
- **Does:** Disables Safari's *automatic* text inflation algorithm (triggered by double-tap or narrow columns)
- **Does NOT do:** Block the AA button, pinch zoom, or iOS Accessibility Larger Text
- **`100%` vs `none`:** `100%` = scale at 100% (no auto-inflation). `none` = disable entirely. Both are similar in practice on modern iOS. `100%` is the conventional safe choice.
- **`none` risk:** On older iOS Safari, `none` could disable user scaling. Avoid.

### Dynamic Type on web (opt-in only)
iOS Larger Text (Dynamic Type) does NOT apply to web pages by default. To opt in:
```css
@supports (font: -apple-system-body) {
  html { font: -apple-system-body !important; }
}
```
Caveat: Desktop Safari interprets `-apple-system-body` as 13px — use UA detection or `@supports` guard.

---

## 2. Apple Requirements for Larger Text Support

Source: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/

### Minimum threshold
- **iOS/iPadOS:** Must support text enlargement to at least **200%** of default
- **Recommended:** Support as large as possible, ideally **300%+**

### What Apple looks for
- Text wraps to multiple lines instead of truncating
- Layout reflows (horizontal → vertical when needed)
- No overlapping text
- No content clipped by container boundaries
- Primary content remains accessible (action buttons, main UI)
- Works in both portrait AND landscape

### Acceptable tradeoffs
- Navigation bars / tab bars may stay smaller to preserve screen space
- Use Large Content Viewer for small non-scalable elements
- Text may wrap to more lines — that's expected and acceptable
- Users at large sizes expect to scroll more

### Fails criteria
- Text cannot reach 200%+
- Overlapping text
- Excessive truncation that hides meaning
- Layout breaks horizontally (requires horizontal scroll for primary tasks)
- Relies on system Zoom/Hover Text to function

### Two valid implementation paths
1. **Dynamic Type** (native apps, or web with `-apple-system-body` opt-in)
2. **Custom in-app font size control** — must detect + respect system settings, or provide equivalent range

---

## 3. WCAG Requirements (Relevant Criteria)

### 1.4.4 Resize Text (Level AA)
- Text must be resizable to **200%** without loss of content or functionality
- On mobile, met by pinch-to-zoom + AA button (if not disabled)
- `user-scalable=no` in viewport meta **FAILS** this criterion — never use it

### 1.4.10 Reflow (Level AA)
- Content must reflow without horizontal scrolling at **320 CSS px viewport width**
- Equivalent to 400% zoom on a 1280px desktop
- Test: does the page work at 320px wide with no horizontal scroll?
- Exceptions: data tables, maps, complex toolbars
- **This is the most relevant criterion for this app** — the app must work at 320px width

### Touch target minimum
- 48×48 CSS px for all interactive controls (web.dev / Material guidance)
- WCAG 2.5.5 Target Size: 44×44 CSS px (Level AAA)

---

## 4. CSS Best Practices for Large Text

### Use `rem` for font sizes
- `rem` = root element (`html`) font size — scales when root font changes
- `px` = fixed, does NOT scale with AA button or `rem`-based scaling
- `em` = relative to parent — useful for component-level scaling

### Setting root font size for in-app scaling
```js
// Correct: sets html font-size, so rem scales
document.documentElement.style.fontSize = `${18 * scale}px`;
```
(This is what the current om/streets code already does correctly.)

### Don't fight the AA button
If a user has Safari AA at 300%, their root font is 3x. If you also have `documentElement.style.fontSize = "54px"`, the interaction is:
- Safari AA sets its own scale on top of the CSS
- This can result in double-scaling
- **Safest approach:** let the AA button work, and design layouts that handle the result (scroll, reflow)

### Fluid layout rules
- No fixed-width containers (use `max-width: 100%`, `min(Xpx, 100%)`)
- No `overflow: hidden` that clips content — use `overflow-x: hidden` only on body-level
- `overflow-y: auto` on scrollable containers
- `word-break: break-word` / `overflow-wrap: anywhere` on text that could overflow

### Viewport height
- Use `dvh` (dynamic viewport height) instead of `vh` for full-height elements on iOS
- `100dvh` accounts for Safari address bar show/hide
- Fallback: `100vh` for browsers that don't support `dvh`

---

## 5. Modal Dialogs at Large Text Sizes

### Critical rules
1. **Never fixed height** on modal content — use `max-height: min(90dvh, 90vh)` with `overflow-y: auto`
2. **Sticky modal header** — at large text, header scrolls out of view. Make it `position: sticky; top: 0;` with a background color so Close button is always reachable
3. **Body scroll lock on iOS** — `overflow: hidden` on body does NOT work in iOS Safari. Use:
   ```js
   // On open:
   document.body.style.position = "fixed";
   document.body.style.top = `-${window.scrollY}px`;
   // On close:
   const scrollY = document.body.style.top;
   document.body.style.position = "";
   document.body.style.top = "";
   window.scrollTo(0, -parseInt(scrollY || "0"));
   ```
4. **`aria-modal="true"`** on `<dialog>` — tells screen readers content outside is inert
5. **Focus management** — move focus to heading (tabindex="-1") on open, restore to trigger on close
6. **`inert` on background** — set `inert` attribute on main content when modal is open

---

## 6. VoiceOver and TalkBack Readiness

### Minimum requirements for "functional"
- All interactive elements reachable by swipe navigation
- Meaningful labels on all buttons and inputs (aria-label, aria-labelledby, visible label)
- No focus traps (except modal — that's intentional)
- Screen reader doesn't read decorative elements (aria-hidden="true" on icons/emojis)
- Dynamic changes announced via aria-live regions
- Modal open/close focus managed correctly

### Common failures
- Radio/checkbox groups without fieldset+legend (or role="group" + aria-label)
- Icon-only buttons without aria-label
- Emoji in button text that screen readers read out (wrap in aria-hidden span)
- Content that changes visually but no live region announcement
- Modals that don't trap focus

### iOS VoiceOver specifics
- Swipe right = next focusable element
- Double-tap = activate
- Focus order = DOM order (not visual order)
- Elements with `aria-hidden="true"` are skipped
- `<dialog>` with `aria-modal="true"` traps VoiceOver within the dialog

---

## 7. Current `streets/index.html` Architecture Summary

### How text scaling works (Codex implementation)
```js
// applyA11ySettings() sets:
document.documentElement.style.fontSize = `${18 * getTextSizeScale(size)}px`;
// getTextSizeScale: default=1, large=1.15, largest=1.3, huge=1.5
// Result: 18px, 20.7px, 23.4px, 27px
```
All CSS uses `rem` so scales with this. ✓

### `phone-safe-layout` class
Applied when: `coarsePointer || viewportWidth <= 430 || viewportHeight <= 500 || textSize in ["largest","huge"]`
Provides: full-width buttons, stacked modal header, 2-column sound-option grid, proper modal padding.

### `-webkit-text-size-adjust: 100%` on body
Disables auto-inflation. Does NOT block AA button or pinch zoom. ✓ (safe to keep)

### Gaps to fix for 300% requirement
1. **Text size picker max is 1.5x (27px)** — need 2x, 2.5x, 3x options
2. **`largeTextLayout` check** misses new sizes — won't trigger `phone-safe-layout` on desktop at xl/xxl/max
3. **Modal header is not sticky** — Close button scrolls out of view at large text
4. **`textSizeLandscapeHint`** only shows for "huge" — needs to cover larger sizes too

---

## 8. Recommended Changes for `streets/index.html`

### A. Extend text size options to 300%
```html
<!-- HTML: add to select -->
<option value="xl">Extra Large (200%)</option>
<option value="xxl">Extra Extra Large (250%)</option>
<option value="max">Maximum (300%)</option>
```
```js
// JS: getTextSizeScale additions
if (size === "xl") return 2;
if (size === "xxl") return 2.5;
if (size === "max") return 3;
```

### B. Update layout triggers
```js
// In applyLayoutMode():
const LARGE_SIZES = ["largest", "huge", "xl", "xxl", "max"];
const largeTextLayout = LARGE_SIZES.includes(a11ySettings.textSize);
```

### C. Sticky modal header (Close always reachable)
```css
body.phone-safe-layout .modal-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface);
  border-bottom: 1px solid var(--divider);
  padding-bottom: 12px;
  /* existing: flex-direction: column; align-items: stretch; */
}
```

### D. Landscape hint for all large sizes
```js
// In applyA11ySettings():
textSizeLandscapeHint.hidden = !["huge","xl","xxl","max"].includes(a11ySettings.textSize);
```

---

## 9. Sources

- Apple Larger Text Criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/
- Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility (requires JS)
- Safari Web Content — Adjusting Text Size: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
- Safari Viewport Guide: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/UsingtheViewport/UsingtheViewport.html
- web.dev Accessible Responsive Design: https://web.dev/articles/accessible-responsive-design
- WCAG 1.4.4 Resize Text: https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html
- WCAG 1.4.10 Reflow: https://www.w3.org/WAI/WCAG21/Understanding/reflow.html
