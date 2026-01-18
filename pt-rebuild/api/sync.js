/**
 * Sync API - Offline Queue Processor
 *
 * POST /api/sync
 *
 * Processes offline queue items from client.
 * Idempotent: duplicate client_mutation_ids return success without error.
 * Returns: { processed: [...], failed: [...] }
 *
 * Patient-only endpoint.
 */

import { getSupabaseClient } from '../lib/db.js';
import { requirePatient } from '../lib/auth.js';

async function processSync(req, res) {
  const supabase = getSupabaseClient();
  const { queue } = req.body;

  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({
      error: 'Invalid request body. Expected: { queue: [...] }'
    });
  }

  const processed = [];
  const failed = [];

  for (const item of queue) {
    try {
      // Validate queue item
      if (!item.operation || !item.payload) {
        failed.push({
          item,
          error: 'Missing operation or payload'
        });
        continue;
      }

      // Only support create_activity_log for now
      if (item.operation === 'create_activity_log') {
        const result = await processActivityLog(supabase, req.user.id, item.payload);

        if (result.success) {
          processed.push({
            client_mutation_id: item.payload.client_mutation_id,
            operation: item.operation
          });
        } else {
          failed.push({
            client_mutation_id: item.payload.client_mutation_id,
            operation: item.operation,
            error: result.error
          });
        }
      } else {
        failed.push({
          item,
          error: `Unsupported operation: ${item.operation}`
        });
      }

    } catch (error) {
      failed.push({
        item,
        error: error.message
      });
    }
  }

  return res.status(200).json({
    processed,
    failed,
    summary: {
      total: queue.length,
      processed: processed.length,
      failed: failed.length
    }
  });
}

/**
 * Process activity log creation (idempotent)
 */
async function processActivityLog(supabase, patientId, payload) {
  const {
    exercise_id,
    exercise_name,
    activity_type,
    notes,
    performed_at,
    client_mutation_id,
    sets
  } = payload;

  // Validation
  if (!exercise_name || !activity_type || !performed_at || !client_mutation_id || !sets) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    // Check if already exists (idempotent)
    const { data: existing } = await supabase
      .from('patient_activity_logs')
      .select('id')
      .eq('patient_id', patientId)
      .eq('client_mutation_id', client_mutation_id)
      .single();

    if (existing) {
      // Already processed - return success (idempotent)
      return { success: true, duplicate: true };
    }

    // Create activity log
    const { data: log, error: logError } = await supabase
      .from('patient_activity_logs')
      .insert({
        patient_id: patientId,
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
      return { success: false, error: logError.message };
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

    const { error: setsError } = await supabase
      .from('patient_activity_sets')
      .insert(setsWithLogId);

    if (setsError) {
      return { success: false, error: setsError.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default requirePatient(processSync);
