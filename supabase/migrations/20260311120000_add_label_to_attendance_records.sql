-- Add label column to attendance_records to store participant role per event
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS label VARCHAR(50) NOT NULL DEFAULT 'participant';

-- Ensure only valid label values are stored
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_label_check
  CHECK (label IN ('participant', 'leader', 'volunteer'));
