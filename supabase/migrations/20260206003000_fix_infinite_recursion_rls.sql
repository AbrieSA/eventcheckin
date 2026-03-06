-- Fix Infinite Recursion in user_profiles RLS Policies
-- PROBLEM: Policies on user_profiles that query user_profiles cause infinite recursion
-- SOLUTION: Use SECURITY DEFINER function that bypasses RLS to check roles

-- ============================================================================
-- STEP 1: Drop all existing policies causing recursion
-- ============================================================================

DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_view_own_profile" ON public.user_profiles;

-- ============================================================================
-- STEP 2: Create SECURITY DEFINER function to check roles (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- SECURITY DEFINER bypasses RLS, preventing infinite recursion
  SELECT user_role::TEXT
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================================
-- STEP 3: Create secure RLS policies using the SECURITY DEFINER function
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "user_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Super admins can view all profiles
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.current_user_role() = 'super_admin');

-- Super admins can insert new profiles
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'super_admin');

-- Super admins can update all profiles
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'super_admin')
WITH CHECK (public.current_user_role() = 'super_admin');

-- Super admins can delete profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.current_user_role() = 'super_admin');

-- Users can update their own profile BUT NOT their role
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND user_role = (SELECT user_role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
);

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================

-- This migration fixes infinite recursion by:
-- ✅ Creating SECURITY DEFINER function that bypasses RLS when checking roles
-- ✅ Using simple auth.uid() checks for user's own profile (no recursion)
-- ✅ Using current_user_role() function for admin checks (bypasses RLS)
-- ✅ Maintaining security: users cannot modify their own roles

-- How it works:
-- 1. User loads their profile → "user_view_own_profile" policy (id = auth.uid()) → No recursion
-- 2. Super admin loads all profiles → "super_admin_view_all_profiles" policy → 
--    calls current_user_role() → SECURITY DEFINER bypasses RLS → returns role → No recursion
-- 3. User tries to change role → "users_update_own_profile" WITH CHECK fails → Blocked