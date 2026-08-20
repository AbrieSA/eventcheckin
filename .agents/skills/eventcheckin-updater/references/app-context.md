# EventMe App Context

## Local workflow

- Install dependencies: `npm install`
- Development server: `npm start`
- Local URL: `http://127.0.0.1:5000`
- Production build: `npm run build`
- Preview build: `npm run serve`
- Build output: `build/` (local-only)

## Stack

- React 18 and React Router 6
- Vite 8
- Tailwind CSS 3
- Supabase authentication and PostgREST data access
- Lucide icons through `src/components/AppIcon.jsx`

## Application map

| Route | Primary implementation | Access |
| --- | --- | --- |
| `/authentication-login` | `src/pages/authentication-login/` | Public |
| `/home-dashboard` | `src/pages/home-dashboard/` | Authenticated |
| `/event-check-in-interface` | `src/pages/event-check-in-interface/` | Authenticated |
| `/database-participants` | `src/pages/database-participants/` | Admin and super admin |
| `/previous-events-archive` | `src/pages/previous-events-archive/` | Admin and super admin |
| `/user-management-dashboard` | `src/pages/user-management-dashboard/` | Super admin |

Routing and role enforcement live in `src/Routes.jsx`. Authentication state and profile loading live in `src/contexts/AuthContext.jsx`.

## Data boundaries

- `src/lib/supabase.js` creates the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `src/services/attendanceService.js` is the shared event, participant, and attendance data boundary.
- `src/services/userManagementService.js` handles user administration.
- `supabase/migrations/` is the source of truth for tables, constraints, functions, indexes, and Row Level Security.
- `supabase/functions/` contains privileged user-management and error-reporting functions.

## Verification reminders

- Verify both cold and repeat navigation when changing caching or loading behavior.
- Check zero, empty, loading, error, and populated states.
- Verify role-protected routes with the correct account type.
- For participant changes, smoke-test search, details, attendance history, add/edit/delete, and export as applicable.
- Use `npm.cmd` instead of the PowerShell `npm` shim when local execution policy blocks `npm.ps1`.
