# PT Tracker Rebuild - Dev Practices

This guide focuses on day-to-day workflows for the Supabase/Vercel rebuild in `/pt-rebuild`.

## Working on frontend UI

- Edit HTML in `pt-rebuild/public/*.html`.
- Shared JS/CSS lives in `pt-rebuild/public/js` and `pt-rebuild/public/css`.
- Keep UI changes small and test in a browser before deploying.
- If UI changes affect PWA shell/assets, update `pt-rebuild/public/sw.js` as needed.

## Working on API routes

- Route entry points live in `pt-rebuild/api/`.
- Shared handlers live in `pt-rebuild/lib/handlers/` and should be reused to keep the function count low.
- Auth + role checks are centralized in `pt-rebuild/lib/auth.js`.
- Keep API behavior consistent and log clear errors for failures.

## Supabase access

- Use `pt-rebuild/lib/db.js` for Supabase client helpers.
- Avoid direct Supabase calls in the frontend; the frontend should go through API routes.

## Deployment checks

Before deploying to Vercel:
- Confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Vercel.
- Ensure the API route count is within the Hobby plan limit.
- Verify that new API routes are not duplicated across multiple files.

## Documentation updates

- Update `pt-rebuild/docs/` if you change architecture, routes, or data model.
- Append a dated note to `pt-rebuild/docs/DEV_NOTES.md` after each fix.

