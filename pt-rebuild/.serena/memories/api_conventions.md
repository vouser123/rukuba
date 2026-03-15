API conventions for pt-rebuild:

API shape and scope:
- Public API entry points live in C:\Users\cindi\OneDrive\Documents\GitHub\rukuba\pt-rebuild\api.
- Keep route count low to stay within Vercel Hobby/serverless limits.
- Reuse shared logic in C:\Users\cindi\OneDrive\Documents\GitHub\rukuba\pt-rebuild\lib\handlers instead of creating many new function files.
- Current route pattern includes consolidated multi-method handlers such as api/logs.js rather than one file per tiny action.

Authentication and data access:
- Frontend should not call Supabase directly for application data; it should go through API routes.
- API routes usually wrap handlers with requireAuth / requirePatient / requireTherapist / requireTherapistOrAdmin from lib/auth.js.
- Auth middleware verifies the Supabase JWT, loads the app user record from the users table, attaches req.user, and preserves req.accessToken.
- Request-scoped DB access should typically use getSupabaseWithAuth(req.accessToken) so Supabase RLS enforces access correctly.
- Use admin access only when necessary for cross-user validation, role/relationship checks, or cron-style privileged operations.

Implementation conventions seen in current routes:
- Dispatch by HTTP method inside a single default export handler.
- Validate required fields early and return JSON errors with appropriate status codes.
- Common status code pattern:
  - 400 for missing/invalid input
  - 401 for auth failures
  - 403 for permission failures
  - 404 for missing records
  - 405 for unsupported methods
  - 409 for duplicates/conflicts
  - 500 for server/database failures
- Error responses are JSON objects with an error string; details are only exposed in development for server failures.
- Validate UUID-style ids before touching the database when ids come from query/body.
- Prefer explicit role and relationship checks when behavior differs for patients, therapists, and admins.

Data integrity conventions:
- Preserve transactional behavior for clinical/logging data; the logs route uses a Postgres RPC to atomically create a log plus sets plus form data.
- Avoid index-position assumptions when relating nested payload data; prefer durable keys such as set_number.
- For batched fetches, chunk Supabase .in() queries to avoid PostgREST URL-length limits.

Special-case endpoint behavior:
- Cron/notification endpoints may bypass JWT auth and instead require a secret header/token (for example CRON_SECRET).
- Even in consolidated routes, keep special modes explicit via query params like type=messages or type=notify.

Documentation/maintenance rules from project docs:
- If architecture, routes, or data model change, update docs under pt-rebuild/docs.
- Keep API behavior consistent and log clear server-side errors for failures.
- Respect the project rule to avoid endpoint sprawl and prefer extending existing handlers when reasonable.