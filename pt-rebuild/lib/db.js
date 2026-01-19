/**
 * Supabase Client Singleton
 *
 * Provides a configured Supabase client for API endpoints.
 * Uses anon key for client-side operations (respects RLS).
 * Service key should ONLY be used for admin operations (bypasses RLS).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

// Singleton client instance
let supabaseClient = null;

/**
 * Get Supabase client (anon key - respects RLS)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Get Supabase client with user auth context (respects RLS)
 * Use this for user-initiated operations in API routes
 * @param {string} accessToken - JWT access token from Authorization header
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseWithAuth(accessToken) {
  // Create client with anon key and set global headers to pass JWT
  // This allows RLS policies to see auth.uid() correctly
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  return client;
}

/**
 * Get Supabase admin client (service key - bypasses RLS)
 * Use ONLY for admin operations like offline queue processing
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseAdmin() {
  // Supabase Vercel integration uses SUPABASE_SERVICE_ROLE_KEY
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}
