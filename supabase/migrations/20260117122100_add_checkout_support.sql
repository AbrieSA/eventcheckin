-- Add checked_out_at column to attendance_records table
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.attendance_records.checked_out_at IS 'Timestamp when participant checked out of the event';

-- Create index for performance on checkout queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_checked_out_at ON public.attendance_records(checked_out_at);

-- Log success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added checked_out_at column to attendance_records table';
END $$;