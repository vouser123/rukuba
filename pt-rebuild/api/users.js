/**
 * Users API - Get list of users (therapist only for now)
 */

import { getSupabaseAdmin } from '../lib/db.js';
import { requireTherapist } from '../lib/auth.js';

async function getUsers(req, res) {
  const supabase = getSupabaseAdmin();

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

export default requireTherapist(getUsers);
