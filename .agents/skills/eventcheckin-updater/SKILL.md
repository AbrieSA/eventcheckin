---
name: eventcheckin-updater
description: Maintain and update the AbrieSA/eventcheckin EventMe React, Vite, Tailwind, and Supabase app. Use when Codex needs to change or diagnose the EventMe check-in app, refine its UI, adjust event or attendee workflows, work on participant database, archive, authentication, or admin screens, verify the local app, or publish approved EventMe changes.
---

# Eventcheckin Updater

Maintain EventMe without losing existing behavior, sensitive configuration, or unrelated user work.

## Start

1. Work from the repository root containing `package.json`, `src/`, and `supabase/`.
2. Run `git status --short --branch` before editing.
3. Read [references/app-context.md](references/app-context.md) when the task needs the route map, service boundaries, commands, or current local URL.
4. Inspect the affected component, service, and database migration history before deciding how to change behavior.

## Update Workflow

1. Preserve unrelated working-tree changes and make the smallest cohesive change that satisfies the request.
2. Keep UI and data behavior consistent across desktop and responsive layouts.
3. Preserve the existing camelCase-to-snake_case service boundary in `src/services/attendanceService.js`.
4. For visual or interaction work, run or reuse `npm start` and validate the affected route at `http://127.0.0.1:5000` in the in-app browser when available.
5. After edits, reload the affected page and verify:
   - the expected route and page identity;
   - meaningful content and empty/loading/error states;
   - the changed interaction;
   - browser console health.
6. Run `npm run build` unless the user explicitly asks to leave testing to them.
7. Use an independent reviewer for changes involving authentication, caching, database writes, or cross-screen state.

## Supabase and Sensitive Data

1. Preserve `.env`; never print, commit, or replace its secrets.
2. Prefer an available Supabase connector or skill for schema inspection. Otherwise, inspect `supabase/migrations/` and the existing service queries.
3. Before a database write, perform a read-only preview or count, state the exact table and filters, and verify the result afterward.
4. Preserve Row Level Security expectations and authenticated-user boundaries.
5. Do not persist participant medical, Medicare, contact, consent, or date-of-birth data in browser storage unless the user explicitly accepts the privacy tradeoff.
6. Add migrations for schema changes; do not rely on undocumented manual production edits.

## Publishing

1. Never stage local-only files such as `.env`, `build/`, `.codex-artifacts/`, or Vite log files.
2. Inspect the staged diff and include only files belonging to the approved change.
3. When the user asks to push, use the available GitHub publishing workflow. Default to a feature branch and draft pull request unless the user explicitly authorizes a direct default-branch push.
4. Report the branch, commit, pull request or target branch, and validation results.
5. Never revert unrelated user changes to obtain a clean worktree.

## Focus Areas

- Dashboard and event creation: `src/pages/home-dashboard/`, `src/components/ui/EventModal.jsx`
- Live check-in: `src/pages/event-check-in-interface/`, `src/components/ui/LogEventModal.jsx`
- Participant creation: `src/components/ui/AddAttendeeModal.jsx`
- Participant database: `src/pages/database-participants/`
- Archived events: `src/pages/previous-events-archive/`
- Authentication and authorization: `src/contexts/AuthContext.jsx`, `src/Routes.jsx`
- Shared data access: `src/services/attendanceService.js`, `src/lib/supabase.js`
- Database evolution and policies: `supabase/migrations/`

## Guardrails

- Keep full attendance-history queries on demand rather than on list-page load.
- Treat old console messages as stale only after a clean reload proves the issue does not reproduce.
- Do not remove dependencies listed under `rocketCritical` without explicit user approval and a verified replacement.
- Keep generated `build/` output uncommitted.
