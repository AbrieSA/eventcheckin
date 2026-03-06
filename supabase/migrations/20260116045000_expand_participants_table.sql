-- Migration: Expand participants table with comprehensive tracking fields
-- Created: 2026-01-16
-- Purpose: Add detailed participant information including personal details, medical info, emergency contacts, and consent tracking

-- Add personal information fields
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add age verification field
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS is_18_or_over BOOLEAN DEFAULT false;

-- Add allergy tracking fields
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS allergies_details TEXT;

-- Add medical condition tracking fields
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS medical_condition_details TEXT;

-- Add emergency contact fields
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS emergency_contact_surname TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_email TEXT;

-- Rename existing emergency_contact_relationship to match new naming convention
ALTER TABLE public.participants
RENAME COLUMN emergency_contact_relationship TO emergency_contact_relationship_to_minor;

-- Add consent tracking fields
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS media_consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_treatment_consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS future_contact_permission_given BOOLEAN DEFAULT false;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_participants_email ON public.participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_phone ON public.participants(phone);
CREATE INDEX IF NOT EXISTS idx_participants_last_name ON public.participants(last_name);
CREATE INDEX IF NOT EXISTS idx_participants_is_18_or_over ON public.participants(is_18_or_over);

-- Add comment to document the table structure
COMMENT ON TABLE public.participants IS 'Comprehensive participant tracking with personal details, medical information, emergency contacts, and consent records';

-- Add column comments for clarity
COMMENT ON COLUMN public.participants.first_name IS 'Participant first name';
COMMENT ON COLUMN public.participants.last_name IS 'Participant last name';
COMMENT ON COLUMN public.participants.phone IS 'Participant contact phone number';
COMMENT ON COLUMN public.participants.email IS 'Participant contact email address';
COMMENT ON COLUMN public.participants.age IS 'Participant age in years';
COMMENT ON COLUMN public.participants.is_18_or_over IS 'Boolean flag indicating if participant is 18 years or older';
COMMENT ON COLUMN public.participants.has_allergies IS 'Boolean flag indicating if participant has allergies';
COMMENT ON COLUMN public.participants.allergies_details IS 'Detailed description of participant allergies';
COMMENT ON COLUMN public.participants.has_medical_conditions IS 'Boolean flag indicating if participant has medical conditions';
COMMENT ON COLUMN public.participants.medical_condition_details IS 'Detailed description of participant medical conditions';
COMMENT ON COLUMN public.participants.emergency_contact_name IS 'Emergency contact first name';
COMMENT ON COLUMN public.participants.emergency_contact_surname IS 'Emergency contact last name';
COMMENT ON COLUMN public.participants.emergency_contact_email IS 'Emergency contact email address';
COMMENT ON COLUMN public.participants.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN public.participants.emergency_contact_relationship_to_minor IS 'Relationship of emergency contact to the participant (if minor)';
COMMENT ON COLUMN public.participants.media_consent_given IS 'Boolean flag indicating if media consent has been given';
COMMENT ON COLUMN public.participants.emergency_treatment_consent_given IS 'Boolean flag indicating if emergency medical treatment consent has been given';
COMMENT ON COLUMN public.participants.future_contact_permission_given IS 'Boolean flag indicating if permission for future contact has been given';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Participants table expanded with comprehensive tracking fields';
END $$;