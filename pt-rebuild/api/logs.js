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
  // - If patient_id provided (therapist logging on behalf), use that
  // - Otherwise default to logged-in user's ID (patient logging own data)
  // TODO: Security — When patient_id differs from req.user.id, verify the caller
  // is a therapist with a relationship to this patient (therapist_id in users table).
  // Currently any authenticated user can log to any patient_id. (P0, medium risk —
  // could block legitimate ops if therapist-patient relationships aren't fully populated)
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
    // TODO: Data integrity — Match form_data to sets by set_number instead of array
    // index. If Supabase ever returns inserted rows in different order than submitted,
    // form_data would attach to wrong sets. Currently works because Supabase preserves
    // insert order. HIGH RISK to change — clients must consistently populate set_number.
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

      // Insert form data for each set (if present)
      // TODO: Same array-index matching issue as createActivityLog — see TODO above.
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
 * Called by Vercel Cron once daily. Sends a digest email to each user
 * who has unread messages. Secured via CRON_SECRET, not JWT.
 *
 * Required env vars: CRON_SECRET, RESEND_API_KEY, EMAIL_FROM
 */
async function handleNotify(req, res) {
  // Verify cron secret
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Find all unread, non-deleted messages
    const { data: unread, error: msgError } = await supabase
      .from('clinical_messages')
      .select('recipient_id, sender_id, subject, created_at')
      .eq('read_by_recipient', false)
      .is('deleted_at', null);

    if (msgError) throw msgError;
    if (!unread || unread.length === 0) {
      return res.status(200).json({ sent: 0 });
    }

    // Group by recipient
    const byRecipient = {};
    for (const msg of unread) {
      if (!byRecipient[msg.recipient_id]) byRecipient[msg.recipient_id] = [];
      byRecipient[msg.recipient_id].push(msg);
    }

    const recipientIds = Object.keys(byRecipient);

    // Fetch recipient emails + names
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name')
      .in('id', recipientIds);

    if (userError) throw userError;

    const userMap = {};
    for (const u of users) userMap[u.id] = u;

    // Fetch sender names for the email body
    const senderIds = [...new Set(unread.map(m => m.sender_id))];
    const { data: senders } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', senderIds);

    const senderMap = {};
    for (const s of (senders || [])) senderMap[s.id] = `${s.first_name} ${s.last_name}`;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || 'notifications@rukuba.app';
    let sent = 0;

    for (const [recipientId, messages] of Object.entries(byRecipient)) {
      const user = userMap[recipientId];
      if (!user?.email) continue;

      const count = messages.length;
      const senderNames = [...new Set(messages.map(m => senderMap[m.sender_id] || 'your care team'))];
      const name = user.first_name || 'there';

      const html = `<p>Hi ${name},</p>
<p>You have <strong>${count}</strong> unread message${count > 1 ? 's' : ''} from ${senderNames.join(', ')}.</p>
<p>Open the app to read and reply.</p>`;

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: `You have ${count} unread message${count > 1 ? 's' : ''}`,
          html
        })
      });

      if (resp.ok) sent++;
    }

    return res.status(200).json({ sent, recipients: recipientIds.length });

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
