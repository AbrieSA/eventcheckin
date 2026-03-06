-- Migration: Add active event support
-- Add is_active column to events table to track the current active event

-- Add is_active column with default false
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Create index for faster active event queries
CREATE INDEX IF NOT EXISTS idx_events_is_active ON public.events(is_active) WHERE is_active = true;

-- Add constraint to ensure only one active event at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_event ON public.events(is_active) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.events.is_active IS 'Indicates if this is the current active event. Only one event can be active at a time.';

DO $$
BEGIN
    RAISE NOTICE 'Active event support added successfully';
END $$;