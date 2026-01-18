# PT Tracker Rebuild

Physical Therapy Exercise Tracker - Rebuilt from scratch with Supabase + Vercel.

## Environment Setup

**IMPORTANT: Keep your API keys outside of the GitHub folder.**

1. Copy `.env.example` to a location **outside this repository** (e.g., `C:\Users\cindi\Documents\pt-rebuild-secrets\.env`)
2. Fill in your actual Supabase credentials
3. When running locally, symlink or copy the `.env` file into this directory (it's gitignored)

### Required Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

## Migration

Run the database migration:

```bash
SUPABASE_SERVICE_KEY=your-key npm run migrate
```

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

**Note:** Set environment variables in Vercel dashboard under Project Settings → Environment Variables.
