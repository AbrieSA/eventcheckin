-- Fix infinite recursion in user_profiles RLS policies
-- Problem: Policies queried user_profiles table, causing infinite loop
-- Solution: Use auth.users metadata for role checks instead

-- 1. Drop all existing RLS policies on user_profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 2. Create helper functions that query auth.users instead of user_profiles
-- SAFE: Queries auth.users metadata, not user_profiles (no recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin_from_auth()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
)
$$;

-- 3. Create new RLS policies using Pattern 1 (Core User Tables) and Pattern 6 (Role-Based)

-- Users can view their own profile (Pattern 1: Simple ownership)
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile (Pattern 1: Simple ownership)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super admins can view all profiles (Pattern 6: Role-based using auth.users)
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_super_admin_from_auth());

-- Super admins can insert new profiles (Pattern 6: Role-based using auth.users)
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin_from_auth());

-- Super admins can update all profiles (Pattern 6: Role-based using auth.users)
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_super_admin_from_auth())
WITH CHECK (public.is_super_admin_from_auth());

-- Super admins can delete profiles (Pattern 6: Role-based using auth.users)
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.is_super_admin_from_auth());

-- Note: RLS policies on events, participants, and attendance_records remain unchanged
-- They can continue using the existing patterns since they don't cause recursion