ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.participants.notes IS
  'Free-form operational notes for the participant';
