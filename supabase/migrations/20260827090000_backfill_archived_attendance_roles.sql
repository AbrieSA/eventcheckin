-- Backfill archived attendance labels from the current participant role.
--
-- This deliberately excludes active and post-14 July 2026 events so that
-- current check-in data and newer role-aware attendance history are untouched.
-- The mismatch predicate makes the update idempotent: reapplying it changes no
-- rows once the archived labels match their participant roles.
UPDATE public.attendance_records AS ar
SET label = lower(trim(p.role))
FROM public.events AS e,
     public.participants AS p
WHERE e.id = ar.event_id
  AND p.id = ar.participant_id
  AND e.is_active = false
  AND e.event_date < DATE '2026-07-15'
  AND lower(trim(ar.label)) IS DISTINCT FROM lower(trim(p.role));
