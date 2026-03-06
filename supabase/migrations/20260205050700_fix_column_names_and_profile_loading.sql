-- Fix RLS policies to use user_profiles.user_role instead of auth.users metadata
-- Fix column name mismatch: ensure user_role column exists and is used correctly
-- This fixes the authentication system where buttons don't show for super admins

-- 1. Ensure user_role column exists (rename if needed)
DO $$
BEGIN
    -- Check if 'role' column exists and 'user_role' doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'user_profiles' 
               AND column_name = 'role')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'user_profiles' 
                    AND column_name = 'user_role') THEN
        -- Rename role to user_role
        ALTER TABLE public.user_profiles RENAME COLUMN role TO user_role;
    END IF;
END $$;

-- 2. Drop RLS policies on events and participants FIRST (they depend on get_user_role_from_auth)
DROP POLICY IF EXISTS "admin_manage_events" ON public.events;
DROP POLICY IF EXISTS "users_view_events" ON public.events;
DROP POLICY IF EXISTS "admin_manage_participants" ON public.participants;
DROP POLICY IF EXISTS "users_view_participants" ON public.participants;

-- 3. Drop all existing RLS policies on user_profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 4. Now drop old helper functions (no dependencies remain)
DROP FUNCTION IF EXISTS public.get_user_role_from_auth();
DROP FUNCTION IF EXISTS public.is_super_admin_from_auth();

-- 5. Create new RLS policies on user_profiles that use user_role directly
-- CRITICAL: These policies check the user_role column in user_profiles table
-- This fixes the issue where auth.users has no role metadata

-- Users can view their own profile (simple ownership check)
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile (simple ownership check)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super admins can view all profiles
-- Uses a subquery to check the current user's role from user_profiles
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role = 'super_admin'::public.user_role
  )
);

-- Super admins can insert new profiles
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role = 'super_admin'::public.user_role
  )
);

-- Super admins can update all profiles
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role = 'super_admin'::public.user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role = 'super_admin'::public.user_role
  )
);

-- Super admins can delete profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role = 'super_admin'::public.user_role
  )
);

-- 6. Recreate RLS policies on events table with new logic
CREATE POLICY "admin_manage_events"
ON public.events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
);

CREATE POLICY "users_view_events"
ON public.events
FOR SELECT
TO authenticated
USING (true);

-- 7. Recreate RLS policies on participants table with new logic
CREATE POLICY "admin_manage_participants"
ON public.participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.user_role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
  )
);

CREATE POLICY "users_view_participants"
ON public.participants
FOR SELECT
TO authenticated
USING (true);

-- 8. Update attendance records policies
DROP POLICY IF EXISTS "users_manage_attendance" ON public.attendance_records;

CREATE POLICY "users_manage_attendance"
ON public.attendance_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 9. Update the handle_new_user trigger to use user_role column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, user_role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'regular_user'::public.user_role)
    );
    RETURN NEW;
END;
$$;

-- Note: This migration fixes the core issue where:
-- 1. auth.users has no role column (only metadata which may be empty)
-- 2. user_profiles.user_role is the source of truth for roles
-- 3. RLS policies now correctly check user_profiles.user_role
-- 4. Profile loading will work because policies allow users to see their own profiles
-- 5. Dependencies are dropped in correct order to prevent CASCADE errors