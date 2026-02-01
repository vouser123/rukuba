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

import { getSupabaseClient, getSupabaseAdmin, getSupabaseWithAuth } from '../db.js';
import { requireAuth } from '../auth.js';

/**
 * Normalize program data, transforming nested Supabase relations into flat arrays.
 *
 * IMPORTANT: Always prefer formParamsByExercise (loaded via admin client) over the
 * nested query result, since RLS may block patients from reading exercise_form_parameters
 * via the nested join, causing it to silently return [].
 */
export function normalizeProgramPatternModifiers(programs, formParamsByExercise = {}) {
  return programs.map((program) => {
    const exercise = program.exercises || null;
    const modifiers = exercise?.exercise_pattern_modifiers || [];
    const nestedFormParams = exercise?.exercise_form_parameters || [];
    const { exercise_form_parameters, ...exercisePayload } = exercise || {};
    const adminFormParams = exercise?.id ? (formParamsByExercise[exercise.id] || []) : [];
    // Prefer admin-fetched params (RLS-safe) over nested query result
    const resolvedFormParams = adminFormParams.length > 0 ? adminFormParams : nestedFormParams;
    return {
      ...program,
      exercises: exercise
        ? {
          ...exercisePayload,
          pattern_modifiers: modifiers.map((modifier) => modifier.modifier),
          form_parameters_required: resolvedFormParams.map((param) => param.parameter_name)
        }
        : exercise
    };
  });
}

/**
 * Resolve a patient identifier that may be either users.id or auth.users.id.
 * This keeps API inputs flexible while ensuring we always query patient_programs
 * using the canonical users.id value.
 */
async function resolvePatientId(req, patientId) {
  if (!patientId) {
    return { actualPatientId: null, patientRecord: null, source: 'missing' };
  }

  // Fast path: patient_id already matches the authenticated user record.
  if (patientId === req.user.id) {
    return { actualPatientId: req.user.id, patientRecord: req.user, source: 'users.id' };
  }

  // Fast path: patient_id matches auth_id for the current user.
  if (patientId === req.user.auth_id) {
    return { actualPatientId: req.user.id, patientRecord: req.user, source: 'auth_id:self' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Attempt a direct users.id lookup.
  const { data: userById } = await supabaseAdmin
    .from('users')
    .select('id, auth_id, therapist_id')
    .eq('id', patientId)
    .maybeSingle();

  if (userById) {
    return { actualPatientId: userById.id, patientRecord: userById, source: 'users.id' };
  }

  // Fallback: treat incoming ID as auth.users.id and map to users.id.
  const { data: userByAuthId } = await supabaseAdmin
    .from('users')
    .select('id, auth_id, therapist_id')
    .eq('auth_id', patientId)
    .maybeSingle();

  if (userByAuthId) {
    return { actualPatientId: userByAuthId.id, patientRecord: userByAuthId, source: 'auth_id:lookup' };
  }

  return { actualPatientId: null, patientRecord: null, source: 'not_found' };
}

async function getPrograms(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { patient_id } = req.query;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id query parameter required' });
  }

  const { actualPatientId, patientRecord } = await resolvePatientId(req, patient_id);

  if (!actualPatientId) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  // Authorization: patients see own programs, therapists see their patients' programs
  // Accept either users.id or auth_id for patient_id parameter
  const isOwnAccount = req.user.id === actualPatientId;

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
    const patient = patientRecord?.id
      ? patientRecord
      : (await supabase
        .from('users')
        .select('therapist_id')
        .eq('id', actualPatientId)
        .single()).data;

    if (!patient || patient.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Patient does not belong to this therapist' });
    }
  }

  try {
    // Use the provided patient_id (validated above)
    const resolvedPatientId = actualPatientId;

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
          exercise_pattern_modifiers (
            modifier
          ),
          exercise_form_parameters (
            parameter_name
          ),
          archived
        )
      `)
      .eq('patient_id', resolvedPatientId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const exerciseIds = programs
      .map((program) => program.exercises?.id)
      .filter(Boolean);

    let formParamsByExercise = {};

    if (exerciseIds.length > 0) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: formParams, error: formParamsError } = await supabaseAdmin
        .from('exercise_form_parameters')
        .select('exercise_id, parameter_name')
        .in('exercise_id', exerciseIds);

      if (formParamsError) {
        console.warn('Failed to load exercise form parameters with admin client:', formParamsError);
      } else if (formParams && formParams.length > 0) {
        formParamsByExercise = formParams.reduce((acc, row) => {
          if (!acc[row.exercise_id]) acc[row.exercise_id] = [];
          acc[row.exercise_id].push({ parameter_name: row.parameter_name });
          return acc;
        }, {});
      }
    }

    const normalizedPrograms = normalizeProgramPatternModifiers(programs, formParamsByExercise);

    return res.status(200).json({
      programs: normalizedPrograms,
      count: normalizedPrograms.length
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
  const {
    patient_id,
    exercise_id,
    sets,
    reps_per_set,
    seconds_per_rep,
    seconds_per_set,
    distance_feet,
    dosage_type
  } = req.body;

  const resolvedDosageType = dosage_type
    || (distance_feet ? 'distance' : (seconds_per_set ? 'duration' : (seconds_per_rep ? 'hold' : 'reps')));
  let resolvedSecondsPerRep = seconds_per_rep ?? null;
  let resolvedSecondsPerSet = seconds_per_set ?? null;

  if (resolvedDosageType === 'duration') {
    resolvedSecondsPerRep = null;
  } else if (resolvedDosageType === 'hold') {
    resolvedSecondsPerSet = null;
  } else if (['reps', 'distance'].includes(resolvedDosageType)) {
    resolvedSecondsPerRep = null;
    resolvedSecondsPerSet = null;
  }

  // Validate required fields
  if (!patient_id || !exercise_id || !sets || (!reps_per_set && !['duration', 'distance'].includes(resolvedDosageType))) {
    return res.status(400).json({
      error: 'Missing required fields: patient_id, exercise_id, sets, reps_per_set'
    });
  }

  // Validate numeric values
  if (!Number.isInteger(sets) || sets < 1) {
    return res.status(400).json({ error: 'sets must be a positive integer' });
  }
  if (reps_per_set !== undefined && reps_per_set !== null) {
    if (!Number.isInteger(reps_per_set) || reps_per_set < 1) {
      return res.status(400).json({ error: 'reps_per_set must be a positive integer' });
    }
  }
  if (seconds_per_rep !== undefined && seconds_per_rep !== null) {
    if (!Number.isInteger(seconds_per_rep) || seconds_per_rep < 0) {
      return res.status(400).json({ error: 'seconds_per_rep must be a non-negative integer or null' });
    }
  }
  if (seconds_per_set !== undefined && seconds_per_set !== null) {
    if (!Number.isInteger(seconds_per_set) || seconds_per_set < 0) {
      return res.status(400).json({ error: 'seconds_per_set must be a non-negative integer or null' });
    }
  }
  if (distance_feet !== undefined && distance_feet !== null) {
    if (!Number.isInteger(distance_feet) || distance_feet < 1) {
      return res.status(400).json({ error: 'distance_feet must be a positive integer or null' });
    }
  }

  try {
    const { actualPatientId, patientRecord } = await resolvePatientId(req, patient_id);

    if (!actualPatientId) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Authorization: therapists/admins can create for their patients, patients can create for themselves
    if (req.user.role === 'patient') {
      // Patients can only create programs for themselves
      const isOwnAccount = req.user.id === actualPatientId;
      if (!isOwnAccount) {
        return res.status(403).json({
          error: 'Patients can only create programs for themselves'
        });
      }
    } else if (req.user.role === 'therapist') {
      // Therapists can only create programs for their assigned patients
      const patientLookup = patientRecord?.id
        ? { data: patientRecord, error: null }
        : await supabase
          .from('users')
          .select('therapist_id')
          .eq('id', actualPatientId)
          .single();
      const { data: patient, error: patientError } = patientLookup;

      if (patientError) {
        console.error('Error fetching patient:', patientError);
        return res.status(500).json({
          error: 'Failed to verify patient relationship',
          details: patientError.message
        });
      }

      if (!patient || patient.therapist_id !== req.user.id) {
        return res.status(403).json({
          error: 'Patient does not belong to this therapist'
        });
      }
    } else if (req.user.role !== 'admin') {
      // Only admins, therapists, and patients allowed
      return res.status(403).json({
        error: 'Unauthorized to create patient programs'
      });
    }
    // Check for existing program
    const { data: existing } = await supabase
      .from('patient_programs')
      .select('id')
      .eq('patient_id', actualPatientId)
      .eq('exercise_id', exercise_id)
      .is('archived_at', null)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'This exercise is already assigned to this patient. Use PUT to update instead.'
      });
    }

    const programData = {
      patient_id: actualPatientId,
      exercise_id,
      dosage_type: resolvedDosageType,
      sets,
      reps_per_set: reps_per_set ?? null,
      seconds_per_rep: resolvedSecondsPerRep,
      seconds_per_set: resolvedSecondsPerSet,
      distance_feet: distance_feet ?? null
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
  const { sets, reps_per_set, seconds_per_rep, seconds_per_set, distance_feet, dosage_type } = req.body;

  try {
    // First fetch the program to check ownership
    const { data: existingProgram, error: fetchError } = await supabase
      .from('patient_programs')
      .select('patient_id')
      .eq('id', programId)
      .single();

    if (fetchError || !existingProgram) {
      return res.status(404).json({ error: 'Program not found' });
    }

    // Authorization: therapists can update their patients' programs, patients can update their own
    if (req.user.role === 'patient') {
      // Patients can only update their own programs
      const isOwnAccount = req.user.id === existingProgram.patient_id || req.user.auth_id === existingProgram.patient_id;
      if (!isOwnAccount) {
        return res.status(403).json({
          error: 'Patients can only update their own programs'
        });
      }
    } else if (req.user.role === 'therapist') {
      // Therapists can only update programs for their assigned patients
      const { data: patient, error: patientError } = await supabase
        .from('users')
        .select('therapist_id')
        .eq('id', existingProgram.patient_id)
        .single();

      if (patientError) {
        console.error('Error fetching patient for update:', patientError);
        return res.status(500).json({
          error: 'Failed to verify patient relationship',
          details: patientError.message
        });
      }

      if (!patient || patient.therapist_id !== req.user.id) {
        return res.status(403).json({
          error: 'Patient does not belong to this therapist'
        });
      }
    } else if (req.user.role !== 'admin') {
      // Only admins, therapists, and patients allowed
      return res.status(403).json({
        error: 'Unauthorized to update patient programs'
      });
    }

    const updateData = {};
    const hasSecondsPerRep = seconds_per_rep !== undefined;
    const hasSecondsPerSet = seconds_per_set !== undefined;
    if (sets !== undefined) {
      if (!Number.isInteger(sets) || sets < 1) {
        return res.status(400).json({ error: 'sets must be a positive integer' });
      }
      updateData.sets = sets;
    }
    if (reps_per_set !== undefined) {
      if (!Number.isInteger(reps_per_set) || reps_per_set < 1) {
        return res.status(400).json({ error: 'reps_per_set must be a positive integer' });
      }
      updateData.reps_per_set = reps_per_set;
    }
    if (hasSecondsPerRep) {
      if (seconds_per_rep !== null && (!Number.isInteger(seconds_per_rep) || seconds_per_rep < 0)) {
        return res.status(400).json({ error: 'seconds_per_rep must be a non-negative integer or null' });
      }
      updateData.seconds_per_rep = seconds_per_rep;
    }
    if (hasSecondsPerSet) {
      if (seconds_per_set !== null && (!Number.isInteger(seconds_per_set) || seconds_per_set < 0)) {
        return res.status(400).json({ error: 'seconds_per_set must be a non-negative integer or null' });
      }
      updateData.seconds_per_set = seconds_per_set;
    }
    if (distance_feet !== undefined) {
      if (distance_feet !== null && (!Number.isInteger(distance_feet) || distance_feet < 1)) {
        return res.status(400).json({ error: 'distance_feet must be a positive integer or null' });
      }
      updateData.distance_feet = distance_feet;
    }
    if (dosage_type !== undefined) {
      updateData.dosage_type = dosage_type;
    }
    if (hasSecondsPerRep && !hasSecondsPerSet) {
      updateData.seconds_per_set = null;
    }
    if (hasSecondsPerSet && !hasSecondsPerRep) {
      updateData.seconds_per_rep = null;
    }
    if (dosage_type === 'duration') {
      updateData.seconds_per_rep = null;
    } else if (dosage_type === 'hold') {
      updateData.seconds_per_set = null;
    } else if (dosage_type === 'reps' || dosage_type === 'distance') {
      updateData.seconds_per_rep = null;
      updateData.seconds_per_set = null;
    }

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

async function deleteProgram(req, res, programId) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  try {
    const { data: existingProgram, error: fetchError } = await supabase
      .from('patient_programs')
      .select('id, patient_id')
      .eq('id', programId)
      .single();

    if (fetchError || !existingProgram) {
      return res.status(404).json({ error: 'Program not found' });
    }

    if (req.user.role === 'patient') {
      const isOwnAccount = req.user.id === existingProgram.patient_id || req.user.auth_id === existingProgram.patient_id;
      if (!isOwnAccount) {
        return res.status(403).json({ error: 'Patients can only delete their own programs' });
      }
    } else if (req.user.role === 'therapist') {
      const { data: patient, error: patientError } = await supabase
        .from('users')
        .select('therapist_id')
        .eq('id', existingProgram.patient_id)
        .single();

      if (patientError) {
        console.error('Error fetching patient for delete:', patientError);
        return res.status(500).json({
          error: 'Failed to verify patient relationship',
          details: patientError.message
        });
      }

      if (!patient || patient.therapist_id !== req.user.id) {
        return res.status(403).json({ error: 'Patient does not belong to this therapist' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete patient programs' });
    }

    const { data: program, error } = await supabase
      .from('patient_programs')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', programId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ program });
  } catch (error) {
    console.error('Error deleting program:', error);
    return res.status(500).json({
      error: 'Failed to delete program',
      details: error.message
    });
  }
}

/**
 * Request router
 */
async function handler(req, res) {
  // Parse program ID from URL for PUT
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const programIdFromPath = urlParts[urlParts.length - 1];
  const programId = programIdFromPath !== 'programs'
    ? programIdFromPath
    : (req.query?.id || req.body?.id);

  if (req.method === 'GET') {
    return getPrograms(req, res);
  } else if (req.method === 'POST') {
    return createProgram(req, res);
  } else if (req.method === 'PUT' && programId && programId !== 'programs') {
    return updateProgram(req, res, programId);
  } else if (req.method === 'DELETE' && programId) {
    return deleteProgram(req, res, programId);
  } else {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }
}

export default requireAuth(handler);
