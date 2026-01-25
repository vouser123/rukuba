/**
 * Exercises API - CRUD operations
 *
 * GET /api/exercises - List all exercises (any authenticated user)
 * POST /api/exercises - Create exercise (therapist only)
 * PUT /api/exercises/:id - Update exercise (therapist only)
 * DELETE /api/exercises/:id - Archive exercise (therapist only)
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../../lib/db.js';
import { requireAuth, requireTherapist } from '../../lib/auth.js';

/**
 * Route handler - delegates to GET/POST based on method
 */
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
 * GET /api/exercises - List all exercises with full normalized details
 */
async function handleGet(req, res, supabase) {
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
 * POST /api/exercises - Create new exercise (therapist only)
 */
async function handlePost(req, res, supabase) {
  // Check therapist role
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { exercise } = req.body;
  if (!exercise) {
    return res.status(400).json({ error: 'exercise object required in request body' });
  }

  try {
    // Insert main exercise
    const { data: newExercise, error: exerciseError } = await supabase
      .from('exercises')
      .insert({
        id: exercise.id,
        canonical_name: exercise.canonical_name,
        description: exercise.description,
        pt_category: exercise.pt_category,
        pattern: exercise.pattern,
        archived: exercise.archived || false,
        added_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (exerciseError) throw exerciseError;

    // Insert related data
    await insertRelatedData(supabase, exercise);

    return res.status(201).json({ exercise: newExercise });

  } catch (error) {
    console.error('Error creating exercise:', error);
    return res.status(500).json({
      error: 'Failed to create exercise',
      details: error.message
    });
  }
}

/**
 * PUT /api/exercises - Update exercise (therapist only)
 */
async function handlePut(req, res, supabase) {
  // Check therapist role
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { exercise } = req.body;
  if (!exercise || !exercise.id) {
    return res.status(400).json({ error: 'exercise object with id required' });
  }

  try {
    // Update main exercise
    const { data: updatedExercise, error: updateError } = await supabase
      .from('exercises')
      .update({
        canonical_name: exercise.canonical_name,
        description: exercise.description,
        pt_category: exercise.pt_category,
        pattern: exercise.pattern,
        archived: exercise.archived,
        updated_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', exercise.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Delete and re-insert related data (simpler than diffing)
    await deleteRelatedData(supabase, exercise.id);
    await insertRelatedData(supabase, exercise);

    return res.status(200).json({ exercise: updatedExercise });

  } catch (error) {
    console.error('Error updating exercise:', error);
    return res.status(500).json({
      error: 'Failed to update exercise',
      details: error.message
    });
  }
}

/**
 * DELETE /api/exercises/:id - Archive exercise (therapist only)
 */
async function handleDelete(req, res, supabase) {
  // Check therapist role
  if (req.user.role !== 'therapist') {
    return res.status(403).json({ error: 'Therapist access required' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'id query parameter required' });
  }

  try {
    // Soft delete - set archived = true
    const { data, error } = await supabase
      .from('exercises')
      .update({ archived: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, exercise: data });

  } catch (error) {
    console.error('Error archiving exercise:', error);
    return res.status(500).json({
      error: 'Failed to archive exercise',
      details: error.message
    });
  }
}

/**
 * Insert related exercise data (equipment, muscles, etc.)
 */
async function insertRelatedData(supabase, exercise) {
  const exerciseId = exercise.id;

  // Equipment
  if (exercise.equipment) {
    const equipmentRows = [
      ...(exercise.equipment.required || []).map(name => ({
        exercise_id: exerciseId,
        equipment_name: name,
        is_required: true
      })),
      ...(exercise.equipment.optional || []).map(name => ({
        exercise_id: exerciseId,
        equipment_name: name,
        is_required: false
      }))
    ];
    if (equipmentRows.length > 0) {
      await supabase.from('exercise_equipment').insert(equipmentRows);
    }
  }

  // Muscles
  if (exercise.primary_muscles || exercise.secondary_muscles) {
    const muscleRows = [
      ...(exercise.primary_muscles || []).map(name => ({
        exercise_id: exerciseId,
        muscle_name: name,
        is_primary: true
      })),
      ...(exercise.secondary_muscles || []).map(name => ({
        exercise_id: exerciseId,
        muscle_name: name,
        is_primary: false
      }))
    ];
    if (muscleRows.length > 0) {
      await supabase.from('exercise_muscles').insert(muscleRows);
    }
  }

  // Pattern modifiers
  if (exercise.pattern_modifiers && exercise.pattern_modifiers.length > 0) {
    const modifierRows = exercise.pattern_modifiers.map(modifier => ({
      exercise_id: exerciseId,
      modifier
    }));
    await supabase.from('exercise_pattern_modifiers').insert(modifierRows);
  }

  // Form parameters
  if (exercise.form_parameters_required && exercise.form_parameters_required.length > 0) {
    const formParamRows = exercise.form_parameters_required.map(param => ({
      exercise_id: exerciseId,
      parameter_name: param
    }));
    await supabase.from('exercise_form_parameters').insert(formParamRows);
  }

  // Guidance
  if (exercise.guidance) {
    const guidanceRows = [];
    let sortOrder = 0;
    for (const [section, items] of Object.entries(exercise.guidance)) {
      for (const content of items) {
        guidanceRows.push({
          exercise_id: exerciseId,
          section,
          content,
          sort_order: sortOrder++
        });
      }
    }
    if (guidanceRows.length > 0) {
      await supabase.from('exercise_guidance').insert(guidanceRows);
    }
  }

  // Roles
  if (exercise.roles && exercise.roles.length > 0) {
    const roleRows = exercise.roles.map(role => ({
      exercise_id: exerciseId,
      region: role.region,
      capacity: role.capacity,
      focus: role.focus,
      contribution: role.contribution
    }));
    await supabase.from('exercise_roles').insert(roleRows);
  }
}

/**
 * Delete all related exercise data
 */
async function deleteRelatedData(supabase, exerciseId) {
  await Promise.all([
    supabase.from('exercise_equipment').delete().eq('exercise_id', exerciseId),
    supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId),
    supabase.from('exercise_pattern_modifiers').delete().eq('exercise_id', exerciseId),
    supabase.from('exercise_form_parameters').delete().eq('exercise_id', exerciseId),
    supabase.from('exercise_guidance').delete().eq('exercise_id', exerciseId),
    supabase.from('exercise_roles').delete().eq('exercise_id', exerciseId)
  ]);
}

/**
 * Helper functions
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

function groupGuidance(guidanceArray) {
  const grouped = groupBy(guidanceArray, 'section');
  const result = {};

  for (const [section, items] of Object.entries(grouped)) {
    result[section] = items.map(item => item.content);
  }

  return result;
}

// Export wrapped with auth middleware
export default requireAuth(handler);
