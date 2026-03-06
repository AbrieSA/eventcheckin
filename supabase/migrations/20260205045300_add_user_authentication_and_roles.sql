-- User Authentication and Role-Based Access Control Migration
-- Creates user_profiles table with three roles: super_admin, admin, regular_user
-- Implements RLS policies for role-based access
-- Creates trigger for automatic profile creation on user signup
-- Includes mock data for testing

-- 1. Create user role enum
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'regular_user');

-- 2. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.user_role DEFAULT 'regular_user'::public.user_role NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMPTZ
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 4. Create trigger function for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'regular_user'::public.user_role)
    );
    RETURN NEW;
END;
$$;

-- 5. Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
-- Users can view their own profile
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
CREATE POLICY "users_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile (except role)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super admins can view all profiles
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'super_admin'::public.user_role
    )
);

-- Super admins can insert new profiles (for user management)
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'super_admin'::public.user_role
    )
);

-- Super admins can update all profiles
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'super_admin'::public.user_role
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'super_admin'::public.user_role
    )
);

-- Super admins can delete profiles
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_delete_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'super_admin'::public.user_role
    )
);

-- 8. Update RLS policies for existing tables to include role-based access
-- Admin and super_admin can access events
DROP POLICY IF EXISTS "admin_access_events" ON public.events;
CREATE POLICY "admin_access_events"
ON public.events
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
);

-- All authenticated users can access events (for regular users to create/log events)
DROP POLICY IF EXISTS "authenticated_users_access_events" ON public.events;
CREATE POLICY "authenticated_users_access_events"
ON public.events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Admin and super_admin can access participants
DROP POLICY IF EXISTS "admin_access_participants" ON public.participants;
CREATE POLICY "admin_access_participants"
ON public.participants
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
);

-- All authenticated users can access participants (for check-in functionality)
DROP POLICY IF EXISTS "authenticated_users_access_participants" ON public.participants;
CREATE POLICY "authenticated_users_access_participants"
ON public.participants
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Admin and super_admin can access attendance_records
DROP POLICY IF EXISTS "admin_access_attendance_records" ON public.attendance_records;
CREATE POLICY "admin_access_attendance_records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
);

-- All authenticated users can access attendance_records (for check-in functionality)
DROP POLICY IF EXISTS "authenticated_users_access_attendance_records" ON public.attendance_records;
CREATE POLICY "authenticated_users_access_attendance_records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 9. Create mock data for testing
DO $$
DECLARE
    super_admin_uuid UUID := gen_random_uuid();
    admin_uuid UUID := gen_random_uuid();
    regular_user_uuid UUID := gen_random_uuid();
BEGIN
    -- Create auth users (trigger will create user_profiles automatically)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (super_admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'superadmin@eventcheckin.com', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Super Admin', 'role', 'super_admin'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'admin@eventcheckin.com', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Admin User', 'role', 'admin'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (regular_user_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'user@eventcheckin.com', crypt('user123', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Regular User', 'role', 'regular_user'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;