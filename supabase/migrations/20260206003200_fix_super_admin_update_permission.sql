-- Fix Super Admin Update Permission Issue
-- PROBLEM: Multiple UPDATE policies use AND logic, causing super_admin updates to fail
-- SOLUTION: Drop conflicting policy and rely on super_admin_update_all_profiles + trigger

-- ============================================================================
-- STEP 1: Drop the conflicting users_update_own_profile policy
-- ============================================================================

-- This policy was blocking super_admins from updating other users because
-- it requires (id = auth.uid()) which fails when updating someone else
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

-- ============================================================================
-- STEP 2: Create separate policies for regular users and super admins
-- ============================================================================

-- Regular users can ONLY update their own profile (excluding role changes)
-- The trigger prevent_role_change() will block role modifications
CREATE POLICY "regular_users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() 
  AND public.current_user_role() != 'super_admin'
)
WITH CHECK (
  id = auth.uid() 
  AND public.current_user_role() != 'super_admin'
);

-- Note: super_admin_update_all_profiles policy already exists from previous migration
-- It allows super_admins to update any profile
-- The trigger prevent_role_change() ensures only super_admins can change roles

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================

-- This migration fixes the permission issue by:
-- ✅ Removing the conflicting policy that blocked super_admin updates
-- ✅ Creating a policy specifically for regular users (non-super-admins)
-- ✅ Super admins use the existing super_admin_update_all_profiles policy
-- ✅ Trigger still prevents non-super-admins from changing roles
-- ✅ No more policy conflicts - each user type has one clear UPDATE policy

-- How it works now:
-- Regular User updating own profile:
--   → regular_users_update_own_profile policy allows it
--   → Trigger blocks if trying to change role
-- 
-- Super Admin updating any profile:
--   → super_admin_update_all_profiles policy allows it
--   → Trigger allows role changes (because current_user_role() = 'super_admin')
--   → regular_users_update_own_profile doesn't apply (user is super_admin)
