-- Helper function to get the next participant number
-- Extracts numeric portion from participant_id (e.g., 'KID2026001' -> 1)
-- and returns the next available number
CREATE OR REPLACE FUNCTION public.get_next_participant_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    max_number INTEGER := 0;
    current_number INTEGER;
    participant_record RECORD;
BEGIN
    -- Loop through all participant_ids and extract numeric portion
    FOR participant_record IN 
        SELECT participant_id FROM public.participants
    LOOP
        -- Extract numeric portion from format like 'KID2026001'
        current_number := NULLIF(regexp_replace(participant_record.participant_id, '\D', '', 'g'), '')::INTEGER;
        
        -- Track maximum number found
        IF current_number IS NOT NULL AND current_number > max_number THEN
            max_number := current_number;
        END IF;
    END LOOP;
    
    -- Return next number (max + 1, or 1 if no records exist)
    RETURN max_number + 1;
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, return 1 as safe default
        RETURN 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_participant_number() TO authenticated;