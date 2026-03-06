-- Add date_of_birth column to participants table
ALTER TABLE public.participants
ADD COLUMN date_of_birth DATE;

-- Create function to calculate age from date of birth
CREATE OR REPLACE FUNCTION public.calculate_age(birth_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF birth_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN DATE_PART('year', AGE(CURRENT_DATE, birth_date))::INTEGER;
END;
$$;

-- Create trigger function to automatically update age when date_of_birth changes
CREATE OR REPLACE FUNCTION public.update_participant_age()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Calculate age from date_of_birth
    IF NEW.date_of_birth IS NOT NULL THEN
        NEW.age := public.calculate_age(NEW.date_of_birth);
        NEW.is_18_or_over := (NEW.age >= 18);
    ELSE
        NEW.age := NULL;
        NEW.is_18_or_over := false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically calculate age on insert or update
DROP TRIGGER IF EXISTS trigger_update_participant_age ON public.participants;
CREATE TRIGGER trigger_update_participant_age
    BEFORE INSERT OR UPDATE OF date_of_birth
    ON public.participants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_participant_age();

-- Update existing participants to calculate age from date_of_birth if age exists
-- This is a one-time migration to preserve existing data
DO $$
DECLARE
    participant_record RECORD;
BEGIN
    FOR participant_record IN 
        SELECT id, age 
        FROM public.participants 
        WHERE age IS NOT NULL AND date_of_birth IS NULL
    LOOP
        -- Estimate date_of_birth from age (using January 1st of birth year)
        UPDATE public.participants
        SET date_of_birth = MAKE_DATE(
            EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - participant_record.age,
            1,
            1
        )
        WHERE id = participant_record.id;
    END LOOP;
    
    RAISE NOTICE 'Migrated existing age data to date_of_birth for % participants', 
        (SELECT COUNT(*) FROM public.participants WHERE date_of_birth IS NOT NULL);
END $$;