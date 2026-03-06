-- Fix: Restore missing users_view_own_profile policy
-- Root cause: Previous migration (20260205053700) only recreated super_admin policies
--             but did not recreate the basic user policy for viewing own profile
-- Solution: Restore the users_view_own_profile policy that allows users to view their own profile

-- Restore the basic user policy for viewing own profile
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Restore the basic user policy for updating own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Note: This migration restores the basic user policies that were accidentally not recreated
-- in the previous migration. Now users can:
-- 1. View their own profile (users_view_own_profile)
-- 2. Update their own profile (users_update_own_profile)
-- 3. Super admins can still perform all operations via their separate policies