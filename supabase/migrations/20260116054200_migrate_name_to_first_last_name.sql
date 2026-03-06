-- Migration: Split name column into first_name and last_name
-- Purpose: Clean up duplicate columns in participants table

-- Step 1: Migrate data from 'name' column to 'first_name' and 'last_name'
DO $$
DECLARE
    participant_record RECORD;
    name_parts TEXT[];
    first_part TEXT;
    last_part TEXT;
BEGIN
    -- Loop through all participants with a name value
    FOR participant_record IN 
        SELECT id, name 
        FROM public.participants 
        WHERE name IS NOT NULL AND name != ''
    LOOP
        -- Split the name by spaces
        name_parts := string_to_array(trim(participant_record.name), ' ');
        
        -- Handle different name formats
        IF array_length(name_parts, 1) = 1 THEN
            -- Single name: put it in first_name
            first_part := name_parts[1];
            last_part := '';
        ELSIF array_length(name_parts, 1) = 2 THEN
            -- Two parts: first and last name
            first_part := name_parts[1];
            last_part := name_parts[2];
        ELSE
            -- Three or more parts: first name is first part, last name is everything else
            first_part := name_parts[1];
            last_part := array_to_string(name_parts[2:array_length(name_parts, 1)], ' ');
        END IF;
        
        -- Update the participant record
        UPDATE public.participants
        SET 
            first_name = first_part,
            last_name = last_part
        WHERE id = participant_record.id;
        
        RAISE NOTICE 'Migrated participant %: "%" -> first_name: "%", last_name: "%"', 
            participant_record.id, participant_record.name, first_part, last_part;
    END LOOP;
    
    RAISE NOTICE 'Data migration completed successfully';
END $$;

-- Step 2: Remove the duplicate 'name' column
DO $$
BEGIN
    ALTER TABLE public.participants
    DROP COLUMN IF EXISTS name;
    
    RAISE NOTICE 'Removed duplicate name column from participants table';
END $$;