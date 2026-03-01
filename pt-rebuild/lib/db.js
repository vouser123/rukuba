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
  // Create a fresh client for each request with the user's JWT
  // Pass the access token in global headers for RLS context
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  return client;
}

/**
 * Get Supabase admin client (server-only key - bypasses RLS)
 * Use ONLY for admin operations like offline queue processing
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
let supabaseAdminClient = null;

export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const SUPABASE_ADMIN_KEY =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_ADMIN_KEY) {
      throw new Error('Missing SUPABASE_SECRET_KEY (or legacy service-role env var) environment variable');
    }

    supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY);
  }
  return supabaseAdminClient;
}
