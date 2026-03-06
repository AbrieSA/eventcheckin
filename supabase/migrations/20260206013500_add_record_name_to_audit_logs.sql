-- Add record_name column to audit_logs for human-readable identification
-- Captures event names, participant names, and user names instead of just IDs

-- ============================================================================
-- STEP 1: Add record_name column
-- ============================================================================

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS record_name TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_name ON public.audit_logs(record_name);

COMMENT ON COLUMN public.audit_logs.record_name IS 'Human-readable name of the record (event name, participant name, user name)';

-- ============================================================================
-- STEP 2: Update audit logging function to capture record names
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
    changed_fields_text TEXT := '';
    record_name_text TEXT := '';
    field_key TEXT;
    old_val TEXT;
    new_val TEXT;
    changes_array TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Build old and new data JSON
    IF (TG_OP = 'DELETE') THEN
        old_data := row_to_json(OLD)::JSONB;
        new_data := NULL;
        description := TG_TABLE_NAME || ' record deleted';
        changed_fields_text := 'Record deleted';
    ELSIF (TG_OP = 'INSERT') THEN
        old_data := NULL;
        new_data := row_to_json(NEW)::JSONB;
        description := TG_TABLE_NAME || ' record created';
        changed_fields_text := 'Record created';
    ELSIF (TG_OP = 'UPDATE') THEN
        old_data := row_to_json(OLD)::JSONB;
        new_data := row_to_json(NEW)::JSONB;
        description := TG_TABLE_NAME || ' record updated';
        
        -- Calculate which fields changed
        FOR field_key IN SELECT jsonb_object_keys(new_data)
        LOOP
            -- Skip metadata fields that always change
            IF field_key NOT IN ('updated_at', 'created_at', 'id') THEN
                old_val := old_data->>field_key;
                new_val := new_data->>field_key;
                
                -- Check if values are different
                IF old_val IS DISTINCT FROM new_val THEN
                    -- Format: "field_name: old_value → new_value"
                    changes_array := array_append(
                        changes_array,
                        field_key || ': ' || 
                        COALESCE(old_val, 'null') || ' → ' || 
                        COALESCE(new_val, 'null')
                    );
                END IF;
            END IF;
        END LOOP;
        
        -- Join all changes with comma separator
        IF array_length(changes_array, 1) > 0 THEN
            changed_fields_text := array_to_string(changes_array, ', ');
        ELSE
            changed_fields_text := 'No significant changes';
        END IF;
    END IF;

    -- ========================================================================
    -- STEP 3: Capture human-readable record name based on table
    -- ========================================================================
    
    IF TG_TABLE_NAME = 'events' THEN
        -- For events: use event_name
        IF TG_OP = 'DELETE' THEN
            record_name_text := OLD.event_name;
        ELSE
            record_name_text := NEW.event_name;
        END IF;
        
    ELSIF TG_TABLE_NAME = 'participants' THEN
        -- For participants: use "first_name last_name"
        IF TG_OP = 'DELETE' THEN
            record_name_text := TRIM(COALESCE(OLD.first_name, '') || ' ' || COALESCE(OLD.last_name, ''));
        ELSE
            record_name_text := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
        END IF;
        
    ELSIF TG_TABLE_NAME = 'user_profiles' THEN
        -- For user_profiles: use full_name
        IF TG_OP = 'DELETE' THEN
            record_name_text := OLD.full_name;
        ELSE
            record_name_text := NEW.full_name;
        END IF;
        
    ELSE
        -- For other tables: use record ID as fallback
        record_name_text := 'Record #' || COALESCE(NEW.id::TEXT, OLD.id::TEXT);
    END IF;

    -- Insert audit log with changed_fields and record_name
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action_type,
        old_values,
        new_values,
        changed_by,
        change_description,
        changed_fields,
        record_name
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        old_data,
        new_data,
        auth.uid(),
        description,
        changed_fields_text,
        record_name_text
    );

    -- Return appropriate record
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.log_audit_event() IS 'Automatically logs changes to tracked tables with human-readable record names';

-- ============================================================================
-- STEP 4: Backfill record_name for existing audit logs (optional)
-- ============================================================================

-- Update existing event audit logs
UPDATE public.audit_logs
SET record_name = (
    CASE 
        WHEN new_values IS NOT NULL THEN new_values->>'event_name'
        WHEN old_values IS NOT NULL THEN old_values->>'event_name'
        ELSE 'Unknown Event'
    END
)
WHERE table_name = 'events' AND record_name IS NULL;

-- Update existing participant audit logs
UPDATE public.audit_logs
SET record_name = (
    CASE 
        WHEN new_values IS NOT NULL THEN 
            TRIM(COALESCE(new_values->>'first_name', '') || ' ' || COALESCE(new_values->>'last_name', ''))
        WHEN old_values IS NOT NULL THEN 
            TRIM(COALESCE(old_values->>'first_name', '') || ' ' || COALESCE(old_values->>'last_name', ''))
        ELSE 'Unknown Participant'
    END
)
WHERE table_name = 'participants' AND record_name IS NULL;

-- Update existing user_profiles audit logs
UPDATE public.audit_logs
SET record_name = (
    CASE 
        WHEN new_values IS NOT NULL THEN new_values->>'full_name'
        WHEN old_values IS NOT NULL THEN old_values->>'full_name'
        ELSE 'Unknown User'
    END
)
WHERE table_name = 'user_profiles' AND record_name IS NULL;
