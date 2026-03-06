-- Audit Log System with Automatic Tracking
-- Tracks: Event creation/updates, User creation/updates, Profile changes, Participant changes
-- Excludes: Check-in/check-out actions (attendance_records)

-- ============================================================================
-- STEP 1: Create audit_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    change_description TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);

-- Enable RLS on audit_logs (only super admins can view)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create audit logging function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    description TEXT;
BEGIN
    -- Build old and new data JSON
    IF (TG_OP = 'DELETE') THEN
        old_data := row_to_json(OLD)::JSONB;
        new_data := NULL;
        description := TG_TABLE_NAME || ' record deleted';
    ELSIF (TG_OP = 'INSERT') THEN
        old_data := NULL;
        new_data := row_to_json(NEW)::JSONB;
        description := TG_TABLE_NAME || ' record created';
    ELSIF (TG_OP = 'UPDATE') THEN
        old_data := row_to_json(OLD)::JSONB;
        new_data := row_to_json(NEW)::JSONB;
        description := TG_TABLE_NAME || ' record updated';
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action_type,
        old_values,
        new_values,
        changed_by,
        change_description
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        old_data,
        new_data,
        auth.uid(),
        description
    );

    -- Return appropriate record
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ============================================================================
-- STEP 3: Create triggers for events table
-- ============================================================================

DROP TRIGGER IF EXISTS audit_events_insert ON public.events;
CREATE TRIGGER audit_events_insert
    AFTER INSERT ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_events_update ON public.events;
CREATE TRIGGER audit_events_update
    AFTER UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_events_delete ON public.events;
CREATE TRIGGER audit_events_delete
    AFTER DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

-- ============================================================================
-- STEP 4: Create triggers for user_profiles table
-- ============================================================================

DROP TRIGGER IF EXISTS audit_user_profiles_insert ON public.user_profiles;
CREATE TRIGGER audit_user_profiles_insert
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_user_profiles_update ON public.user_profiles;
CREATE TRIGGER audit_user_profiles_update
    AFTER UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_user_profiles_delete ON public.user_profiles;
CREATE TRIGGER audit_user_profiles_delete
    AFTER DELETE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

-- ============================================================================
-- STEP 5: Create triggers for participants table
-- ============================================================================

DROP TRIGGER IF EXISTS audit_participants_insert ON public.participants;
CREATE TRIGGER audit_participants_insert
    AFTER INSERT ON public.participants
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_participants_update ON public.participants;
CREATE TRIGGER audit_participants_update
    AFTER UPDATE ON public.participants
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_participants_delete ON public.participants;
CREATE TRIGGER audit_participants_delete
    AFTER DELETE ON public.participants
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit_event();

-- ============================================================================
-- STEP 6: RLS Policies for audit_logs (Super Admin only)
-- ============================================================================

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND user_role = 'super_admin' AND is_active = true
    )
$$;

-- Only super admins can view audit logs
DROP POLICY IF EXISTS "super_admin_view_audit_logs" ON public.audit_logs;
CREATE POLICY "super_admin_view_audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After this migration:
-- ✅ All event creation/updates/deletes are automatically logged
-- ✅ All user profile creation/updates/deletes are automatically logged
-- ✅ All participant creation/updates/deletes are automatically logged
-- ✅ Check-in/check-out actions (attendance_records) are NOT logged
-- ✅ Audit logs are immutable (no UPDATE/DELETE policies)
-- ✅ Only super admins can view audit logs
-- ✅ Logs include old and new values for comparison
-- ✅ Logs track who made the change (changed_by)
-- ✅ Logs kept indefinitely (no automatic deletion)