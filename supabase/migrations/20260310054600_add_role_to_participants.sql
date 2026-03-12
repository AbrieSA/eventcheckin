-- Add role column to participants table
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Participant';
