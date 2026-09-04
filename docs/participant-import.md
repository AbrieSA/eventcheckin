# Participant CSV updates

Admins and super admins can preview and apply CSV updates to existing participants. Blank cells preserve existing data; UUID and participant ID are matching-only fields. Every mapped identifier must agree with the existing participant. Conflicting, unmatched, ambiguous, duplicate-target, or invalid rows block the entire batch. The maximum is 5,000 data rows.

Preview returns record versions. Apply validates again, locks records, and rejects stale versions. All updates run in one transaction. Participant audit entries retain identifying names/IDs and changed field names without copying medical, contact, consent, or date-of-birth values. Existing historical audit rows are not changed.

## Verification

Run `npm run test:participant-import` for 59 checks using an isolated PGlite database and synthetic records. Coverage includes real SQL roles and RLS, validation, 51-row apply, the 5,000-row boundary, rollback after an injected failure, stale versions, audit privacy, CSV parsing, and frontend payload conversion. The suite does not simulate concurrent database connections.

Run `npm run build` for the frontend build. Browser verification covered desktop and 390px mobile mapping, confirmation, success, and refresh-failure handling with synthetic service responses.

## Database deployment, 2026-09-05

The linked database has incomplete historical migration bookkeeping despite having the required live schema and security helper. Do not replay all historical migrations with `--include-all`, or mark them applied without comparing their effects.

Migration `20260904090000_add_participant_import_updates.sql` was first executed against the linked schema inside a rolled-back transaction. It was then deployed alone in a transaction together with its exact SQL in `supabase_migrations.schema_migrations` under version `20260904090000`, name `add_participant_import_updates`. PostgREST was notified to reload its schema. Verification confirmed the RPC exists, anonymous execution is denied, and the admin UPDATE policy exists. No participant import was applied during deployment.

The historical bookkeeping mismatch remains a separate maintenance task; this deployment records only the migration actually applied. Future normal CLI pushes may still require that reconciliation.
