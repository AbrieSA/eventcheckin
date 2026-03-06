-- Fix permission denied error for auth.users table
-- Root cause: RLS policies querying auth.users table require special permissions
-- Solution: Use auth.jwt() to read role from JWT token instead of querying auth.users

-- 1. Drop existing policies that query auth.users
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 2. Create policies that use auth.jwt() instead of querying auth.users
-- Super admins can view all profiles
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Read role from JWT token (no table query needed)
  COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'role',
    (auth.jwt()->>'app_metadata')::jsonb->>'role'
  ) = 'super_admin'
);

-- Super admins can insert new profiles
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'role',
    (auth.jwt()->>'app_metadata')::jsonb->>'role'
  ) = 'super_admin'
);

-- Super admins can update all profiles
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'role',
    (auth.jwt()->>'app_metadata')::jsonb->>'role'
  ) = 'super_admin'
)
WITH CHECK (
  COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'role',
    (auth.jwt()->>'app_metadata')::jsonb->>'role'
  ) = 'super_admin'
);

-- Super admins can delete profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'role',
    (auth.jwt()->>'app_metadata')::jsonb->>'role'
  ) = 'super_admin'
);

-- Note: This migration fixes the permission error by:
-- 1. Using auth.jwt() to read role from JWT token (no database query)
-- 2. Checking both user_metadata and app_metadata for role
-- 3. No special permissions needed - JWT is always accessible to authenticated users
-- 4. Trigger still syncs role to metadata for consistency