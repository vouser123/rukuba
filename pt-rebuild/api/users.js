/**
 * Users API - Get list of users
 *
 * Returns users based on role:
 * - Patients: see only themselves
 * - Therapists: see themselves and their assigned patients
 * - Admins: see all users
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
      .select('id, auth_id, email, role, therapist_id, first_name, last_name, created_at')
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

export default requireAuth(getUsers);
