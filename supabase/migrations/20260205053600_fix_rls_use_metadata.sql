-- Fix infinite recursion by storing role in auth.users metadata
-- This allows RLS policies to check roles WITHOUT querying user_profiles

-- 1. Drop existing policies that cause recursion
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

-- 2. Update existing users to sync role to metadata
-- This is a one-time sync for existing users
DO $$
DECLARE
    profile_record RECORD;
BEGIN
    FOR profile_record IN 
        SELECT up.id, up.user_role::text
        FROM public.user_profiles up
    LOOP
        -- Update auth.users.raw_user_meta_data with role from user_profiles
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', profile_record.user_role)
        WHERE id = profile_record.id;
    END LOOP;
END $$;

-- 3. Create policies that read from auth.users metadata (NO RECURSION)
-- Super admins can view all profiles
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Check metadata directly - no query to user_profiles
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can insert new profiles
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can update all profiles
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- Super admins can delete profiles
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'super_admin')
  )
);

-- 4. Update trigger to sync role to metadata when creating new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_value TEXT;
BEGIN
    -- Extract role from metadata (set during user creation)
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

-- 5. Create trigger to sync role changes from user_profiles back to auth.users
-- This keeps both tables in sync
CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- When user_role changes in user_profiles, update auth.users metadata
    IF (TG_OP = 'UPDATE' AND OLD.user_role IS DISTINCT FROM NEW.user_role) OR TG_OP = 'INSERT' THEN
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', NEW.user_role::text)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_user_role_to_metadata_trigger ON public.user_profiles;

CREATE TRIGGER sync_user_role_to_metadata_trigger
AFTER INSERT OR UPDATE OF user_role ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_to_metadata();

-- Note: This migration fixes infinite recursion by:
-- 1. Storing role in auth.users.raw_user_meta_data (source of truth for policies)
-- 2. Policies check auth.users directly (different table, no recursion)
-- 3. Trigger keeps both tables in sync automatically
-- 4. user_profiles.user_role remains for application use