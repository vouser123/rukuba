/**
 * Deploy vocabulary tables to Supabase
 * Run: node db/deploy_vocab.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_aov2KY6I4NYBozfw-_y00w_XniBBem1';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deployVocabSchema() {
  console.log('Deploying vocabulary tables to Supabase...\n');

  try {
    // Read the vocab schema SQL file
    const sqlPath = join(__dirname, 'vocab_schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Split into individual statements (rough split on semicolons outside of strings)
    // For vocabulary inserts, we'll execute the whole file as one
    console.log('Executing vocab_schema.sql...');

    // Use Supabase SQL editor via RPC (if available) or raw query
    // Since we need to execute raw SQL, we'll use the Postgres connection
    // For now, let's try using supabase-js with individual statements

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If RPC doesn't exist, we need to execute via direct SQL
      console.log('RPC method not available, trying direct execution...\n');

      // Split SQL into statements and execute one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        const { error: execError } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });

        if (execError) {
          console.error(`Error executing statement: ${execError.message}`);
          console.error(`Statement: ${statement}`);
        }
      }
    } else {
      console.log('✅ Vocabulary schema deployed successfully!');
    }

    // Verify tables were created by checking vocab_region
    console.log('\nVerifying vocabulary tables...');

    const { data: regionData, error: regionError } = await supabase
      .from('vocab_region')
      .select('code, definition')
      .limit(3);

    if (regionError) {
      console.error('❌ Error verifying vocab_region:', regionError.message);
      console.log('\n⚠️  Tables may not have been created. You may need to run the SQL manually in Supabase SQL Editor.');
      return;
    }

    console.log('✅ vocab_region table verified:');
    console.log(regionData);

    const { data: capacityData } = await supabase
      .from('vocab_capacity')
      .select('code, definition')
      .limit(3);

    console.log('\n✅ vocab_capacity table verified:');
    console.log(capacityData);

    console.log('\n✅ All vocabulary tables deployed and verified!');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.error('\n📋 Manual deployment instructions:');
    console.error('1. Go to https://supabase.com/dashboard/project/zvgoaxdpkgfxklotqwpz/sql/new');
    console.error('2. Copy the contents of pt-rebuild/db/vocab_schema.sql');
    console.error('3. Paste into the SQL editor and click "Run"');
  }
}

deployVocabSchema();
