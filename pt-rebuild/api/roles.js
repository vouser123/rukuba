/**
 * Exercise Roles API
 *
 * GET /api/roles - Get all exercise roles for rehab coverage
 * GET /api/roles?exercise_id=X - Get roles for specific exercise
 *
 * Returns exercise roles (region × capacity × focus × contribution)
 */

import { getSupabaseAdmin } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getRoles(req, res) {
  const supabase = getSupabaseAdmin();
  const { exercise_id } = req.query;

  try {
    let query = supabase
      .from('exercise_roles')
      .select(`
        *,
        exercises (
          id,
          canonical_name
        )
      `);

    // Filter by exercise_id if provided
    if (exercise_id) {
      query = query.eq('exercise_id', exercise_id);
    }

    const { data: roles, error } = await query.order('exercise_id');

    if (error) throw error;

    return res.status(200).json({
      roles,
      count: roles.length
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      error: 'Failed to fetch roles',
      details: error.message
    });
  }
}

export default requireAuth(getRoles);
