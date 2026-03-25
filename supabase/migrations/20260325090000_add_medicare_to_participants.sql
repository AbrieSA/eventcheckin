-- Add medicare column to participants table so attendee Medicare details persist
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS medicare TEXT;

COMMENT ON COLUMN public.participants.medicare IS 'Participant Medicare details or number';
