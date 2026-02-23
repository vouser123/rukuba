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
 * Email Notifications (type=notify, Vercel Cron):
 * GET /api/logs?type=notify - Send daily digest email for unread messages
 *   Requires: CRON_SECRET, RESEND_API_KEY, EMAIL_FROM, APP_URL
 *
 * Patient-only endpoint (therapists cannot log on behalf of patients).
 * GET enforces: patients see own logs only, therapists see their patients' logs.
 */

import { getSupabaseAdmin, getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth, requirePatient } from '../lib/auth.js';

/**
 * Batch a Supabase .in() query to avoid PostgREST URL length limits.
 * Splits ids into chunks and merges results.
 */
async function batchedIn(supabase, table, column, ids, { select = '*', order } = {}) {
  const CHUNK_SIZE = 200;
  const results = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    let query = supabase.from(table).select(select).in(column, chunk);
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

/**
 * GET /api/logs?patient_id=X
 *
 * Returns recent activity logs with sets.
 *
 * Pagination options:
 * - limit: max records to return (default: 300)
 * - days: date range in days (default: 14)
 * - before: cursor for pagination - ISO date string, returns logs older than this
 * - include_all: if 'true', ignores days limit (still respects limit count)
 *
 * Logic: Returns logs from last {days} OR {limit} records, whichever is greater.
 * For pagination, use 'before' param with the oldest performed_at from previous page.
 */
async function getActivityLogs(req, res) {
  // Use client with JWT auth context - RLS policies will enforce access control
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { patient_id, limit, days, before, include_all } = req.query;

  // Default to current user's ID if not specified
  const targetPatientId = patient_id || req.user.id;

  // Parse parameters with defaults
  const recordLimit = parseInt(limit) || 300;
  const dayRange = parseInt(days) || 14;
  const includeAll = include_all === 'true' || include_all === '1';
  const beforeCursor = before ? new Date(before) : null;

  try {
    // Calculate date cutoff
    const dateCutoff = new Date();
    dateCutoff.setDate(dateCutoff.getDate() - dayRange);

    // RLS policies will enforce access control (patients see own, therapists see their patients')
    let query = supabase
      .from('patient_activity_logs')
      .select('*')
      .eq('patient_id', targetPatientId)
      .order('performed_at', { ascending: false });

    // Apply pagination cursor if provided
    if (beforeCursor && !isNaN(beforeCursor.getTime())) {
      query = query.lt('performed_at', beforeCursor.toISOString());
    }

    // Apply date filter unless include_all
    if (!includeAll) {
      query = query.gte('performed_at', dateCutoff.toISOString());
    }

    // Apply limit
    query = query.limit(recordLimit);

    const { data: logs, error: logsError } = await query;

    if (logsError) throw logsError;

    // Fetch all sets for these logs
    const logIds = logs.map(log => log.id);

    let sets = [];
    if (logIds.length > 0) {
      sets = await batchedIn(supabase, 'patient_activity_sets', 'activity_log_id', logIds, {
        order: 'set_number'
      });
    }

    const setIds = sets.map(set => set.id);
    let formDataBySet = {};

    if (setIds.length > 0) {
      const formDataRows = await batchedIn(supabase, 'patient_activity_set_form_data', 'activity_set_id', setIds);

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

    // Determine if there might be more logs (for "Load More" button)
    // If we got exactly the limit, there might be more
    const hasMore = logs.length === recordLimit;
    const oldestPerformedAt = logs.length > 0 ? logs[logs.length - 1].performed_at : null;

    return res.status(200).json({
      logs: logsWithSets,
      count: logsWithSets.length,
      hasMore,
      nextCursor: hasMore ? oldestPerformedAt : null
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch activity logs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
  // - If patient_id provided and differs from caller, verify therapist relationship.
  // - Otherwise default to logged-in user's ID (patient logging own data).
  const targetPatientId = patient_id || req.user.id;

  if (patient_id && patient_id !== req.user.id) {
    // Caller is logging on behalf of someone else — must be a therapist assigned to this patient.
    if (req.user.role !== 'therapist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only therapists or admins may log on behalf of a patient' });
    }

    if (req.user.role === 'therapist') {
      // Verify the target patient is actually assigned to this therapist.
      const supabaseAdmin = getSupabaseAdmin();
      const { data: patientRecord, error: patientError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', patient_id)
        .eq('therapist_id', req.user.id)
        .single();

      if (patientError || !patientRecord) {
        return res.status(403).json({ error: 'Patient is not assigned to this therapist' });
      }
    }
  }

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

  // Validate set_number on every set before touching the DB.
  // Required for the RPC's set_number-keyed form_data matching (DN-004).
  for (let i = 0; i < sets.length; i++) {
    if (typeof sets[i].set_number !== 'number' || sets[i].set_number < 1) {
      return res.status(400).json({
        error: `Invalid set_number at index ${i} — must be a positive integer`
      });
    }
  }

  try {
    // Atomically insert patient_activity_logs + patient_activity_sets +
    // patient_activity_set_form_data in a single Postgres transaction via RPC.
    //
    // DN-003 fix: if the sets or form_data inserts fail, Postgres rolls back the
    // entire transaction — no orphaned log row is left behind, and
    // client_mutation_id is never written, so the client can safely retry.
    //
    // DN-004 fix: the RPC matches form_data to sets by set_number (captured from
    // the RETURNING clause of each set insert), not by array index position.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_activity_log_atomic',
      {
        p_patient_id:         targetPatientId,
        p_exercise_id:        exercise_id || null,
        p_exercise_name:      exercise_name,
        p_client_mutation_id: client_mutation_id,
        p_activity_type:      activity_type,
        p_notes:              notes || null,
        p_performed_at:       performed_at,
        p_client_created_at:  new Date().toISOString(),
        p_sets:               sets
      }
    );

    if (rpcError) {
      // Unique constraint violation — concurrent duplicate (race condition)
      if (rpcError.code === '23505') {
        return res.status(409).json({
          error: 'Duplicate activity log (client_mutation_id already exists)'
        });
      }
      throw rpcError;
    }

    // RPC idempotency: duplicate detected inside the function before any insert
    if (rpcResult && rpcResult.duplicate === true) {
      return res.status(409).json({
        error: 'Duplicate activity log (client_mutation_id already exists)'
      });
    }

    // Fetch the created log + sets for the response body (same shape as before)
    const logId = rpcResult.log_id;

    const { data: log, error: logFetchError } = await supabase
      .from('patient_activity_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (logFetchError) throw logFetchError;

    const { data: createdSets, error: setsFetchError } = await supabase
      .from('patient_activity_sets')
      .select('*')
      .eq('activity_log_id', logId)
      .order('set_number');

    if (setsFetchError) throw setsFetchError;

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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * PATCH /api/logs?id=X
 *
 * Update an activity log (date, notes, sets).
 * Body: { performed_at?, notes?, sets? }
 */
async function updateActivityLog(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { id } = req.query;
  const { performed_at, notes, sets } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing log id' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid log id format' });
  }

  try {
    // First verify the log exists and user has access (RLS will enforce)
    const { data: existing, error: fetchError } = await supabase
      .from('patient_activity_logs')
      .select('id, patient_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Activity log not found' });
    }

    // Build update object
    const updates = {};
    if (performed_at !== undefined) {
      updates.performed_at = performed_at;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Update the log if there are changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('patient_activity_logs')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
    }

    // Update sets if provided
    if (sets && Array.isArray(sets)) {
      // Delete existing sets and their form data
      const { data: existingSets } = await supabase
        .from('patient_activity_sets')
        .select('id')
        .eq('activity_log_id', id);

      if (existingSets && existingSets.length > 0) {
        const existingSetIds = existingSets.map(s => s.id);

        // Delete form data first (foreign key constraint)
        const { error: formDeleteError } = await supabase
          .from('patient_activity_set_form_data')
          .delete()
          .in('activity_set_id', existingSetIds);

        if (formDeleteError) throw formDeleteError;

        // Delete existing sets
        const { error: setsDeleteError } = await supabase
          .from('patient_activity_sets')
          .delete()
          .eq('activity_log_id', id);

        if (setsDeleteError) throw setsDeleteError;
      }

      // Insert new sets
      const setsWithLogId = sets.map((set, index) => ({
        activity_log_id: id,
        set_number: set.set_number || index + 1,
        reps: set.reps || null,
        seconds: set.seconds || null,
        distance_feet: set.distance_feet || null,
        side: set.side || null,
        manual_log: set.manual_log || false,
        partial_rep: set.partial_rep || false,
        performed_at: set.performed_at || performed_at || new Date().toISOString()
      }));

      const { data: createdSets, error: setsError } = await supabase
        .from('patient_activity_sets')
        .insert(setsWithLogId)
        .select();

      if (setsError) throw setsError;

      // Insert form data for each set (if present).
      // Build a lookup map from set_number → created set row so form_data is
      // attached to the correct set regardless of DB return order (DN-004 fix).
      //
      // Use setsWithLogId (not the raw request sets) for the key: setsWithLogId
      // has the resolved set_number (set.set_number || index + 1) that was actually
      // written to the DB, guaranteeing the map key matches the returned rows.
      const createdSetByNumber = new Map(createdSets.map(s => [s.set_number, s]));

      const formDataRows = [];
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
        const resolvedSetNumber = setsWithLogId[i].set_number; // matches what was inserted
        const createdSet = createdSetByNumber.get(resolvedSetNumber);
        if (!createdSet) {
          // set_number written to DB but missing from returned rows — clinical
          // data integrity error; throw to surface a 500.
          throw new Error(`No created set found for set_number ${resolvedSetNumber} — clinical data integrity error`);
        }

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

      if (formDataRows.length > 0) {
        const { error: formDataError } = await supabase
          .from('patient_activity_set_form_data')
          .insert(formDataRows);

        if (formDataError) throw formDataError;
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error updating activity log:', error);
    return res.status(500).json({
      error: 'Failed to update activity log',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * DELETE /api/logs?id=X
 *
 * Delete an activity log and its sets.
 */
async function deleteActivityLog(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing log id' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid log id format' });
  }

  try {
    // First verify the log exists and user has access (RLS will enforce)
    const { data: existing, error: fetchError } = await supabase
      .from('patient_activity_logs')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Activity log not found' });
    }

    // Get existing sets to delete their form data
    const { data: existingSets } = await supabase
      .from('patient_activity_sets')
      .select('id')
      .eq('activity_log_id', id);

    if (existingSets && existingSets.length > 0) {
      const existingSetIds = existingSets.map(s => s.id);

      // Delete form data first (foreign key constraint)
      await supabase
        .from('patient_activity_set_form_data')
        .delete()
        .in('activity_set_id', existingSetIds);
    }

    // Delete sets (foreign key constraint)
    await supabase
      .from('patient_activity_sets')
      .delete()
      .eq('activity_log_id', id);

    // Delete the log
    const { error: deleteError } = await supabase
      .from('patient_activity_logs')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true, deleted: true });

  } catch (error) {
    console.error('Error deleting activity log:', error);
    return res.status(500).json({
      error: 'Failed to delete activity log',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

  const hasValidRecipientId = typeof recipient_id === 'string' && recipient_id.trim().length > 0;
  const hasValidBody = typeof body === 'string' && body.trim().length > 0;

  // Validate required fields (type-safe + empty string check)
  if (!hasValidRecipientId || !hasValidBody) {
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      .select('sender_id, recipient_id, read_at')
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
      // Record first-read timestamp (only set once, never cleared)
      if (read && !existing.read_at) {
        updates.read_at = new Date().toISOString();
      }
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ============================================================================
// DAILY EMAIL NOTIFICATION (Vercel Cron)
// ============================================================================

/**
 * GET /api/logs?type=notify
 *
 * Called by Vercel Cron once daily. Sends a digest email via Resend to each
 * user who has new unread messages since their last notification.
 *
 * Guards:
 * - Skips users with email_notifications_enabled = false (opt-out)
 * - Skips users notified within the last 23 hours (max 1 email/day)
 * - Skips users with no messages newer than their last_notified_at
 *
 * Secured via CRON_SECRET (Bearer token), not JWT.
 * Required env vars: CRON_SECRET, RESEND_API_KEY, EMAIL_FROM, APP_URL
 */
async function handleNotify(req, res) {
  // Verify cron secret — this endpoint is not JWT-protected
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();

  /**
   * Escape user-provided content before inserting into HTML email template.
   * Prevents XSS if an email client renders HTML body content.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  try {
    // Fetch all unread, non-deleted, non-archived-by-recipient messages
    const { data: unread, error: msgError } = await supabase
      .from('clinical_messages')
      .select('id, recipient_id, sender_id, body, created_at')
      .eq('read_by_recipient', false)
      .eq('archived_by_recipient', false)
      .is('deleted_at', null);

    if (msgError) throw msgError;
    if (!unread || unread.length === 0) {
      return res.status(200).json({ sent: 0, skipped: 0 });
    }

    // Group messages by recipient
    const byRecipient = {};
    for (const msg of unread) {
      if (!byRecipient[msg.recipient_id]) byRecipient[msg.recipient_id] = [];
      byRecipient[msg.recipient_id].push(msg);
    }

    const recipientIds = Object.keys(byRecipient);

    // Fetch recipient user records — need role for deep link, last_notified_at for guard,
    // email_notifications_enabled for opt-out check
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, role, last_notified_at, email_notifications_enabled')
      .in('id', recipientIds);

    if (userError) throw userError;

    const userMap = {};
    for (const u of (users || [])) userMap[u.id] = u;

    // Fetch sender names for message cards
    const senderIds = [...new Set(unread.map(m => m.sender_id))];
    const { data: senders } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', senderIds);

    const senderMap = {};
    for (const s of (senders || [])) {
      senderMap[s.id] = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Your care team';
    }

    const appUrl = process.env.APP_URL || 'https://pttracker.app';
    const from = process.env.EMAIL_FROM || 'notifications@pttracker.app';
    const resendApiKey = process.env.RESEND_API_KEY;

    let sent = 0;
    let skipped = 0;

    for (const [recipientId, messages] of Object.entries(byRecipient)) {
      const user = userMap[recipientId];

      // Skip if user record missing or no email
      if (!user?.email) { skipped++; continue; }

      // Skip if user has opted out of email notifications
      if (user.email_notifications_enabled === false) { skipped++; continue; }

      // Skip if user was notified within the last 23 hours (max 1 email/day guard)
      if (user.last_notified_at) {
        const hoursSince = (Date.now() - new Date(user.last_notified_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 23) { skipped++; continue; }
      }

      // Filter to only messages newer than last_notified_at
      // If last_notified_at is null, all messages are "new"
      const newMessages = user.last_notified_at
        ? messages.filter(m => new Date(m.created_at) > new Date(user.last_notified_at))
        : messages;

      // Skip if no new messages since last email
      if (newMessages.length === 0) { skipped++; continue; }

      // Collect unique sender display names for subject line
      const senderNames = [...new Set(newMessages.map(m => senderMap[m.sender_id] || 'Your care team'))];
      const name = escapeHtml(user.first_name || 'there');

      // Role-based deep link: therapist → /pt, everyone else → /track
      const deepLink = user.role === 'therapist' ? `${appUrl}/pt` : `${appUrl}/track`;

      // Build one card per new message (HTML-escaped body, formatted date)
      const messageCards = newMessages.map(m => {
        const senderName = escapeHtml(senderMap[m.sender_id] || 'Your care team');
        const body = escapeHtml(m.body || '');
        const date = new Date(m.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        return `<div style="border-left:3px solid #6c63ff; padding:8px 16px; margin:12px 0; background:#f9f9f9;">
  <p style="margin:0; font-size:12px; color:#666;">${senderName} · ${date}</p>
  <p style="margin:8px 0 0;">${body}</p>
</div>`;
      }).join('\n');

      const subject = newMessages.length === 1
        ? `Message from: ${senderNames[0]}`
        : `Messages from: ${senderNames.join(', ')}`;

      const emailHtml = `<p>Hi ${name},</p>
<p>Messages from: ${senderNames.map(escapeHtml).join(', ')}</p>

${messageCards}

<p>
  <a href="${deepLink}"
     style="display:inline-block; background:#6c63ff; color:#fff;
            padding:12px 24px; border-radius:6px; text-decoration:none; margin-top:16px;">
    Log In to Reply
  </a>
</p>

<p style="font-size:12px; color:#999; margin-top:32px;">
  You're receiving this because you have unread messages in PT Tracker.<br>
  To stop receiving these emails, open the messages panel in the app and uncheck "Notify me by email when I receive messages".
</p>`;

      // Send via Resend API
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `PT Tracker <${from}>`,
          to: [user.email],
          subject,
          html: emailHtml
        })
      });

      if (resp.ok) {
        sent++;
        // Update last_notified_at on success so we don't resend for same messages tomorrow
        await supabase
          .from('users')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', recipientId);
      } else {
        const errBody = await resp.text();
        console.error(`Resend error for ${recipientId}:`, resp.status, errBody);
        skipped++;
      }
    }

    return res.status(200).json({ sent, skipped, total: recipientIds.length });

  } catch (error) {
    console.error('Error sending notifications:', error);
    return res.status(500).json({
      error: 'Notification failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export with method routing
export default async function handler(req, res) {
  const { type } = req.query;

  // Cron: daily email notifications (no JWT, uses CRON_SECRET)
  if (type === 'notify') {
    if (req.method === 'GET') return handleNotify(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  if (req.method === 'PATCH') {
    // Update activity log (requires id query param)
    return requireAuth(updateActivityLog)(req, res);
  }

  if (req.method === 'DELETE') {
    // Delete activity log (requires id query param)
    return requireAuth(deleteActivityLog)(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
