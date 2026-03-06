-- Fix Trigger Role Check for Super Admin Updates
-- PROBLEM: prevent_role_change() trigger incorrectly blocks super_admin updates
-- ROOT CAUSE: Trigger duplicates role query logic and doesn't handle NULL properly
-- SOLUTION: Use existing current_user_role() function and handle NULL values

-- ============================================================================
-- STEP 1: Replace the trigger function with corrected logic
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
    -- Use existing SECURITY DEFINER function to get current user's role
    current_role := public.current_user_role();
    
    -- Allow update if current user is super_admin
    -- Block if current_role is NULL or not super_admin
    IF current_role IS NULL OR current_role != 'super_admin' THEN
      RAISE EXCEPTION 'Only super administrators can modify user roles'
        USING HINT = 'Current user role: ' || COALESCE(current_role, 'NULL');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================

-- This migration fixes the trigger by:
-- ✅ Using existing current_user_role() function (consistent with policies)
-- ✅ Explicitly handling NULL values (prevents false positives)
-- ✅ Adding HINT to error message for debugging
-- ✅ Maintaining SECURITY DEFINER to bypass RLS

-- How it works:
-- 1. Trigger fires when user_role is being changed
-- 2. Calls current_user_role() which uses SECURITY DEFINER to bypass RLS
-- 3. If current_role is 'super_admin' → allows update
-- 4. If current_role is NULL or anything else → blocks update with clear error

-- Expected behavior:
-- ✅ Super admin updating another user's role → SUCCESS
-- ✅ Super admin updating their own role → SUCCESS
-- ✅ Regular user trying to change any role → BLOCKED
-- ✅ Admin trying to change any role → BLOCKED