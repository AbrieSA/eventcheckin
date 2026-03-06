-- Fix Trigger Syntax Error
-- PROBLEM: Line 22 syntax error - cannot use := with function call in PL/pgSQL
-- ROOT CAUSE: current_user_role() is a SQL function returning TEXT, requires SELECT INTO syntax
-- SOLUTION: Use SELECT INTO pattern for function call assignment

-- ============================================================================
-- STEP 1: Replace the trigger function with correct PL/pgSQL syntax
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
    -- Use SELECT INTO syntax for function call (correct PL/pgSQL pattern)
    SELECT public.current_user_role() INTO current_role;
    
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

-- This migration fixes the syntax error by:
-- ✅ Using SELECT INTO instead of := for function call
-- ✅ Maintaining all security logic from previous version
-- ✅ Keeping SECURITY DEFINER to bypass RLS
-- ✅ Preserving NULL handling and error messages

-- PL/pgSQL syntax rules:
-- ❌ WRONG: variable := function_call();
-- ✅ CORRECT: SELECT function_call() INTO variable;

-- Expected behavior:
-- ✅ Super admin updating another user's role → SUCCESS
-- ✅ Super admin updating their own role → SUCCESS
-- ✅ Regular user trying to change any role → BLOCKED
-- ✅ Admin trying to change any role → BLOCKED