/**
 * Users API
 *
 * GET  /api/users — Returns users based on role:
 *   - Patients: see only themselves
 *   - Therapists: see themselves and their assigned patients
 *   - Admins: see all users
 *
 * PATCH /api/users — Update own profile preferences.
 *   Allowed fields: email_notifications_enabled (boolean only)
 *   Users can only update their own record.
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getUsers(req, res) {
  // Use admin client to bypass RLS, then filter based on role
  // TODO: Performance — Add .eq() filters at DB level per role instead of fetching
  // all users and filtering in memory. Therapists/patients fetch every user just to
  // filter down to 1-2 records. (P2, low risk)
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: allUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, email, role, therapist_id, first_name, last_name, created_at, email_notifications_enabled')
      .order('email');

    if (error) throw error;

    // Filter users based on requester's role
    let users = [];
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    if (currentUserRole === 'admin') {
      // Admins see all users
      users = allUsers;
    } else if (currentUserRole === 'therapist') {
      // Therapists see themselves and their assigned patients
      users = allUsers.filter(u =>
        u.id === currentUserId || u.therapist_id === currentUserId
      );
    } else {
      // Patients see only themselves
      users = allUsers.filter(u => u.id === currentUserId);
    }

    return res.status(200).json({ users });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: 'Failed to fetch users',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * PATCH /api/users — Update own notification preferences.
 *
 * Only accepts: { email_notifications_enabled: boolean }
 * Always scoped to req.user.id — cannot update other users' records.
 *
 * @param {import('../lib/auth.js').AuthedRequest} req
 * @param {import('express').Response} res
 */
async function updateUser(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  const { email_notifications_enabled } = req.body;

  // Validate — only boolean accepted; reject any other type
  if (typeof email_notifications_enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid value for email_notifications_enabled — must be boolean' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ email_notifications_enabled })
      .eq('id', req.user.id);

    if (error) throw error;

    return res.status(200).json({ updated: true });

  } catch (error) {
    console.error('Error updating user preferences:', error);
    return res.status(500).json({
      error: 'Failed to update preferences',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return requireAuth(getUsers)(req, res);
  if (req.method === 'PATCH') return requireAuth(updateUser)(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
