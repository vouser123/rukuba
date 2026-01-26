/**
 * Patient Programs API
 *
 * GET /api/programs?patient_id=X - Get patient's assigned exercises with dosages
 * POST /api/programs - Create new program (assign exercise to patient)
 * PUT /api/programs/:id - Update program dosage
 *
 * Returns patient's "current" prescriptions (what therapist assigned them to do).
 * Patients see own programs, therapists see their patients' programs.
 */

import { getSupabaseClient, getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getPrograms(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { patient_id } = req.query;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id query parameter required' });
  }

  // Authorization: patients see own programs, therapists see their patients' programs
  // Accept either users.id or auth_id for patient_id parameter
  const isOwnAccount = req.user.id === patient_id || req.user.auth_id === patient_id;

  if (req.user.role === 'patient' && !isOwnAccount) {
    console.error('Access denied:', {
      requested_patient_id: patient_id,
      user_id: req.user.id,
      auth_id: req.user.auth_id
    });
    return res.status(403).json({ error: 'Cannot access other patients\' programs' });
  }

  if (req.user.role === 'therapist') {
    // Verify patient belongs to this therapist
    const { data: patient } = await supabase
      .from('users')
      .select('therapist_id')
      .eq('id', patient_id)
      .single();

    if (!patient || patient.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Patient does not belong to this therapist' });
    }
  }

  try {
    // Use users.id for the query (in case frontend passed auth_id)
    const actualPatientId = req.user.id;

    // Fetch patient programs with exercise details
    const { data: programs, error } = await supabase
      .from('patient_programs')
      .select(`
        *,
        exercises (
          id,
          canonical_name,
          description,
          pt_category,
          pattern,
          archived
        )
      `)
      .eq('patient_id', actualPatientId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      programs,
      count: programs.length
    });

  } catch (error) {
    console.error('Error fetching programs:', error);
    return res.status(500).json({
      error: 'Failed to fetch programs',
      details: error.message
    });
  }
}

async function createProgram(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { patient_id, exercise_id, current_sets, current_reps, seconds_per_rep, distance_per_rep, side } = req.body;

  // Validate required fields
  if (!patient_id || !exercise_id || !current_sets || !current_reps) {
    return res.status(400).json({
      error: 'Missing required fields: patient_id, exercise_id, current_sets, current_reps'
    });
  }

  // Only therapists and admins can create programs
  if (req.user.role !== 'therapist' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only therapists and admins can create patient programs'
    });
  }

  try {
    const programData = {
      patient_id,
      exercise_id,
      current_sets,
      current_reps,
      seconds_per_rep: seconds_per_rep || null,
      distance_per_rep: distance_per_rep || null,
      side: side || null
    };

    const { data: program, error } = await supabase
      .from('patient_programs')
      .insert([programData])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ program });

  } catch (error) {
    console.error('Error creating program:', error);
    return res.status(500).json({
      error: 'Failed to create program',
      details: error.message
    });
  }
}

async function updateProgram(req, res, programId) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { current_sets, current_reps, seconds_per_rep, distance_per_rep, side } = req.body;

  // Only therapists and admins can update programs
  if (req.user.role !== 'therapist' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only therapists and admins can update patient programs'
    });
  }

  try {
    const updateData = {};
    if (current_sets !== undefined) updateData.current_sets = current_sets;
    if (current_reps !== undefined) updateData.current_reps = current_reps;
    if (seconds_per_rep !== undefined) updateData.seconds_per_rep = seconds_per_rep;
    if (distance_per_rep !== undefined) updateData.distance_per_rep = distance_per_rep;
    if (side !== undefined) updateData.side = side;

    const { data: program, error } = await supabase
      .from('patient_programs')
      .update(updateData)
      .eq('id', programId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ program });

  } catch (error) {
    console.error('Error updating program:', error);
    return res.status(500).json({
      error: 'Failed to update program',
      details: error.message
    });
  }
}

/**
 * Request router
 */
async function handler(req, res) {
  // Parse program ID from URL for PUT
  const urlParts = req.url.split('?')[0].split('/');
  const programId = urlParts[urlParts.length - 1];

  if (req.method === 'GET') {
    return getPrograms(req, res);
  } else if (req.method === 'POST') {
    return createProgram(req, res);
  } else if (req.method === 'PUT' && programId && programId !== 'programs') {
    return updateProgram(req, res, programId);
  } else {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }
}

export default requireAuth(handler);
