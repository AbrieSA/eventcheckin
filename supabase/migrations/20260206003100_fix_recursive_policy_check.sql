-- Fix Recursive WITH CHECK in users_update_own_profile Policy
-- PROBLEM: WITH CHECK clause queries user_profiles while being a policy ON user_profiles
-- SOLUTION: Remove recursive check and use trigger to prevent role changes

-- ============================================================================
-- STEP 1: Drop the problematic policy
-- ============================================================================

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

-- ============================================================================
-- STEP 2: Create new policy without recursive check
-- ============================================================================

-- Users can update their own profile (role protection handled by trigger)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================================
-- STEP 3: Create trigger to prevent non-admins from changing roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role TEXT;
BEGIN
  -- Only check if role is being changed
  IF NEW.user_role IS DISTINCT FROM OLD.user_role THEN
    -- Get current user's role using SECURITY DEFINER to bypass RLS
    SELECT user_role::TEXT INTO current_role
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Only super_admin can change roles
    IF current_role != 'super_admin' THEN
      RAISE EXCEPTION 'Only super administrators can modify user roles';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_role_change_permission ON public.user_profiles;

-- Create trigger that fires before update
CREATE TRIGGER enforce_role_change_permission
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_change();

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================

-- This migration fixes infinite recursion by:
-- ✅ Removing recursive subquery from WITH CHECK clause
-- ✅ Using simple auth.uid() check in policy (no recursion)
-- ✅ Moving role change protection to BEFORE UPDATE trigger
-- ✅ Trigger uses SECURITY DEFINER to safely check current user's role
-- ✅ Maintains security: only super_admin can modify roles

-- How it works:
-- 1. User updates their profile → policy checks (id = auth.uid()) → No recursion
-- 2. If role is being changed → trigger fires → checks if current user is super_admin
-- 3. If not super_admin → RAISE EXCEPTION → update blocked
-- 4. If super_admin → update proceeds