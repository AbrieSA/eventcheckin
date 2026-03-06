-- Ignore session refresh updates (last_login_at only changes)
-- Only track actual login events when user enters credentials

-- ============================================================================
-- Update audit logging function to skip last_login_at-only updates
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
    field_key TEXT;
    old_val TEXT;
    new_val TEXT;
    changes_array TEXT[] := ARRAY[]::TEXT[];
    significant_changes_count INTEGER := 0;
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
        
        -- Calculate which fields changed (excluding metadata fields)
        FOR field_key IN SELECT jsonb_object_keys(new_data)
        LOOP
            -- Skip metadata fields that always change
            IF field_key NOT IN ('updated_at', 'created_at', 'id') THEN
                old_val := old_data->>field_key;
                new_val := new_data->>field_key;
                
                -- Check if values are different
                IF old_val IS DISTINCT FROM new_val THEN
                    -- Count significant changes (not last_login_at)
                    IF field_key != 'last_login_at' THEN
                        significant_changes_count := significant_changes_count + 1;
                    END IF;
                    
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
        
        -- CRITICAL: Skip logging if ONLY last_login_at changed (session refresh)
        -- This prevents tracking automatic session refreshes every few seconds
        IF significant_changes_count = 0 THEN
            -- Only last_login_at changed, this is a session refresh, not a real login
            IF (TG_OP = 'DELETE') THEN
                RETURN OLD;
            ELSE
                RETURN NEW;
            END IF;
        END IF;
        
        -- Join all changes with comma separator
        IF array_length(changes_array, 1) > 0 THEN
            changed_fields_text := array_to_string(changes_array, ', ');
        ELSE
            changed_fields_text := 'No significant changes';
        END IF;
    END IF;

    -- Insert audit log with changed_fields
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action_type,
        old_values,
        new_values,
        changed_by,
        change_description,
        changed_fields
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        old_data,
        new_data,
        auth.uid(),
        description,
        changed_fields_text
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
-- Comment explaining the change
-- ============================================================================

COMMENT ON FUNCTION public.log_audit_event() IS 
'Audit logging function that tracks all changes except session refresh updates. 
Skips logging when only last_login_at changes (automatic session refresh). 
Only tracks actual login events when user enters credentials in login portal.';