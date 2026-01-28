# PT Tracker Rebuild - Phase 1 Estimate

Goal: deliver the baseline PT tracker workflow on Supabase with minimal operational overhead.

## Scope (Phase 1)

1. **Exercise management**
   - View, add, edit, and archive exercises.
   - Maintain equipment, muscles, modifiers, form parameters, guidance, and roles.

2. **Program management**
   - Assign exercises to patients with dosage (sets/reps/seconds/distance).
   - Allow therapists to update prescriptions.

3. **Activity logging + history**
   - Record activity logs with per-set metrics and form data.
   - View history and last-completed summaries.

4. **PT visibility**
   - Ensure therapists can view assigned patients’ programs and logs.

## Risks / dependencies

- Supabase RLS policies must align with API role checks.
- Vercel Hobby plan limits serverless function count; keep routes consolidated.
- Frontend and API must agree on schema field names.

## Out of scope

- Advanced analytics/visualizations.
- Push notifications or reminders.
- Multi-tenant organizations.
