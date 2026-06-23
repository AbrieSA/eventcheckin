-- Track whether the participant's signed form has been received.
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS form_received BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.participants.form_received IS 'Whether the participant form has been received';
