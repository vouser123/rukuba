/**
 * Activity Logs API
 *
 * GET /api/logs?patient_id=X - List activity logs for a patient
 * POST /api/logs - Create new activity log with sets
 *
 * Messages API (type=messages):
 * GET /api/logs?type=messages - List clinical messages for current user
 * POST /api/logs?type=messages - Create new message
 * PATCH /api/logs?type=messages&id=X - Update message (mark read/archive)
 * DELETE /api/logs?type=messages&id=X - Soft delete message
 *
 * Patient-only endpoint (therapists cannot log on behalf of patients).
 * GET enforces: patients see own logs only, therapists see their patients' logs.
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth, requirePatient } from '../lib/auth.js';

/**
 * GET /api/logs?patient_id=X
 *
 * Returns recent activity logs (last 90 days) with sets.
 */
async function getActivityLogs(req, res) {
  // Use client with JWT auth context - RLS policies will enforce access control
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { patient_id, limit } = req.query;

  // Default to current user's ID if not specified
  const targetPatientId = patient_id || req.user.id;

  try {
    // Fetch activity logs (last 90 days by default, or all history when requested)
    const { include_all } = req.query;
    const includeAll = include_all === 'true' || include_all === '1';
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // RLS policies will enforce access control (patients see own, therapists see their patients')
    let query = supabase
      .from('patient_activity_logs')
      .select('*')
      .eq('patient_id', targetPatientId)
      .order('performed_at', { ascending: false });

    if (!includeAll) {
      query = query.gte('performed_at', ninetyDaysAgo.toISOString());
    }

    // Apply limit if provided
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) throw logsError;

    // Fetch all sets for these logs
    const logIds = logs.map(log => log.id);

    const { data: sets, error: setsError } = await supabase
      .from('patient_activity_sets')
      .select('*')
      .in('activity_log_id', logIds)
      .order('set_number');

    if (setsError) throw setsError;

    const setIds = sets.map(set => set.id);
    let formDataBySet = {};

    if (setIds.length > 0) {
      const { data: formDataRows, error: formDataError } = await supabase
        .from('patient_activity_set_form_data')
        .select('*')
        .in('activity_set_id', setIds);

      if (formDataError) throw formDataError;

      formDataBySet = formDataRows.reduce((acc, row) => {
        if (!acc[row.activity_set_id]) acc[row.activity_set_id] = [];
        acc[row.activity_set_id].push({
          parameter_name: row.parameter_name,
          parameter_value: row.parameter_value,
          parameter_unit: row.parameter_unit
        });
        return acc;
      }, {});
    }

    // Group sets by log ID
    const setsByLog = sets.reduce((acc, set) => {
      if (!acc[set.activity_log_id]) acc[set.activity_log_id] = [];
      acc[set.activity_log_id].push({
        ...set,
        form_data: formDataBySet[set.id] || null
      });
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
 * Body: { patient_id?, exercise_id, exercise_name, activity_type, notes, performed_at, client_mutation_id, sets: [...] }
 *
 * - Patients log to their own patient_id (defaults to req.user.id)
 * - Therapists can specify patient_id to log on behalf of their patients
 *
 * Deduplicates by client_mutation_id (returns 409 if duplicate).
 */
async function createActivityLog(req, res) {
  // Use client with JWT auth context - RLS policies will enforce access control
  const supabase = getSupabaseWithAuth(req.accessToken);
  const {
    patient_id,
    exercise_id,
    exercise_name,
    activity_type,
    notes,
    performed_at,
    client_mutation_id,
    sets
  } = req.body;

  // Determine target patient_id:
  // - If patient_id provided (therapist logging on behalf), use that
  // - Otherwise default to logged-in user's ID (patient logging own data)
  const targetPatientId = patient_id || req.user.id;

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
        patient_id: targetPatientId, // Patient logging own data OR therapist logging for patient
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

    // Insert sets (without form_data - that goes in separate table)
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

    // Insert form data for each set (if present)
    // form_data is an array of {parameter_name, parameter_value, parameter_unit}
    const formDataRows = [];
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      const createdSet = createdSets[i];

      if (set.form_data && Array.isArray(set.form_data) && set.form_data.length > 0) {
        for (const param of set.form_data) {
          formDataRows.push({
            activity_set_id: createdSet.id,
            parameter_name: param.parameter_name,
            parameter_value: param.parameter_value,
            parameter_unit: param.parameter_unit || null
          });
        }
      }
    }

    // Insert form data if any
    if (formDataRows.length > 0) {
      const { error: formDataError } = await supabase
        .from('patient_activity_set_form_data')
        .insert(formDataRows);

      if (formDataError) throw formDataError;
    }

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

// ============================================================================
// CLINICAL MESSAGES HANDLERS
// ============================================================================

/**
 * GET /api/logs?type=messages
 *
 * Returns clinical messages for the current user.
 * Filters out soft-deleted messages.
 */
async function getMessages(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);

  try {
    // Filter by current user - must be sender or recipient
    const { data: messages, error } = await supabase
      .from('clinical_messages')
      .select('*')
      .is('deleted_at', null)
      .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const visibleMessages = (messages || []).filter(message => {
      if (message.sender_id === req.user.id) {
        return !message.archived_by_sender;
      }
      if (message.recipient_id === req.user.id) {
        return !message.archived_by_recipient;
      }
      return false;
    });

    return res.status(200).json({
      messages: visibleMessages,
      count: visibleMessages.length
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      error: 'Failed to fetch messages',
      details: error.message
    });
  }
}

/**
 * POST /api/logs?type=messages
 *
 * Create a new clinical message.
 * Body: { recipient_id, subject?, body }
 */
async function createMessage(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { recipient_id, subject, body } = req.body;

  // Validate required fields (including empty string check)
  if (!recipient_id?.trim() || !body?.trim()) {
    return res.status(400).json({
      error: 'Missing required fields: recipient_id, body'
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(recipient_id)) {
    return res.status(400).json({ error: 'Invalid recipient_id format' });
  }

  try {
    // Validate recipient exists (use admin client to avoid RLS blocking lookups)
    const supabaseAdmin = getSupabaseAdmin();
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', recipient_id)
      .single();

    if (recipientError || !recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // For patient-to-therapist messages, patient_id is the sender (current user)
    // For therapist-to-patient messages, patient_id is the recipient
    // We'll use the current user's ID as patient_id if they're a patient,
    // otherwise use the recipient_id
    const patientId = req.user.role === 'patient' ? req.user.id : recipient_id;

    const { data: message, error } = await supabase
      .from('clinical_messages')
      .insert({
        patient_id: patientId,
        sender_id: req.user.id,
        recipient_id,
        subject: subject || null,
        body
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ message });

  } catch (error) {
    console.error('Error creating message:', error);
    return res.status(500).json({
      error: 'Failed to create message',
      details: error.message
    });
  }
}

/**
 * PATCH /api/logs?type=messages&id=X
 *
 * Update a message (mark as read or archive).
 * Body: { read?: boolean, archived?: boolean }
 */
async function updateMessage(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { id } = req.query;
  const { read, archived } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing message id' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid message id format' });
  }

  try {
    // First fetch the message to determine user's role (sender or recipient)
    // Use maybeSingle() to return null instead of throwing PGRST116 when not found
    const { data: existing, error: fetchError } = await supabase
      .from('clinical_messages')
      .select('sender_id, recipient_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const isSender = existing.sender_id === req.user.id;
    const isRecipient = existing.recipient_id === req.user.id;

    if (!isSender && !isRecipient) {
      return res.status(403).json({ error: 'Not authorized to update this message' });
    }

    // Build update object based on user's role
    const updates = { updated_at: new Date().toISOString() };

    if (read !== undefined && isRecipient) {
      updates.read_by_recipient = read;
      updates.read_at = read ? new Date().toISOString() : null;
    }

    if (archived !== undefined) {
      if (isSender) {
        updates.archived_by_sender = archived;
      } else if (isRecipient) {
        updates.archived_by_recipient = archived;
      }
    }

    const { data: message, error } = await supabase
      .from('clinical_messages')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!message) {
      return res.status(404).json({ error: 'Message not found or update not permitted' });
    }

    return res.status(200).json({ message });

  } catch (error) {
    console.error('Error updating message:', error);
    return res.status(500).json({
      error: 'Failed to update message',
      details: error.message
    });
  }
}

/**
 * DELETE /api/logs?type=messages&id=X
 *
 * Soft delete a message (sets deleted_at, deleted_by).
 * Only the sender can delete within 1-hour window.
 */
async function deleteMessage(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing message id' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid message id format' });
  }

  try {
    // Fetch message to verify ownership and check time window
    // Use maybeSingle() to return null instead of throwing PGRST116 when not found
    const { data: existing, error: fetchError } = await supabase
      .from('clinical_messages')
      .select('sender_id, created_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can delete
    if (existing.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the sender can delete a message' });
    }

    // Check 1-hour window
    const createdAt = new Date(existing.created_at);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (createdAt < oneHourAgo) {
      return res.status(403).json({ error: 'Cannot delete message after 1 hour' });
    }

    // Soft delete
    const { data: message, error } = await supabase
      .from('clinical_messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!message) {
      return res.status(404).json({ error: 'Message not found or delete not permitted' });
    }

    return res.status(200).json({ message, deleted: true });

  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({
      error: 'Failed to delete message',
      details: error.message
    });
  }
}

// Export with method routing
export default async function handler(req, res) {
  const { type } = req.query;

  // Route to messages handlers if type=messages
  if (type === 'messages') {
    if (req.method === 'GET') {
      return requireAuth(getMessages)(req, res);
    }
    if (req.method === 'POST') {
      return requireAuth(createMessage)(req, res);
    }
    if (req.method === 'PATCH') {
      return requireAuth(updateMessage)(req, res);
    }
    if (req.method === 'DELETE') {
      return requireAuth(deleteMessage)(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Default: activity logs handlers
  if (req.method === 'GET') {
    return requireAuth(getActivityLogs)(req, res);
  }

  if (req.method === 'POST') {
    // Both patients and therapists can create logs
    // Patients log their own data, therapists log on behalf of patients
    return requireAuth(createActivityLog)(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
