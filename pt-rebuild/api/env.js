export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Missing Supabase environment variables'
    });
  }

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
