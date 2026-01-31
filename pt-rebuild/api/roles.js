/**
 * Exercise Roles API
 *
 * GET /api/roles - Get all exercise roles for rehab coverage
 * GET /api/roles?exercise_id=X - Get roles for specific exercise
 * POST /api/roles - Create new role assignment
 * DELETE /api/roles/:id - Delete role assignment
 *
 * Returns exercise roles (region × capacity × focus × contribution)
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getRoles(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { exercise_id } = req.query;

  try {
    let query = supabase
      .from('exercise_roles')
      .select(`
        *,
        exercises!inner (
          id,
          canonical_name,
          archived
        )
      `)
      // Filter out archived exercises
      .eq('exercises.archived', false);

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

async function createRole(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { exercise_id, region, capacity, focus, contribution } = req.body;

  // Validate required fields
  if (!exercise_id || !region || !capacity || !contribution) {
    return res.status(400).json({
      error: 'Missing required fields: exercise_id, region, capacity, contribution'
    });
  }

  // Validate contribution value
  const validContributions = ['high', 'medium', 'low'];
  if (!validContributions.includes(contribution)) {
    return res.status(400).json({
      error: `contribution must be one of: ${validContributions.join(', ')}`
    });
  }

  // Only therapists and admins can create roles
  if (req.user.role !== 'therapist' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only therapists and admins can create role assignments'
    });
  }

  try {
    // Check for duplicate role
    const { data: existing } = await supabase
      .from('exercise_roles')
      .select('id')
      .eq('exercise_id', exercise_id)
      .eq('region', region)
      .eq('capacity', capacity)
      .eq('focus', focus || null)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'This role assignment already exists for this exercise'
      });
    }

    const { data: role, error } = await supabase
      .from('exercise_roles')
      .insert([{
        exercise_id,
        region,
        capacity,
        focus: focus || null,
        contribution
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ role });

  } catch (error) {
    console.error('Error creating role:', error);
    return res.status(500).json({
      error: 'Failed to create role',
      details: error.message
    });
  }
}

async function deleteRole(req, res, roleId) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  // Only therapists and admins can delete roles
  if (req.user.role !== 'therapist' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only therapists and admins can delete role assignments'
    });
  }

  try {
    const { error } = await supabase
      .from('exercise_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error deleting role:', error);
    return res.status(500).json({
      error: 'Failed to delete role',
      details: error.message
    });
  }
}

/**
 * Request router
 */
async function handler(req, res) {
  // Parse role ID from URL for DELETE
  const urlParts = req.url.split('?')[0].split('/');
  const roleId = urlParts[urlParts.length - 1];

  if (req.method === 'GET') {
    return getRoles(req, res);
  } else if (req.method === 'POST') {
    return createRole(req, res);
  } else if (req.method === 'DELETE' && roleId && roleId !== 'roles') {
    return deleteRole(req, res, roleId);
  } else {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }
}

export default requireAuth(handler);
