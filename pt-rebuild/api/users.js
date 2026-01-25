/**
 * Users API - Get list of users
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getUsers(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .order('email');

    if (error) throw error;

    return res.status(200).json({ users });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: 'Failed to fetch users',
      details: error.message
    });
  }
}

export default requireAuth(getUsers);
