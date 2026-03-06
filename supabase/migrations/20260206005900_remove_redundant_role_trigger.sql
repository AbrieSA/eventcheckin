-- Remove Redundant Role Change Trigger
-- PROBLEM: prevent_role_change() trigger returns 'postgres' instead of user role
-- ROOT CAUSE: Trigger is redundant - RLS policies already prevent unauthorized role changes
-- SOLUTION: Remove trigger entirely, rely on existing RLS policies

-- ============================================================================
-- WHY THIS WORKS
-- ============================================================================

-- The RLS policies already prevent unauthorized role changes:
-- 1. "users_update_own_profile" policy has WITH CHECK that prevents users from changing their own role
-- 2. "super_admin_update_all_profiles" policy only allows super_admins to update any profile
-- 3. Regular users and admins cannot access the super_admin policies

-- The trigger was causing issues because:
-- ❌ Returns 'postgres' when current_user_role() returns NULL
-- ❌ Adds unnecessary complexity
-- ❌ Duplicates logic already handled by RLS
-- ❌ Harder to debug and maintain

-- ============================================================================
-- STEP 1: Drop the trigger
-- ============================================================================

DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.user_profiles;

-- ============================================================================
-- STEP 2: Drop the trigger function with CASCADE
-- ============================================================================

DROP FUNCTION IF EXISTS public.prevent_role_change() CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After this migration:
-- ✅ Super admins can update any user's role (via RLS policy)
-- ✅ Regular users CANNOT change their own role (blocked by WITH CHECK)
-- ✅ Regular users CANNOT change other users' roles (no access to super_admin policy)
-- ✅ Admins CANNOT change any roles (no access to super_admin policy)
-- ✅ Cleaner, simpler, more maintainable code

-- How role changes work now:
-- 1. Super admin updates user role → "super_admin_update_all_profiles" policy allows it
-- 2. User tries to update their own role → "users_update_own_profile" WITH CHECK blocks it
-- 3. User tries to update another user's role → No matching policy, blocked by RLS
-- 4. Admin tries to update any role → No matching policy, blocked by RLS