-- Fix infinite recursion in user_profiles RLS policies (FINAL FIX)
-- Root Cause: RLS policies on user_profiles query user_profiles table, causing infinite loop
-- Solution: Query ONLY auth.users metadata, NEVER query user_profiles in its own policies

-- 1. Drop all existing RLS policies on user_profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 2. Drop old helper function
DROP FUNCTION IF EXISTS public.is_super_admin_from_auth();

-- 3. Create new helper functions that ONLY query auth.users (no user_profiles access)
-- SAFE: Queries auth.users.raw_user_meta_data, never touches user_profiles table
CREATE OR REPLACE FUNCTION public.get_user_role_from_auth()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'regular_user'
  )
$$;

-- 4. Create RLS policies using Pattern 1 (Core User Tables) - NO function calls, direct checks only

-- Users can view their own profile (Pattern 1: Simple ownership, no function)
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile (Pattern 1: Simple ownership, no function)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super admins can view all profiles (using auth.users metadata directly)
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND au.raw_user_meta_data->>'role' = 'super_admin'
  )
);

-- Super admins can insert new profiles (using auth.users metadata directly)
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND au.raw_user_meta_data->>'role' = 'super_admin'
  )
);

-- Super admins can update all profiles (using auth.users metadata directly)
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND au.raw_user_meta_data->>'role' = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND au.raw_user_meta_data->>'role' = 'super_admin'
  )
);

-- Super admins can delete profiles (using auth.users metadata directly)
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND au.raw_user_meta_data->>'role' = 'super_admin'
  )
);

-- 5. Update RLS policies on OTHER tables to use the safe helper function
-- These are safe because they don't query user_profiles in user_profiles policies

-- Events table policies (admin and super_admin can manage)
DROP POLICY IF EXISTS "admin_manage_events" ON public.events;
CREATE POLICY "admin_manage_events"
ON public.events
FOR ALL
TO authenticated
USING (
  public.get_user_role_from_auth() IN ('admin', 'super_admin')
)
WITH CHECK (
  public.get_user_role_from_auth() IN ('admin', 'super_admin')
);

DROP POLICY IF EXISTS "users_view_events" ON public.events;
CREATE POLICY "users_view_events"
ON public.events
FOR SELECT
TO authenticated
USING (true);

-- Participants table policies (admin and super_admin can manage)
DROP POLICY IF EXISTS "admin_manage_participants" ON public.participants;
CREATE POLICY "admin_manage_participants"
ON public.participants
FOR ALL
TO authenticated
USING (
  public.get_user_role_from_auth() IN ('admin', 'super_admin')
)
WITH CHECK (
  public.get_user_role_from_auth() IN ('admin', 'super_admin')
);

DROP POLICY IF EXISTS "users_view_participants" ON public.participants;
CREATE POLICY "users_view_participants"
ON public.participants
FOR SELECT
TO authenticated
USING (true);

-- Attendance records policies (all authenticated users can manage)
DROP POLICY IF EXISTS "users_manage_attendance" ON public.attendance_records;
CREATE POLICY "users_manage_attendance"
ON public.attendance_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Note: The key fix is that user_profiles RLS policies NEVER call functions that query user_profiles
-- They only use direct auth.uid() checks or inline EXISTS queries to auth.users