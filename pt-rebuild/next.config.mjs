/** @type {import('next').NextConfig} */
const nextConfig = {
    // Forward existing Vercel env vars as NEXT_PUBLIC_* for client bundle access.
    // SUPABASE_URL and SUPABASE_ANON_KEY already exist in Vercel for All Environments —
    // no new Vercel dashboard variables needed.
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },
};

export default nextConfig;
