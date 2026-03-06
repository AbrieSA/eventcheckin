-- Add human-readable changed_fields column to audit_logs
-- Shows field changes in format: "role: admin → super_admin, is_active: true → false"
-- Keeps complete old_values/new_values JSON for audit compliance

-- ============================================================================
-- STEP 1: Add changed_fields column
-- ============================================================================

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS changed_fields TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_fields ON public.audit_logs(changed_fields);

-- ============================================================================
-- STEP 2: Update audit logging function to calculate changed fields
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
-- STEP 3: Backfill existing audit logs (optional - for historical data)
-- ============================================================================

-- Update existing UPDATE records to calculate changed_fields
UPDATE public.audit_logs
SET changed_fields = (
    SELECT string_agg(
        field_changes.field_name || ': ' || 
        COALESCE(field_changes.old_value, 'null') || ' → ' || 
        COALESCE(field_changes.new_value, 'null'),
        ', '
    )
    FROM (
        SELECT 
            key AS field_name,
            old_values->>key AS old_value,
            new_values->>key AS new_value
        FROM jsonb_object_keys(new_values) AS key
        WHERE key NOT IN ('updated_at', 'created_at', 'id')
        AND (old_values->>key) IS DISTINCT FROM (new_values->>key)
    ) AS field_changes
)
WHERE action_type = 'UPDATE' 
AND changed_fields IS NULL
AND new_values IS NOT NULL
AND old_values IS NOT NULL;

-- Update INSERT records
UPDATE public.audit_logs
SET changed_fields = 'Record created'
WHERE action_type = 'INSERT' AND changed_fields IS NULL;

-- Update DELETE records
UPDATE public.audit_logs
SET changed_fields = 'Record deleted'
WHERE action_type = 'DELETE' AND changed_fields IS NULL;