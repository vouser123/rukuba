-- Migration: Add admin role to users table
-- Run this in Supabase SQL Editor to update the live database

-- 1. Drop the old check constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;

-- 2. Add new check constraint with admin role
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'therapist', 'admin'));

-- 3. Now you can update your user to admin
-- Replace 'your@email.com' with your actual email
UPDATE users
SET role = 'admin'
WHERE email = 'cindi@puppyraiser.com';

-- Verify the update
SELECT id, email, role FROM users WHERE email = 'cindi@puppyraiser.com';
