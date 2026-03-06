-- Events table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'upcoming', 'completed')),
    location TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Participants table
CREATE TABLE public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    age_group TEXT,
    has_allergies BOOLEAN DEFAULT false,
    allergies TEXT[],
    has_medical_conditions BOOLEAN DEFAULT false,
    medical_notes TEXT,
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    emergency_contact_relationship TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Junction table linking events to participants
CREATE TABLE public.event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, participant_id)
);

-- Attendance records table
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, participant_id)
);

-- Indexes for performance
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_participants_participant_id ON public.participants(participant_id);
CREATE INDEX idx_event_participants_event_id ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_participant_id ON public.event_participants(participant_id);
CREATE INDEX idx_attendance_records_event_id ON public.attendance_records(event_id);
CREATE INDEX idx_attendance_records_participant_id ON public.attendance_records(participant_id);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (open access for preview mode - no auth required)
CREATE POLICY "public_access_events"
ON public.events
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "public_access_participants"
ON public.participants
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "public_access_event_participants"
ON public.event_participants
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "public_access_attendance_records"
ON public.attendance_records
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Mock data for immediate testing
DO $$
DECLARE
    event1_id UUID := gen_random_uuid();
    event2_id UUID := gen_random_uuid();
    event3_id UUID := gen_random_uuid();
    p1_id UUID := gen_random_uuid();
    p2_id UUID := gen_random_uuid();
    p3_id UUID := gen_random_uuid();
    p4_id UUID := gen_random_uuid();
    p5_id UUID := gen_random_uuid();
    p6_id UUID := gen_random_uuid();
    p7_id UUID := gen_random_uuid();
    p8_id UUID := gen_random_uuid();
BEGIN
    -- Insert events
    INSERT INTO public.events (id, name, date, status, location) VALUES
        (event1_id, 'Summer Camp 2026 - Week 1', '2026-06-15T09:00:00Z', 'active', 'Community Center'),
        (event2_id, 'Art Workshop - Beginners', '2026-06-20T14:00:00Z', 'active', 'Art Studio'),
        (event3_id, 'Sports Day 2026', '2026-07-01T10:00:00Z', 'upcoming', 'Sports Complex');

    -- Insert participants
    INSERT INTO public.participants (
        id, participant_id, name, age_group, has_allergies, allergies, 
        has_medical_conditions, medical_notes, emergency_contact_name, 
        emergency_contact_phone, emergency_contact_relationship
    ) VALUES
        (p1_id, 'KID2026001', 'Emma Johnson', '8-10 years', true, ARRAY['Peanuts', 'Tree nuts'], 
         false, '', 'Sarah Johnson', '(555) 123-4567', 'Mother'),
        (p2_id, 'KID2026002', 'Liam Martinez', '6-8 years', false, ARRAY[]::TEXT[], 
         true, 'Asthma - inhaler required', 'Carlos Martinez', '(555) 234-5678', 'Father'),
        (p3_id, 'KID2026003', 'Sophia Chen', '10-12 years', false, ARRAY[]::TEXT[], 
         false, '', 'Wei Chen', '(555) 345-6789', 'Mother'),
        (p4_id, 'KID2026004', 'Noah Williams', '8-10 years', true, ARRAY['Dairy'], 
         false, '', 'Jennifer Williams', '(555) 456-7890', 'Mother'),
        (p5_id, 'KID2026005', 'Olivia Brown', '6-8 years', false, ARRAY[]::TEXT[], 
         false, '', 'Michael Brown', '(555) 567-8901', 'Father'),
        (p6_id, 'KID2026006', 'Ethan Davis', '10-12 years', true, ARRAY['Shellfish'], 
         true, 'Type 1 Diabetes', 'Amanda Davis', '(555) 678-9012', 'Mother'),
        (p7_id, 'KID2026007', 'Ava Garcia', '8-10 years', false, ARRAY[]::TEXT[], 
         false, '', 'Maria Garcia', '(555) 789-0123', 'Mother'),
        (p8_id, 'KID2026008', 'Mason Rodriguez', '6-8 years', false, ARRAY[]::TEXT[], 
         false, '', 'Luis Rodriguez', '(555) 890-1234', 'Father');

    -- Link participants to event 1 (Summer Camp)
    INSERT INTO public.event_participants (event_id, participant_id) VALUES
        (event1_id, p1_id),
        (event1_id, p2_id),
        (event1_id, p3_id),
        (event1_id, p4_id),
        (event1_id, p5_id),
        (event1_id, p6_id),
        (event1_id, p7_id),
        (event1_id, p8_id);

    -- Link participants to event 2 (Art Workshop)
    INSERT INTO public.event_participants (event_id, participant_id) VALUES
        (event2_id, p1_id),
        (event2_id, p3_id),
        (event2_id, p5_id),
        (event2_id, p7_id);

    -- Link participants to event 3 (Sports Day)
    INSERT INTO public.event_participants (event_id, participant_id) VALUES
        (event3_id, p2_id),
        (event3_id, p4_id),
        (event3_id, p6_id),
        (event3_id, p8_id);

    RAISE NOTICE 'Mock data created successfully';
END $$;