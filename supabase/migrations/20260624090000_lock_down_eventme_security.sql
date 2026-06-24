-- Lock down public EventMe data access and privileged helper functions.

-- Role helpers stay SECURITY DEFINER to avoid recursive user_profiles policies.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_role::TEXT
  FROM public.user_profiles
  WHERE id = (SELECT auth.uid())
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND user_role = 'super_admin'::public.user_role
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, user_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'regular_user'::public.user_role
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_participant_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_text TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  prefix TEXT := 'KID' || year_text;
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(substring(participant_id FROM length(prefix) + 1)::INTEGER), 0) + 1
  INTO next_number
  FROM public.participants
  WHERE participant_id ~ ('^' || prefix || '[0-9]{3,6}$');

  RETURN next_number;
END;
$$;

ALTER FUNCTION public.calculate_age(date) SET search_path = public;
ALTER FUNCTION public.update_participant_age() SET search_path = public;
ALTER FUNCTION public.log_audit_event() SET search_path = public;

REVOKE ALL ON public.events FROM anon;
REVOKE ALL ON public.participants FROM anon;
REVOKE ALL ON public.attendance_records FROM anon;
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calculate_age(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_participant_age() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_participant_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_age(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_participant_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS "public_access_events" ON public.events;
DROP POLICY IF EXISTS "authenticated_users_access_events" ON public.events;
DROP POLICY IF EXISTS "admin_access_events" ON public.events;
DROP POLICY IF EXISTS "admin_manage_events" ON public.events;
DROP POLICY IF EXISTS "users_view_events" ON public.events;

CREATE POLICY "events_select_active_or_admin"
ON public.events
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR (SELECT public.current_user_role()) IN ('admin', 'super_admin')
);

CREATE POLICY "events_insert_admin"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'super_admin'));

CREATE POLICY "events_update_active_or_admin"
ON public.events
FOR UPDATE
TO authenticated
USING (
  is_active = true
  OR (SELECT public.current_user_role()) IN ('admin', 'super_admin')
)
WITH CHECK (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR is_active = false
);

CREATE POLICY "events_delete_admin"
ON public.events
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_role()) IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "public_access_participants" ON public.participants;
DROP POLICY IF EXISTS "authenticated_users_access_participants" ON public.participants;
DROP POLICY IF EXISTS "admin_access_participants" ON public.participants;
DROP POLICY IF EXISTS "admin_manage_participants" ON public.participants;
DROP POLICY IF EXISTS "users_view_participants" ON public.participants;

CREATE POLICY "participants_select_authenticated"
ON public.participants
FOR SELECT
TO authenticated
USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "participants_insert_authenticated"
ON public.participants
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "participants_update_authenticated"
ON public.participants
FOR UPDATE
TO authenticated
USING ((SELECT public.current_user_role()) IS NOT NULL)
WITH CHECK ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "participants_delete_admin"
ON public.participants
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_role()) IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "public_access_attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "authenticated_users_access_attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "admin_access_attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "users_manage_attendance" ON public.attendance_records;

CREATE POLICY "attendance_select_active_or_admin"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendance_records.event_id
      AND e.is_active = true
  )
);

CREATE POLICY "attendance_insert_active_or_admin"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendance_records.event_id
      AND e.is_active = true
  )
);

CREATE POLICY "attendance_update_active_or_admin"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendance_records.event_id
      AND e.is_active = true
  )
)
WITH CHECK (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendance_records.event_id
      AND e.is_active = true
  )
);

CREATE POLICY "attendance_delete_active_or_admin"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (
  (SELECT public.current_user_role()) IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendance_records.event_id
      AND e.is_active = true
  )
);

DROP POLICY IF EXISTS "regular_users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "super_admin_delete_profiles" ON public.user_profiles;

CREATE POLICY "user_profiles_select_own_or_super_admin"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.current_user_role()) = 'super_admin'
);

CREATE POLICY "user_profiles_insert_super_admin"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.current_user_role()) = 'super_admin');

CREATE POLICY "user_profiles_update_own_or_super_admin"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.current_user_role()) = 'super_admin'
)
WITH CHECK (
  (SELECT public.current_user_role()) = 'super_admin'
  OR (
    id = (SELECT auth.uid())
    AND user_role::TEXT = (SELECT public.current_user_role())
    AND is_active = true
  )
);

CREATE POLICY "user_profiles_delete_super_admin"
ON public.user_profiles
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_role()) = 'super_admin');

DROP POLICY IF EXISTS "super_admin_view_audit_logs" ON public.audit_logs;
CREATE POLICY "audit_logs_select_super_admin"
ON public.audit_logs
FOR SELECT
TO authenticated
USING ((SELECT public.is_super_admin()));
