-- Add self_sign_out_permission and person_to_go_home_with columns to participants table
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS self_sign_out_permission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS person_to_go_home_with TEXT;
