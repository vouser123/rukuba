-- Fix function_search_path_mutable warnings introduced by previous migration.
-- SECURITY DEFINER functions must have a fixed search_path to prevent search_path injection.

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())
$$;;
