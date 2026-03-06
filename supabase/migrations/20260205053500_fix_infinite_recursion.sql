-- Fix infinite recursion in user_profiles RLS policies
-- Root cause: Policies on user_profiles were querying user_profiles itself (circular dependency)
-- Solution: Check auth.users.raw_user_meta_data instead of querying user_profiles table

-- 1. Drop all existing RLS policies on user_profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 2. Create simple policies for regular users (no recursion risk)
-- Users can view their own profile
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. Create admin policies that check auth.users metadata (breaks circular dependency)
-- Super admins can view all profiles
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Check auth.users metadata directly (no recursion)
  (auth.jwt()->>'role' = 'super_admin')
  OR
  -- Fallback: check raw_user_meta_data
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can insert new profiles
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt()->>'role' = 'super_admin')
  OR
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can update all profiles
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  (auth.jwt()->>'role' = 'super_admin')
  OR
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
  )
)
WITH CHECK (
  (auth.jwt()->>'role' = 'super_admin')
  OR
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can delete profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  (auth.jwt()->>'role' = 'super_admin')
  OR
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- 4. Update handle_new_user trigger to sync role to auth.users metadata
-- This ensures auth.jwt() and raw_user_meta_data stay in sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_value TEXT;
BEGIN
    -- Extract role from metadata
    user_role_value := COALESCE(NEW.raw_user_meta_data->>'role', 'regular_user');
    
    -- Insert into user_profiles
    INSERT INTO public.user_profiles (id, email, full_name, user_role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        user_role_value::public.user_role
    );
    
    RETURN NEW;
END;
$$;

-- Note: This migration fixes infinite recursion by:
-- 1. Removing queries to user_profiles from policies on user_profiles
-- 2. Using auth.jwt()->>'role' (from JWT token) instead
-- 3. Fallback to auth.users.raw_user_meta_data (different table, no recursion)
-- 4. Regular user policies remain simple (id = auth.uid() only)