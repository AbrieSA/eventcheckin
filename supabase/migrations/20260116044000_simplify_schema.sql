-- Migration: Simplify schema for attendance tracking
-- Remove event_participants table (no registration needed)
-- Update events table structure

-- Step 1: Drop dependent objects first
DROP POLICY IF EXISTS "users_manage_own_event_participants" ON public.event_participants;
DROP POLICY IF EXISTS "authenticated_users_can_view_event_participants" ON public.event_participants;
DROP POLICY IF EXISTS "authenticated_users_can_manage_event_participants" ON public.event_participants;

-- Step 2: Remove foreign key constraints from other tables
ALTER TABLE public.event_participants
DROP CONSTRAINT IF EXISTS event_participants_event_id_fkey;

ALTER TABLE public.event_participants
DROP CONSTRAINT IF EXISTS event_participants_participant_id_fkey;

-- Step 3: Drop the event_participants table
DROP TABLE IF EXISTS public.event_participants;

-- Step 4: Modify events table structure
-- Remove status and location columns
ALTER TABLE public.events
DROP COLUMN IF EXISTS status;

ALTER TABLE public.events
DROP COLUMN IF EXISTS location;

-- Add category and notes columns
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 5: Rename columns for clarity (optional but cleaner)
ALTER TABLE public.events
RENAME COLUMN name TO event_name;

ALTER TABLE public.events
RENAME COLUMN date TO event_date;

-- Step 6: Update existing data with default values
UPDATE public.events
SET category = 'General'
WHERE category IS NULL;

UPDATE public.events
SET notes = ''
WHERE notes IS NULL;

-- Step 7: Add sample data with new structure
DO $$
DECLARE
    sample_event_id UUID := gen_random_uuid();
BEGIN
    -- Insert sample event with new structure
    INSERT INTO public.events (id, event_name, event_date, category, notes, created_at, updated_at)
    VALUES (
        sample_event_id,
        'Community Meetup',
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        'Social',
        'Monthly community gathering for networking and updates',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Schema simplification completed successfully';
END $$;