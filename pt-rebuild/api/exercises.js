/**
 * Exercises API
 *
 * GET /api/exercises - List all exercises with full normalized details
 *
 * Returns exercises with all related data joined:
 * - Equipment (required/optional)
 * - Muscles (primary/secondary)
 * - Pattern modifiers
 * - Form parameters
 * - Guidance (motor cues, safety flags, etc.)
 * - Roles (rehab coverage)
 *
 * Public to authenticated users (both patients and therapists).
 */

import { getSupabaseClient, getSupabaseAdmin } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

async function getExercises(req, res) {
  const supabase = getSupabaseAdmin(); // Use admin to bypass RLS

  try {
    // Fetch exercises
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .order('canonical_name');

    if (exercisesError) throw exercisesError;

    // Fetch all related data
    const [
      { data: equipment },
      { data: muscles },
      { data: modifiers },
      { data: formParams },
      { data: guidance },
      { data: roles }
    ] = await Promise.all([
      supabase.from('exercise_equipment').select('*'),
      supabase.from('exercise_muscles').select('*'),
      supabase.from('exercise_pattern_modifiers').select('*'),
      supabase.from('exercise_form_parameters').select('*'),
      supabase.from('exercise_guidance').select('*').order('sort_order'),
      supabase.from('exercise_roles').select('*')
    ]);

    // Group related data by exercise_id
    const equipmentByExercise = groupBy(equipment, 'exercise_id');
    const musclesByExercise = groupBy(muscles, 'exercise_id');
    const modifiersByExercise = groupBy(modifiers, 'exercise_id');
    const formParamsByExercise = groupBy(formParams, 'exercise_id');
    const guidanceByExercise = groupBy(guidance, 'exercise_id');
    const rolesByExercise = groupBy(roles, 'exercise_id');

    // Assemble full exercise objects
    const fullExercises = exercises.map(ex => ({
      id: ex.id,
      canonical_name: ex.canonical_name,
      description: ex.description,
      pt_category: ex.pt_category,
      pattern: ex.pattern,
      archived: ex.archived,
      lifecycle: ex.lifecycle_status ? {
        status: ex.lifecycle_status,
        effective_start_date: ex.lifecycle_effective_start_date,
        effective_end_date: ex.lifecycle_effective_end_date
      } : null,
      supersedes: ex.supersedes_exercise_id ? [ex.supersedes_exercise_id] : null,
      superseded_by: ex.superseded_by_exercise_id,
      superseded_date: ex.superseded_date,
      added_date: ex.added_date,
      updated_date: ex.updated_date,

      // Related data
      equipment: {
        required: (equipmentByExercise[ex.id] || [])
          .filter(e => e.is_required)
          .map(e => e.equipment_name),
        optional: (equipmentByExercise[ex.id] || [])
          .filter(e => !e.is_required)
          .map(e => e.equipment_name)
      },

      primary_muscles: (musclesByExercise[ex.id] || [])
        .filter(m => m.is_primary)
        .map(m => m.muscle_name),

      secondary_muscles: (musclesByExercise[ex.id] || [])
        .filter(m => !m.is_primary)
        .map(m => m.muscle_name),

      pattern_modifiers: (modifiersByExercise[ex.id] || [])
        .map(m => m.modifier),

      form_parameters_required: (formParamsByExercise[ex.id] || [])
        .map(p => p.parameter_name),

      guidance: groupGuidance(guidanceByExercise[ex.id] || []),

      roles: (rolesByExercise[ex.id] || []).map(r => ({
        region: r.region,
        capacity: r.capacity,
        focus: r.focus,
        contribution: r.contribution
      }))
    }));

    return res.status(200).json({
      exercises: fullExercises,
      count: fullExercises.length
    });

  } catch (error) {
    console.error('Error fetching exercises:', error);
    return res.status(500).json({
      error: 'Failed to fetch exercises',
      details: error.message
    });
  }
}

/**
 * Group array by key
 */
function groupBy(array, key) {
  if (!array) return {};
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Group guidance by section
 */
function groupGuidance(guidanceArray) {
  const grouped = groupBy(guidanceArray, 'section');
  const result = {};

  for (const [section, items] of Object.entries(grouped)) {
    result[section] = items.map(item => item.content);
  }

  return result;
}

// Export wrapped with auth middleware
export default requireAuth(getExercises);
