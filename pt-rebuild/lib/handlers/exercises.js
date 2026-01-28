/**
 * Exercises API
 *
 * GET /api/exercises - List all exercises with full normalized details
 * POST /api/exercises - Create new exercise with all related data
 * PUT /api/exercises/:id - Update exercise with all related data
 * DELETE /api/exercises/:id - Archive exercise (soft delete)
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

import { getSupabaseClient, getSupabaseAdmin, getSupabaseWithAuth } from '../db.js';
import { requireAuth } from '../auth.js';

// Valid enum values from schema
const VALID_PT_CATEGORIES = ['back_sij', 'knee', 'ankle', 'hip', 'vestibular', 'foot', 'shoulder', 'other'];
const VALID_PATTERNS = ['side', 'both'];
const VALID_MODIFIERS = ['duration_seconds', 'hold_seconds', 'distance_feet'];
const VALID_GUIDANCE_SECTIONS = ['motor_cues', 'compensation_warnings', 'safety_flags', 'external_cues'];
const VALID_LIFECYCLE_STATUSES = ['active', 'deprecated', 'archived'];

// Validation limits
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_ARRAY_SIZE = 100;
const MAX_GUIDANCE_ITEM_LENGTH = 500;

async function getExercises(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

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

/**
 * Validate exercise data
 */
function validateExerciseData(data, isUpdate = false) {
  const errors = [];

  // Required fields (only for create)
  if (!isUpdate) {
    if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
      errors.push('id is required and must be a non-empty string');
    }
    if (!data.canonical_name || typeof data.canonical_name !== 'string' || data.canonical_name.trim().length === 0) {
      errors.push('canonical_name is required and must be a non-empty string');
    }
    if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
      errors.push('description is required and must be a non-empty string');
    }
    if (!data.pt_category || typeof data.pt_category !== 'string') {
      errors.push('pt_category is required');
    }
    if (!data.pattern || typeof data.pattern !== 'string') {
      errors.push('pattern is required');
    }
  }

  // Length validation
  if (data.canonical_name && data.canonical_name.length > MAX_NAME_LENGTH) {
    errors.push(`canonical_name must be ${MAX_NAME_LENGTH} characters or less`);
  }
  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
  }

  // Enum validation
  if (data.pt_category && !VALID_PT_CATEGORIES.includes(data.pt_category)) {
    errors.push(`pt_category must be one of: ${VALID_PT_CATEGORIES.join(', ')}`);
  }
  if (data.pattern && !VALID_PATTERNS.includes(data.pattern)) {
    errors.push(`pattern must be one of: ${VALID_PATTERNS.join(', ')}`);
  }
  if (data.lifecycle_status && !VALID_LIFECYCLE_STATUSES.includes(data.lifecycle_status)) {
    errors.push(`lifecycle_status must be one of: ${VALID_LIFECYCLE_STATUSES.join(', ')}`);
  }

  // Pattern modifiers validation
  if (data.pattern_modifiers) {
    if (!Array.isArray(data.pattern_modifiers)) {
      errors.push('pattern_modifiers must be an array');
    } else {
      if (data.pattern_modifiers.length > MAX_ARRAY_SIZE) {
        errors.push(`pattern_modifiers cannot exceed ${MAX_ARRAY_SIZE} items`);
      }
      const invalidModifiers = data.pattern_modifiers.filter(m => !VALID_MODIFIERS.includes(m));
      if (invalidModifiers.length > 0) {
        errors.push(`Invalid pattern modifiers: ${invalidModifiers.join(', ')}. Must be one of: ${VALID_MODIFIERS.join(', ')}`);
      }
    }
  }

  // Equipment validation
  if (data.equipment) {
    if (typeof data.equipment !== 'object') {
      errors.push('equipment must be an object with required and optional arrays');
    } else {
      if (data.equipment.required && !Array.isArray(data.equipment.required)) {
        errors.push('equipment.required must be an array');
      }
      if (data.equipment.optional && !Array.isArray(data.equipment.optional)) {
        errors.push('equipment.optional must be an array');
      }
      const totalEquipment = (data.equipment.required || []).length + (data.equipment.optional || []).length;
      if (totalEquipment > MAX_ARRAY_SIZE) {
        errors.push(`Total equipment cannot exceed ${MAX_ARRAY_SIZE} items`);
      }
    }
  }

  // Muscles validation
  if (data.primary_muscles && !Array.isArray(data.primary_muscles)) {
    errors.push('primary_muscles must be an array');
  }
  if (data.secondary_muscles && !Array.isArray(data.secondary_muscles)) {
    errors.push('secondary_muscles must be an array');
  }
  const totalMuscles = (data.primary_muscles || []).length + (data.secondary_muscles || []).length;
  if (totalMuscles > MAX_ARRAY_SIZE) {
    errors.push(`Total muscles cannot exceed ${MAX_ARRAY_SIZE} items`);
  }

  // Form parameters validation
  if (data.form_parameters_required && !Array.isArray(data.form_parameters_required)) {
    errors.push('form_parameters_required must be an array');
  }
  if (data.form_parameters_required && data.form_parameters_required.length > MAX_ARRAY_SIZE) {
    errors.push(`form_parameters_required cannot exceed ${MAX_ARRAY_SIZE} items`);
  }

  // Guidance validation
  if (data.guidance) {
    if (typeof data.guidance !== 'object') {
      errors.push('guidance must be an object');
    } else {
      for (const [section, items] of Object.entries(data.guidance)) {
        if (!VALID_GUIDANCE_SECTIONS.includes(section)) {
          errors.push(`Invalid guidance section: ${section}. Must be one of: ${VALID_GUIDANCE_SECTIONS.join(', ')}`);
        }
        if (!Array.isArray(items)) {
          errors.push(`guidance.${section} must be an array`);
        } else {
          if (items.length > MAX_ARRAY_SIZE) {
            errors.push(`guidance.${section} cannot exceed ${MAX_ARRAY_SIZE} items`);
          }
          items.forEach((item, idx) => {
            if (typeof item !== 'string') {
              errors.push(`guidance.${section}[${idx}] must be a string`);
            } else if (item.length > MAX_GUIDANCE_ITEM_LENGTH) {
              errors.push(`guidance.${section}[${idx}] exceeds ${MAX_GUIDANCE_ITEM_LENGTH} character limit`);
            }
          });
        }
      }
    }
  }

  // Date validation
  if (data.lifecycle_effective_start_date && data.lifecycle_effective_end_date) {
    const start = new Date(data.lifecycle_effective_start_date);
    const end = new Date(data.lifecycle_effective_end_date);
    if (start > end) {
      errors.push('lifecycle_effective_start_date must be before lifecycle_effective_end_date');
    }
  }

  return errors;
}

/**
 * POST /api/exercises - Create new exercise
 */
async function createExercise(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  const payload = req.body?.exercise ?? req.body;

  const {
    id,
    canonical_name,
    description,
    pt_category,
    pattern,
    archived = false,
    pattern_modifiers = [],
    equipment = { required: [], optional: [] },
    primary_muscles = [],
    secondary_muscles = [],
    form_parameters_required = [],
    guidance = {},
    lifecycle_status = null,
    lifecycle_effective_start_date = null,
    lifecycle_effective_end_date = null
  } = payload;

  // Validate input
  const validationErrors = validateExerciseData(payload, false);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors
    });
  }

  try {
    // Check for existing exercise with same ID
    const { data: existing } = await supabase
      .from('exercises')
      .select('id')
      .eq('id', id)
      .single();

    if (existing) {
      return res.status(409).json({
        error: `An exercise with the ID '${id}' already exists. Please use a different canonical name or edit the existing exercise.`
      });
    }

    // Insert main exercise record
    const { data: exercise, error: exerciseError } = await supabase
      .from('exercises')
      .insert({
        id,
        canonical_name,
        description,
        pt_category,
        pattern,
        archived,
        lifecycle_status,
        lifecycle_effective_start_date,
        lifecycle_effective_end_date,
        added_date: new Date().toISOString()
      })
      .select()
      .single();

    if (exerciseError) throw exerciseError;

    // Insert pattern modifiers
    if (pattern_modifiers.length > 0) {
      const modifierRows = pattern_modifiers.map(modifier => ({
        exercise_id: id,
        modifier
      }));
      const { error: modError } = await supabase
        .from('exercise_pattern_modifiers')
        .insert(modifierRows);
      if (modError) throw modError;
    }

    // Insert equipment
    const equipmentRows = [];
    (equipment.required || []).forEach(name => {
      equipmentRows.push({ exercise_id: id, equipment_name: name, is_required: true });
    });
    (equipment.optional || []).forEach(name => {
      equipmentRows.push({ exercise_id: id, equipment_name: name, is_required: false });
    });
    if (equipmentRows.length > 0) {
      const { error: eqError } = await supabase
        .from('exercise_equipment')
        .insert(equipmentRows);
      if (eqError) throw eqError;
    }

    // Insert muscles
    const muscleRows = [];
    primary_muscles.forEach(name => {
      muscleRows.push({ exercise_id: id, muscle_name: name, is_primary: true });
    });
    secondary_muscles.forEach(name => {
      muscleRows.push({ exercise_id: id, muscle_name: name, is_primary: false });
    });
    if (muscleRows.length > 0) {
      const { error: muscleError } = await supabase
        .from('exercise_muscles')
        .insert(muscleRows);
      if (muscleError) throw muscleError;
    }

    // Insert form parameters
    if (form_parameters_required.length > 0) {
      const paramRows = form_parameters_required.map(name => ({
        exercise_id: id,
        parameter_name: name
      }));
      const { error: paramError } = await supabase
        .from('exercise_form_parameters')
        .insert(paramRows);
      if (paramError) throw paramError;
    }

    // Insert guidance
    const guidanceRows = [];
    for (const [section, items] of Object.entries(guidance)) {
      items.forEach((content, index) => {
        guidanceRows.push({
          exercise_id: id,
          section,
          content,
          sort_order: index
        });
      });
    }
    if (guidanceRows.length > 0) {
      const { error: guidanceError } = await supabase
        .from('exercise_guidance')
        .insert(guidanceRows);
      if (guidanceError) throw guidanceError;
    }

    return res.status(201).json({ exercise });

  } catch (error) {
    console.error('Error creating exercise:', error);

    // Try to clean up if we partially created
    try {
      await supabase.from('exercises').delete().eq('id', id);
    } catch (cleanupError) {
      console.error('Error cleaning up failed exercise creation:', cleanupError);
    }

    return res.status(500).json({
      error: 'Failed to create exercise',
      details: error.message
    });
  }
}

/**
 * PUT /api/exercises/:id - Update exercise
 */
async function updateExercise(req, res, exerciseId) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  const payload = req.body?.exercise ?? req.body;

  const {
    canonical_name,
    description,
    pt_category,
    pattern,
    archived,
    pattern_modifiers,
    equipment,
    primary_muscles,
    secondary_muscles,
    form_parameters_required,
    guidance,
    lifecycle_status,
    lifecycle_effective_start_date,
    lifecycle_effective_end_date
  } = payload;

  // Validate input
  const validationErrors = validateExerciseData(payload, true);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors
    });
  }

  try {
    // Check if exercise exists
    const { data: existing, error: existingError } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    // Build updates object for main table
    const updates = { updated_date: new Date().toISOString() };
    if (canonical_name !== undefined) updates.canonical_name = canonical_name;
    if (description !== undefined) updates.description = description;
    if (pt_category !== undefined) updates.pt_category = pt_category;
    if (pattern !== undefined) updates.pattern = pattern;
    if (archived !== undefined) updates.archived = archived;
    if (lifecycle_status !== undefined) updates.lifecycle_status = lifecycle_status;
    if (lifecycle_effective_start_date !== undefined) updates.lifecycle_effective_start_date = lifecycle_effective_start_date;
    if (lifecycle_effective_end_date !== undefined) updates.lifecycle_effective_end_date = lifecycle_effective_end_date;

    // Update main exercise record
    const { data: exercise, error: updateError } = await supabase
      .from('exercises')
      .update(updates)
      .eq('id', exerciseId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update pattern modifiers (delete old, insert new)
    if (pattern_modifiers !== undefined) {
      await supabase
        .from('exercise_pattern_modifiers')
        .delete()
        .eq('exercise_id', exerciseId);

      if (pattern_modifiers.length > 0) {
        const modifierRows = pattern_modifiers.map(modifier => ({
          exercise_id: exerciseId,
          modifier
        }));
        const { error: modError } = await supabase
          .from('exercise_pattern_modifiers')
          .insert(modifierRows);
        if (modError) throw modError;
      }
    }

    // Update equipment (delete old, insert new)
    if (equipment !== undefined) {
      await supabase
        .from('exercise_equipment')
        .delete()
        .eq('exercise_id', exerciseId);

      const equipmentRows = [];
      (equipment.required || []).forEach(name => {
        equipmentRows.push({ exercise_id: exerciseId, equipment_name: name, is_required: true });
      });
      (equipment.optional || []).forEach(name => {
        equipmentRows.push({ exercise_id: exerciseId, equipment_name: name, is_required: false });
      });
      if (equipmentRows.length > 0) {
        const { error: eqError } = await supabase
          .from('exercise_equipment')
          .insert(equipmentRows);
        if (eqError) throw eqError;
      }
    }

    // Update muscles (delete old, insert new)
    if (primary_muscles !== undefined || secondary_muscles !== undefined) {
      await supabase
        .from('exercise_muscles')
        .delete()
        .eq('exercise_id', exerciseId);

      const muscleRows = [];
      (primary_muscles || []).forEach(name => {
        muscleRows.push({ exercise_id: exerciseId, muscle_name: name, is_primary: true });
      });
      (secondary_muscles || []).forEach(name => {
        muscleRows.push({ exercise_id: exerciseId, muscle_name: name, is_primary: false });
      });
      if (muscleRows.length > 0) {
        const { error: muscleError } = await supabase
          .from('exercise_muscles')
          .insert(muscleRows);
        if (muscleError) throw muscleError;
      }
    }

    // Update form parameters (delete old, insert new)
    if (form_parameters_required !== undefined) {
      await supabase
        .from('exercise_form_parameters')
        .delete()
        .eq('exercise_id', exerciseId);

      if (form_parameters_required.length > 0) {
        const paramRows = form_parameters_required.map(name => ({
          exercise_id: exerciseId,
          parameter_name: name
        }));
        const { error: paramError } = await supabase
          .from('exercise_form_parameters')
          .insert(paramRows);
        if (paramError) throw paramError;
      }
    }

    // Update guidance (delete old, insert new)
    if (guidance !== undefined) {
      await supabase
        .from('exercise_guidance')
        .delete()
        .eq('exercise_id', exerciseId);

      const guidanceRows = [];
      for (const [section, items] of Object.entries(guidance)) {
        items.forEach((content, index) => {
          guidanceRows.push({
            exercise_id: exerciseId,
            section,
            content,
            sort_order: index
          });
        });
      }
      if (guidanceRows.length > 0) {
        const { error: guidanceError } = await supabase
          .from('exercise_guidance')
          .insert(guidanceRows);
        if (guidanceError) throw guidanceError;
      }
    }

    return res.status(200).json({ exercise });

  } catch (error) {
    console.error('Error updating exercise:', error);
    return res.status(500).json({
      error: 'Failed to update exercise',
      details: error.message
    });
  }
}

/**
 * DELETE /api/exercises/:id - Archive exercise (soft delete)
 */
async function deleteExercise(req, res, exerciseId) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  try {
    const { data: exercise, error } = await supabase
      .from('exercises')
      .update({
        archived: true,
        updated_date: new Date().toISOString()
      })
      .eq('id', exerciseId)
      .select()
      .single();

    if (error) throw error;

    if (!exercise) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    return res.status(200).json({ exercise });

  } catch (error) {
    console.error('Error deleting exercise:', error);
    return res.status(500).json({
      error: 'Failed to delete exercise',
      details: error.message
    });
  }
}

/**
 * Request router
 */
async function handler(req, res) {
  // Parse exercise ID from URL for PUT/DELETE
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const exerciseIdFromPath = urlParts[urlParts.length - 1];
  const exerciseId = exerciseIdFromPath !== 'exercises'
    ? exerciseIdFromPath
    : (req.query?.id || req.body?.id || req.body?.exercise?.id);

  if (req.method === 'GET') {
    return getExercises(req, res);
  } else if (req.method === 'POST') {
    return createExercise(req, res);
  } else if (req.method === 'PUT' && exerciseId) {
    return updateExercise(req, res, exerciseId);
  } else if (req.method === 'DELETE' && exerciseId) {
    return deleteExercise(req, res, exerciseId);
  } else {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }
}

// Export wrapped with auth middleware
export default requireAuth(handler);
