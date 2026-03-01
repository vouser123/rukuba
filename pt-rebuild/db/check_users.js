import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_ADMIN_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_ADMIN_KEY) {
  console.error('ERROR: SUPABASE_SECRET_KEY (or legacy service-role env var) environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY);

async function checkUsers() {
  console.log('Checking users table...\n');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, auth_id')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`  - ${u.email} (${u.role})`);
    console.log(`    id: ${u.id}`);
    console.log(`    auth_id: ${u.auth_id}`);
  });
  
  // Check activity logs count
  const { count } = await supabase
    .from('patient_activity_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nTotal activity logs in database: ${count}`);
  
  // Check logs per user
  for (const user of users) {
    if (user.role !== 'patient') continue;
    
    const { count: userCount } = await supabase
      .from('patient_activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', user.id);
      
    console.log(`  ${user.email}: ${userCount} logs`);
  }
}

checkUsers();
