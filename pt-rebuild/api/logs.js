/**
 * Activity Logs API
 *
 * GET /api/logs?patient_id=X - List activity logs for a patient
 * POST /api/logs - Create new activity log with sets
 *
 * Patient-only endpoint (therapists cannot log on behalf of patients).
 * GET enforces: patients see own logs only, therapists see their patients' logs.
 */

import { getSupabaseClient, getSupabaseAdmin } from '../lib/db.js';
import { requireAuth, requirePatient } from '../lib/auth.js';

/**
 * GET /api/logs?patient_id=X
 *
 * Returns recent activity logs (last 90 days) with sets.
 */
async function getActivityLogs(req, res) {
  const supabase = getSupabaseAdmin(); // Use admin to bypass RLS
  const { patient_id } = req.query;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id query parameter required' });
  }

  // Authorization: patients see own logs, therapists see their patients' logs
  // Accept either users.id or auth_id for patient_id parameter
  const isOwnAccount = req.user.id === patient_id || req.user.auth_id === patient_id;

  if (req.user.role === 'patient' && !isOwnAccount) {
    return res.status(403).json({ error: 'Cannot access other patients\' logs' });
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

    // Fetch activity logs (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: logs, error: logsError } = await supabase
      .from('patient_activity_logs')
      .select('*')
      .eq('patient_id', actualPatientId)
      .gte('performed_at', ninetyDaysAgo.toISOString())
      .order('performed_at', { ascending: false });

    if (logsError) throw logsError;

    // Fetch all sets for these logs
    const logIds = logs.map(log => log.id);

    const { data: sets, error: setsError } = await supabase
      .from('patient_activity_sets')
      .select('*')
      .in('activity_log_id', logIds)
      .order('set_number');

    if (setsError) throw setsError;

    // Group sets by log ID
    const setsByLog = sets.reduce((acc, set) => {
      if (!acc[set.activity_log_id]) acc[set.activity_log_id] = [];
      acc[set.activity_log_id].push(set);
      return acc;
    }, {});

    // Assemble logs with sets
    const logsWithSets = logs.map(log => ({
      ...log,
      sets: setsByLog[log.id] || []
    }));

    return res.status(200).json({
      logs: logsWithSets,
      count: logsWithSets.length
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch activity logs',
      details: error.message
    });
  }
}

/**
 * POST /api/logs
 *
 * Create new activity log with sets.
 * Body: { exercise_id, exercise_name, activity_type, notes, performed_at, client_mutation_id, sets: [...] }
 *
 * Deduplicates by client_mutation_id (returns 409 if duplicate).
 */
async function createActivityLog(req, res) {
  const supabase = getSupabaseClient();
  const {
    exercise_id,
    exercise_name,
    activity_type,
    notes,
    performed_at,
    client_mutation_id,
    sets
  } = req.body;

  // Validation
  if (!exercise_name || !activity_type || !performed_at || !client_mutation_id || !sets || !Array.isArray(sets)) {
    return res.status(400).json({
      error: 'Missing required fields: exercise_name, activity_type, performed_at, client_mutation_id, sets'
    });
  }

  if (!['reps', 'hold', 'duration', 'distance'].includes(activity_type)) {
    return res.status(400).json({
      error: 'Invalid activity_type. Must be: reps, hold, duration, distance'
    });
  }

  try {
    // Create activity log (with deduplication)
    const { data: log, error: logError } = await supabase
      .from('patient_activity_logs')
      .insert({
        patient_id: req.user.id, // From auth middleware
        exercise_id: exercise_id || null,
        exercise_name,
        client_mutation_id,
        activity_type,
        notes: notes || null,
        performed_at,
        client_created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      // Check for duplicate
      if (logError.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          error: 'Duplicate activity log (client_mutation_id already exists)'
        });
      }
      throw logError;
    }

    // Insert sets
    const setsWithLogId = sets.map(set => ({
      activity_log_id: log.id,
      set_number: set.set_number,
      reps: set.reps || null,
      seconds: set.seconds || null,
      distance_feet: set.distance_feet || null,
      side: set.side || null,
      manual_log: set.manual_log || false,
      partial_rep: set.partial_rep || false,
      performed_at: set.performed_at || performed_at
    }));

    const { data: createdSets, error: setsError } = await supabase
      .from('patient_activity_sets')
      .insert(setsWithLogId)
      .select();

    if (setsError) throw setsError;

    return res.status(201).json({
      log: {
        ...log,
        sets: createdSets
      }
    });

  } catch (error) {
    console.error('Error creating activity log:', error);
    return res.status(500).json({
      error: 'Failed to create activity log',
      details: error.message
    });
  }
}

// Export with method routing
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return requireAuth(getActivityLogs)(req, res);
  }

  if (req.method === 'POST') {
    return requirePatient(createActivityLog)(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
