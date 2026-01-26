/**
 * Reference Data API
 *
 * GET /api/reference-data - Get distinct values for equipment, muscles, and form parameters
 *
 * Returns distinct values that exist in the database for use in dropdowns.
 * These are not controlled vocabularies but dynamic values based on actual usage.
 */

import { getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getReferenceData(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  try {
    // Fetch distinct equipment names
    const { data: equipmentData, error: equipmentError } = await supabase
      .from('exercise_equipment')
      .select('equipment_name')
      .order('equipment_name');

    if (equipmentError) throw equipmentError;

    // Fetch distinct muscle names
    const { data: muscleData, error: muscleError } = await supabase
      .from('exercise_muscles')
      .select('muscle_name')
      .order('muscle_name');

    if (muscleError) throw muscleError;

    // Fetch distinct form parameter names
    const { data: formParamData, error: formParamError } = await supabase
      .from('exercise_form_parameters')
      .select('parameter_name')
      .order('parameter_name');

    if (formParamError) throw formParamError;

    // Extract unique values
    const equipment = [...new Set(equipmentData.map(e => e.equipment_name))].sort();
    const muscles = [...new Set(muscleData.map(m => m.muscle_name))].sort();
    const formParameters = [...new Set(formParamData.map(fp => fp.parameter_name))].sort();

    return res.status(200).json({
      equipment,
      muscles,
      formParameters
    });

  } catch (error) {
    console.error('Error fetching reference data:', error);
    return res.status(500).json({
      error: 'Failed to fetch reference data',
      details: error.message
    });
  }
}

/**
 * Request router
 */
async function handler(req, res) {
  if (req.method === 'GET') {
    return getReferenceData(req, res);
  } else {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }
}

// Export wrapped with auth middleware
export default requireAuth(handler);
