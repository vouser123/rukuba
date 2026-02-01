-- Migration: Add first_name and last_name columns to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Optional: Update existing users with names parsed from email (before @)
-- You can run this manually or update names in the Supabase dashboard
-- UPDATE users SET first_name = split_part(email, '@', 1) WHERE first_name IS NULL;
