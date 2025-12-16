# Next-Step Suggestions for the PT Tracker

The latest commit adds library management and event logging, but a few improvements would help address the user feedback about visibility, reliability, and atlas parity.

1. **Make “Pocket Tap” the default during active sets** – auto-expand the full-screen tap target when a set starts, with a single on-screen exit affordance and voice/large-text confirmations so the user can safely interact without looking.
2. **Louder guidance on remaining work** – add a persistent top banner that speaks and shows remaining reps/holds/sets with large numerals and brief haptic cues for thresholds (e.g., last 3 reps, final set) to answer “How will I know what’s left?”
3. **Atlas parameter coverage** – normalize exercise types so AMRAP, distance, duration, and hold-based prescriptions are parsed the same way and rendered with tailored controls (distance meter, countdown/stopwatch, rep counter with optional hold per rep). Validate user edits against these schemas before saving.
4. **Revision history you can browse** – surface a per-exercise timeline that highlights superseded dosage, who/when, and notes, instead of just storing revisions silently. Keep session snapshots linked to the revision ID used when the set was performed.
5. **Event-to-exercise insights** – in the functional event timeline, add chips for linked exercises and a quick “open session log around this timestamp” action so events are actionable, not just stored.
6. **Onboarding and guardrails** – add a short in-app checklist for setup (favorite key exercises, review atlas defaults, enable haptics/voice), plus safety copy to prevent accidental swipes/archives while in the pocket mode.

These suggestions prioritize safer eyes-free use, clearer remaining-work feedback, and closer alignment with the atlas data the user referenced.
