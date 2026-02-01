-- Migration: Fix infinite recursion in users RLS policy
-- Problem: Policy on users table queries users table, causing infinite loop

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS users_select_by_role ON users;

-- Step 2: Create a security definer function that bypasses RLS
-- This function runs with elevated privileges and won't trigger the policy recursively
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;

-- Step 3: Create new policy using the security definer functions
-- This avoids recursion because the functions bypass RLS
CREATE POLICY users_select_by_role ON users FOR SELECT TO authenticated
  USING (
    -- Everyone can see their own record
    auth_id = auth.uid()
    OR
    -- Therapists can see patients assigned to them
    (
      get_user_role() = 'therapist'
      AND therapist_id = get_user_id()
    )
    OR
    -- Admins can see all users
    get_user_role() = 'admin'
  );
