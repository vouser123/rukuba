/**
 * Patient Programs API
 *
 * GET /api/programs?patient_id=X - Get patient's assigned exercises with dosages
 *
 * Returns patient's "current" prescriptions (what therapist assigned them to do).
 * Patients see own programs, therapists see their patients' programs.
 */

import { getSupabaseClient } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getPrograms(req, res) {
  const supabase = getSupabaseClient();
  const { patient_id } = req.query;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id query parameter required' });
  }

  // Authorization: patients see own programs, therapists see their patients' programs
  if (req.user.role === 'patient' && req.user.id !== patient_id) {
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
      .eq('patient_id', patient_id)
      .eq('archived', false)
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

export default requireAuth(getPrograms);
