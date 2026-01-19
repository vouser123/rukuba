/**
 * Vocabulary API
 *
 * GET /api/vocab - Get all vocabularies
 * GET /api/vocab?table=region - Get specific vocabulary table
 *
 * Returns vocabulary definitions for controlled vocabularies
 */

import { getSupabaseAdmin } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const VOCAB_TABLES = [
  'vocab_region',
  'vocab_capacity',
  'vocab_contribution',
  'vocab_focus',
  'vocab_pt_category',
  'vocab_pattern'
];

async function getVocabularies(req, res) {
  const supabase = getSupabaseAdmin();
  const { table } = req.query;

  try {
    // If specific table requested, return just that one
    if (table) {
      const tableName = table.startsWith('vocab_') ? table : `vocab_${table}`;

      if (!VOCAB_TABLES.includes(tableName)) {
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
        continue; // Skip this table but continue with others
      }

      // Remove vocab_ prefix for cleaner response
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

export default requireAuth(getVocabularies);
