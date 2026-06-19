-- Fix participant ID generation to ignore malformed historical IDs.
CREATE OR REPLACE FUNCTION public.get_next_participant_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.get_next_participant_number() TO authenticated;
