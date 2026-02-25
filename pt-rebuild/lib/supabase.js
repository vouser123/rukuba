/**
 * Shared Supabase client — single instance used by all Next.js pages and hooks.
 *
 * Do NOT call createClient() anywhere else in the Next.js app.
 * All pages import { supabase } from here.
 *
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are forwarded from
 * SUPABASE_URL and SUPABASE_ANON_KEY by next.config.mjs — no extra Vercel vars needed.
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
