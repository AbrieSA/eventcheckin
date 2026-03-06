-- Migration: Add unique constraint to attendance_records table
-- This ensures only one attendance record exists per participant per event
-- Fixes issue where removing participants from "Out" status doesn't persist after refresh

-- Step 1: Clean up any duplicate records (keep the most recent one)
DELETE FROM public.attendance_records
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY event_id, participant_id 
             ORDER BY created_at DESC, checked_in_at DESC
           ) as row_num
    FROM public.attendance_records
  ) t
  WHERE t.row_num > 1
);

-- Step 2: Add the unique constraint
ALTER TABLE public.attendance_records
ADD CONSTRAINT attendance_records_event_participant_unique 
UNIQUE (event_id, participant_id);

-- Step 3: Add comment for documentation
COMMENT ON CONSTRAINT attendance_records_event_participant_unique 
ON public.attendance_records 
IS 'Ensures only one attendance record exists per participant per event';

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Successfully added unique constraint to attendance_records table';
END $$;