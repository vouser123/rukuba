Conventions from pt-rebuild/AGENTS.md:

- Use a docs-first workflow and check canonical references before editing code.
- Do not invent new field names when existing vocabulary/schema terms exist.
- Prefer plain JavaScript and browser APIs unless explicitly instructed otherwise.
- Preserve offline/PWA behavior and iOS-safe interaction patterns.
- Respect Vercel/serverless limits; prefer extending existing handlers over endpoint sprawl.
- For iOS/PWA interactions: use touch-action: manipulation, pointerup instead of onclick, transparent tap highlight, and 44px minimum touch targets.
- If guidance conflicts within pt-rebuild, AGENTS.md is the operational source of truth.

Tracking conventions:
- Use Beads for NextJS migration/workstream items.
- Use pt- prefixed Beads IDs.
- Include Beads issue IDs in commit messages in parentheses.
- Claim Beads issues before implementation in multi-agent workflows.