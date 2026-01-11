# Phase 1: Stabilize Firebase Sync - Estimate

**Source:** pt/docs/DEVELOPMENT.md Roadmap section
**Status:** Planned (not yet started)

---

## Phase 1 Requirements

From DEVELOPMENT.md Phase 1 readiness checklist:

1. **Conflict rules documented** - Document precedence for Firestore sessions vs local cache, runtime snapshots vs shared data
2. **Offline auth behavior defined** - Define UI behavior when Firebase auth unavailable offline
3. **Offline launch validated** - Ensure PWA opens offline without fatal errors
4. **Error surfacing** - Clear user messages for auth and sync failures

### Additional Work (from description):
- Solidify conflict handling between local edits and Firestore updates
- Improve offline auth UX and error surfacing
- Define explicit source-of-truth rules for runtime vs shared data

---

## Scope Breakdown

### Task 1: Document Conflict Resolution Rules
**Files:** `pt/docs/DEVELOPMENT.md`
- Document: "Firestore sessions are authoritative when authenticated"
- Document: Runtime snapshots vs shared data precedence
- Document: Local cache is fallback only when unauthenticated
- Apply same rules consistently across all pages

**Estimate:** 5,000 tokens, 15 minutes

### Task 2: Implement Conflict Handling
**Files:** `pt/pt_tracker.html`, `pt/rehab_coverage.html`, `pt/pt_report.html`
- Add conflict detection between local edits and Firestore updates
- Implement precedence rules (Firestore wins when authenticated)
- Handle runtime snapshot conflicts with shared data
- Add logging for conflict resolution decisions

**Estimate:** 15,000 tokens, 45 minutes

### Task 3: Define & Implement Offline Auth UX
**Files:** All PT pages (`pt_tracker.html`, `rehab_coverage.html`, `pt_report.html`, `pt_view.html`)
- Define behavior: show read-only local cache vs require sign-in
- Implement offline auth state detection
- Add UI indicators for offline/authenticated/unauthenticated states
- Show appropriate messages to user

**Estimate:** 12,000 tokens, 35 minutes

### Task 4: Improve Error Surfacing
**Files:** All PT pages
- Review all auth failures - ensure user-facing alerts
- Review all sync queue failures - ensure user-facing alerts
- Add error details (not just "failed" but explain why)
- Test error messages on actual devices

**Estimate:** 8,000 tokens, 25 minutes

### Task 5: Validate Offline Launch
**Files:** `pt/sw-pt.js`, all PT HTML pages
- Test cold offline launch on iOS Safari/PWA
- Fix any `FetchEvent.respondWith` errors
- Ensure cached HTML serves correctly
- Test on both iOS and desktop

**Estimate:** 6,000 tokens, 20 minutes

---

## Total Estimate

**Tokens:** 46,000 - 55,000
**Time:** 2.5 - 3 hours
**Files Modified:** 5-6 files

---

## Success Criteria

- [ ] Conflict rules documented in DEVELOPMENT.md
- [ ] Firestore precedence enforced in all pages
- [ ] Offline auth behavior defined and documented
- [ ] User sees clear error messages for auth/sync failures
- [ ] PWA opens offline without fatal errors
- [ ] Tested on iOS Safari/PWA and desktop

---

## Non-Goals (per DEVELOPMENT.md)

- Replacing email-based V2 exchange entirely
- Removing JSON fallback for shared data
