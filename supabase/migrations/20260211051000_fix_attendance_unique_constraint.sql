-- Migration: Fix unique constraint on attendance_records table
-- The original migration had a UNIQUE constraint in the table definition
-- The second migration tried to add it again with a different name
-- This migration ensures we have exactly one properly named constraint

-- Step 1: Drop existing constraints if they exist
DO $$
BEGIN
  -- Drop the constraint added by the second migration if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_records_event_participant_unique'
  ) THEN
    ALTER TABLE public.attendance_records 
    DROP CONSTRAINT attendance_records_event_participant_unique;
    RAISE NOTICE 'Dropped constraint: attendance_records_event_participant_unique';
  END IF;

  -- Drop the original inline unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_records_event_id_participant_id_key'
  ) THEN
    ALTER TABLE public.attendance_records 
    DROP CONSTRAINT attendance_records_event_id_participant_id_key;
    RAISE NOTICE 'Dropped constraint: attendance_records_event_id_participant_id_key';
  END IF;
END $$;

-- Step 2: Clean up any duplicate records that might exist
-- Keep only the most recent record for each (event_id, participant_id) pair
DELETE FROM public.attendance_records
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY event_id, participant_id 
             ORDER BY 
               CASE WHEN checked_out_at IS NOT NULL THEN checked_out_at ELSE checked_in_at END DESC,
               created_at DESC
           ) as row_num
    FROM public.attendance_records
  ) t
  WHERE t.row_num > 1
);

-- Step 3: Add the unique constraint with a clear name
ALTER TABLE public.attendance_records
ADD CONSTRAINT attendance_records_unique_event_participant 
UNIQUE (event_id, participant_id);

-- Step 4: Add comment for documentation
COMMENT ON CONSTRAINT attendance_records_unique_event_participant 
ON public.attendance_records 
IS 'Ensures only one attendance record exists per participant per event. Allows upsert operations.';

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed unique constraint on attendance_records table';
END $$;