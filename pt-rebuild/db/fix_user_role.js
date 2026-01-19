/**
 * Fix user role - change cindi@puppyraiser.com from patient to therapist
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable required');
  console.error('Run: SUPABASE_SERVICE_ROLE_KEY=your-key node fix_user_role.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixUserRole() {
  console.log('Updating user role for cindi@puppyraiser.com...\n');

  const { data: user, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'cindi@puppyraiser.com')
    .single();

  if (findError || !user) {
    console.error('Error finding user:', findError?.message);
    process.exit(1);
  }

  console.log('Current user:', {
    id: user.id,
    email: user.email,
    role: user.role
  });

  if (user.role === 'therapist') {
    console.log('\n✅ User already has therapist role, no update needed');
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ role: 'therapist' })
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating user:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ Updated user role to therapist:', {
    id: updated.id,
    email: updated.email,
    role: updated.role
  });
}

fixUserRole();
