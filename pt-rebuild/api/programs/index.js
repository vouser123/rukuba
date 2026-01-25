/**
 * Patient Programs API - Dosage Assignment Management
 *
 * GET /api/programs?patient_id=X - Get patient's assigned exercises with dosages
 * POST /api/programs - Assign exercise to patient with dosage
 * PUT /api/programs/:id - Update dosage
 * DELETE /api/programs/:id - Remove assignment
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

async function handler(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  if (req.method === 'GET') {
    return handleGet(req, res, supabase);
  } else if (req.method === 'POST') {
    return handlePost(req, res, supabase);
  } else if (req.method === 'PUT') {
    return handlePut(req, res, supabase);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, supabase);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET /api/programs?patient_id=X - Get patient's assigned exercises with dosages
 */
async function handleGet(req, res, supabase) {
  const { patient_id } = req.query;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id query parameter required' });
  }

  // Authorization: patients see own programs, therapists see their patients' programs
  const isOwnAccount = req.user.id === patient_id || req.user.auth_id === patient_id;

  if (req.user.role === 'patient' && !isOwnAccount) {
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
    // Use users.id for the query
    const actualPatientId = req.user.role === 'patient' ? req.user.id : patient_id;

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

/**
 * POST /api/programs - Assign exercise to patient (therapist only)
 */
async function handlePost(req, res, supabase) {
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { patient_id, exercise_id, dosage_type, sets, reps_per_set, seconds_per_set } = req.body;

  if (!patient_id || !exercise_id || !dosage_type) {
    return res.status(400).json({
      error: 'patient_id, exercise_id, and dosage_type required'
    });
  }

  try {
    // Verify patient belongs to this therapist
    const { data: patient } = await supabase
      .from('users')
      .select('therapist_id')
      .eq('id', patient_id)
      .single();

    if (!patient || patient.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Patient does not belong to this therapist' });
    }

    // Insert or update program assignment
    const { data: program, error } = await supabase
      .from('patient_programs')
      .upsert({
        patient_id,
        exercise_id,
        dosage_type,
        sets,
        reps_per_set,
        seconds_per_set,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'patient_id,exercise_id'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ program });

  } catch (error) {
    console.error('Error assigning program:', error);
    return res.status(500).json({
      error: 'Failed to assign program',
      details: error.message
    });
  }
}

/**
 * PUT /api/programs - Update dosage (therapist only)
 */
async function handlePut(req, res, supabase) {
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { id, dosage_type, sets, reps_per_set, seconds_per_set } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'id required' });
  }

  try {
    // Verify program belongs to therapist's patient
    const { data: existing } = await supabase
      .from('patient_programs')
      .select('patient_id, patients:users!patient_id(therapist_id)')
      .eq('id', id)
      .single();

    if (!existing || existing.patients.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Program does not belong to your patient' });
    }

    // Update dosage
    const { data: program, error } = await supabase
      .from('patient_programs')
      .update({
        dosage_type,
        sets,
        reps_per_set,
        seconds_per_set,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
 * DELETE /api/programs - Remove assignment (therapist only)
 */
async function handleDelete(req, res, supabase) {
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'id query parameter required' });
  }

  try {
    // Soft delete - set archived_at
    const { data, error } = await supabase
      .from('patient_programs')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error removing program:', error);
    return res.status(500).json({
      error: 'Failed to remove program',
      details: error.message
    });
  }
}

export default requireAuth(handler);
