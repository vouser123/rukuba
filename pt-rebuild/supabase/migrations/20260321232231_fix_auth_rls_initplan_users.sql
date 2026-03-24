-- Fix auth RLS initialization plan on public.users (Supabase advisor: auth_rls_initplan)
-- auth.uid() was being re-evaluated per row in the policy qual and in both helper functions.
-- Wrapping with (select ...) causes Postgres to evaluate it once per query as an init plan.

-- 1. Drop and recreate the RLS policy with (select auth.uid())
DROP POLICY IF EXISTS users_select_by_role ON public.users;

CREATE POLICY users_select_by_role ON public.users
  FOR SELECT
  USING (
    (auth_id = (SELECT auth.uid()))
    OR ((get_user_role() = 'therapist') AND (therapist_id = get_user_id()))
    OR (get_user_role() = 'admin')
  );

-- 2. Update get_user_id() to use (select auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM users WHERE auth_id = (SELECT auth.uid())
$$;

-- 3. Update get_user_role() to use (select auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE auth_id = (SELECT auth.uid())
$$;;
