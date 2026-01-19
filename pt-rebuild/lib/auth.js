/**
 * Authentication Middleware
 *
 * Verifies JWT tokens from Supabase Auth and loads user roles.
 * Enforces patient/therapist permissions per endpoint.
 */

import { getSupabaseClient, getSupabaseAdmin } from './db.js';

/**
 * Extract and verify JWT token from Authorization header
 *
 * @param {Request} req - Incoming request
 * @returns {Promise<{user: object, role: string, error: null} | {user: null, role: null, error: string}>}
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      role: null,
      error: 'Missing or invalid Authorization header'
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const supabase = getSupabaseClient();

    // Verify JWT with Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        user: null,
        role: null,
        error: authError?.message || 'Invalid token'
      };
    }

    // Load user role from users table (using admin client to bypass RLS)
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, therapist_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return {
        user: null,
        role: null,
        error: 'User not found in database'
      };
    }

    return {
      user: {
        id: userData.id,
        auth_id: user.id,
        email: user.email,
        role: userData.role,
        therapist_id: userData.therapist_id
      },
      role: userData.role,
      error: null
    };
  } catch (error) {
    return {
      user: null,
      role: null,
      error: error.message
    };
  }
}

/**
 * Require authentication (any role)
 * @param {Function} handler - Request handler function
 * @returns {Function} - Wrapped handler with auth check
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const { user, error } = await authenticateRequest(req);

    if (error) {
      return res.status(401).json({ error });
    }

    // Attach user to request object
    req.user = user;

    // Extract and attach the access token for RLS context
    const authHeader = req.headers.authorization || req.headers.Authorization;
    req.accessToken = authHeader.substring(7); // Remove "Bearer " prefix

    return handler(req, res);
  };
}

/**
 * Require patient role
 * @param {Function} handler - Request handler function
 * @returns {Function} - Wrapped handler with patient role check
 */
export function requirePatient(handler) {
  return async (req, res) => {
    const { user, role, error } = await authenticateRequest(req);

    if (error) {
      return res.status(401).json({ error });
    }

    if (role !== 'patient') {
      return res.status(403).json({ error: 'Patient access required' });
    }

    req.user = user;

    // Extract and attach the access token for RLS context
    const authHeader = req.headers.authorization || req.headers.Authorization;
    req.accessToken = authHeader.substring(7); // Remove "Bearer " prefix

    return handler(req, res);
  };
}

/**
 * Require therapist role
 * @param {Function} handler - Request handler function
 * @returns {Function} - Wrapped handler with therapist role check
 */
export function requireTherapist(handler) {
  return async (req, res) => {
    const { user, role, error } = await authenticateRequest(req);

    if (error) {
      return res.status(401).json({ error });
    }

    if (role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    req.user = user;
    return handler(req, res);
  };
}
