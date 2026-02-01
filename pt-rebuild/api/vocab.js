/**
 * Vocabulary API
 *
 * GET /api/vocab - Get all vocabularies
 * GET /api/vocab?table=region - Get specific vocabulary table
 * POST /api/vocab - Add new vocabulary term (therapist only)
 * PUT /api/vocab - Update vocabulary term (therapist only)
 * DELETE /api/vocab - Soft-delete vocabulary term (therapist only)
 *
 * Returns vocabulary definitions for controlled vocabularies
 */

import { getSupabaseWithAuth } from '../lib/db.js';
import { requireAuth, requireTherapistOrAdmin } from '../lib/auth.js';

const VOCAB_TABLES = [
  'vocab_region',
  'vocab_capacity',
  'vocab_contribution',
  'vocab_focus',
  'vocab_pt_category',
  'vocab_pattern'
];

/**
 * Validate table name and return full table name
 */
function getValidTableName(table) {
  if (!table) return null;
  const tableName = table.startsWith('vocab_') ? table : `vocab_${table}`;
  return VOCAB_TABLES.includes(tableName) ? tableName : null;
}

/**
 * GET - Fetch vocabularies
 */
async function getVocabularies(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { table } = req.query;

  try {
    // If specific table requested, return just that one
    if (table) {
      const tableName = getValidTableName(table);

      if (!tableName) {
        return res.status(400).json({
          error: 'Invalid vocabulary table',
          valid_tables: VOCAB_TABLES
        });
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;

      return res.status(200).json({
        table: tableName,
        items: data,
        count: data.length
      });
    }

    // Otherwise, return all vocabularies
    const result = {};

    for (const tableName of VOCAB_TABLES) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        continue;
      }

      const key = tableName.replace('vocab_', '');
      result[key] = data;
    }

    return res.status(200).json({
      vocabularies: result
    });

  } catch (error) {
    console.error('Error fetching vocabularies:', error);
    return res.status(500).json({
      error: 'Failed to fetch vocabularies',
      details: error.message
    });
  }
}

/**
 * POST - Add new vocabulary term
 */
async function addVocabulary(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { table, code, definition, sort_order } = req.body;

  const tableName = getValidTableName(table);
  if (!tableName) {
    return res.status(400).json({
      error: 'Invalid vocabulary table',
      valid_tables: VOCAB_TABLES
    });
  }

  if (!code || !definition) {
    return res.status(400).json({ error: 'code and definition are required' });
  }

  try {
    // Get max sort_order if not provided
    let order = sort_order;
    if (order === undefined) {
      const { data: maxData } = await supabase
        .from(tableName)
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      order = (maxData?.[0]?.sort_order || 0) + 1;
    }

    const { data, error } = await supabase
      .from(tableName)
      .insert({
        code: code.toLowerCase().replace(/\s+/g, '_'),
        definition,
        sort_order: order,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      item: data
    });

  } catch (error) {
    console.error('Error adding vocabulary:', error);
    return res.status(500).json({
      error: 'Failed to add vocabulary term',
      details: error.message
    });
  }
}

/**
 * PUT - Update vocabulary term
 */
async function updateVocabulary(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { table, code, definition, sort_order, active } = req.body;

  const tableName = getValidTableName(table);
  if (!tableName) {
    return res.status(400).json({
      error: 'Invalid vocabulary table',
      valid_tables: VOCAB_TABLES
    });
  }

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const updates = { updated_at: new Date().toISOString() };
    if (definition !== undefined) updates.definition = definition;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('code', code)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      item: data
    });

  } catch (error) {
    console.error('Error updating vocabulary:', error);
    return res.status(500).json({
      error: 'Failed to update vocabulary term',
      details: error.message
    });
  }
}

/**
 * DELETE - Soft-delete vocabulary term (sets active=false)
 */
async function deleteVocabulary(req, res) {
  const supabase = getSupabaseWithAuth(req.accessToken);
  const { table, code } = req.query;

  const tableName = getValidTableName(table);
  if (!tableName) {
    return res.status(400).json({
      error: 'Invalid vocabulary table',
      valid_tables: VOCAB_TABLES
    });
  }

  if (!code) {
    return res.status(400).json({ error: 'code query parameter is required' });
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('code', code)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      deleted: code
    });

  } catch (error) {
    console.error('Error deleting vocabulary:', error);
    return res.status(500).json({
      error: 'Failed to delete vocabulary term',
      details: error.message
    });
  }
}

/**
 * Main handler - route by method
 */
async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return requireAuth(getVocabularies)(req, res);
    case 'POST':
      return requireTherapistOrAdmin(addVocabulary)(req, res);
    case 'PUT':
      return requireTherapistOrAdmin(updateVocabulary)(req, res);
    case 'DELETE':
      return requireTherapistOrAdmin(deleteVocabulary)(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

export default handler;
