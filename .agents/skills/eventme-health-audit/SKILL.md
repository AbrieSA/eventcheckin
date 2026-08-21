---
name: eventme-health-audit
description: Audit the EventMe repository for branch and deployment alignment, build health, sensitive-file hygiene, Supabase migration safety, privacy guardrails, and key application regressions. Use for periodic health checks or before declaring EventMe main and production healthy; do not use this skill as authorization to fix, merge, push, delete, or change live data.
---

# EventMe Health Audit

Produce an evidence-backed, read-only assessment of whether EventMe is healthy locally, on GitHub, and in production.

## Audit boundaries

- Treat the audit as read-only. Do not commit, merge, push, delete branches, edit files, run `npm audit fix`, apply migrations, or change Vercel/Supabase state without a separate explicit request.
- Preserve `.env` and never print its contents or any credentials.
- Do not exercise add, edit, delete, check-in, check-out, email, export, or other live-data actions during browser smoke tests.
- Leave `build/`, local server logs, `.codex-artifacts/`, and `supabase/.temp/` uncommitted. Report tracked or unexpectedly staged instances.
- Distinguish verified facts from checks blocked by authentication, unavailable tools, or missing environments.

## Repository audit

1. Work from the repository root and run `git status --short --branch` before other checks.
2. Run [scripts/collect_health_audit.ps1](scripts/collect_health_audit.ps1) from PowerShell. Use `-SkipFetch` only when network access is unavailable, `-SkipBuild` only when the user requests a lightweight audit, and `-IncludeDependencyAudit` for an explicit dependency-security review.
3. Inspect any reported divergence rather than assuming a feature branch is stale. EventMe's expected resting state is:
   - GitHub's default branch is `main`;
   - local `main`, `origin/main`, and deployed production use the same commit;
   - no feature branch remains after its work is integrated, unless it is intentionally active;
   - no uncommitted application change is mistaken for deployed code.
4. Check open pull requests and commit/deployment status through GitHub when authenticated. A successful HTTP response alone does not prove the newest `main` commit is deployed; match the production deployment SHA to `origin/main`.
5. Report the absence of automated tests or CI as an assurance gap, not as a build failure.

## EventMe safeguards

Inspect the current code when relevant and verify these application-specific invariants:

- Participant medical, Medicare, contact, consent, notes, or date-of-birth data is not persisted in `localStorage` or `sessionStorage`.
- Participant list loading does not fetch full attendance histories per participant; histories remain on demand.
- Participant database caching is invalidated after relevant writes and across authentication-user changes.
- Camel-case UI data is mapped to snake-case database fields in `src/services/attendanceService.js`.
- Schema changes exist as ordered files in `supabase/migrations/`; no `supabase/.temp` file is tracked.
- New or changed tables, functions, and policies preserve authenticated-user and Row Level Security expectations.
- `.env`, generated builds, logs, and temp metadata are ignored and untracked.

Use focused searches and diffs. Do not claim a safeguard is healthy merely because a filename exists.

## Runtime smoke test

For a full audit, reuse or start the EventMe server at `http://127.0.0.1:5000` and perform read-only browser checks with the current authenticated session when available:

- confirm the expected page identity for the dashboard, participant database, and archive;
- verify cold and repeat participant-database navigation;
- check populated and obvious loading/error/empty-state behavior without altering data;
- open and close participant details and attendance history;
- test the participant-details header at a narrow phone viewport;
- inspect fresh browser console errors after a clean reload.

If authentication is unavailable, report the protected routes as not verified and continue with static, build, GitHub, and deployment checks.

## Assessment

Lead with one verdict:

- **Healthy**: `main`, production, build, and applicable safeguards are verified with no material findings.
- **Attention needed**: production still works, but branch drift, missing verification, stale branches, warnings, or medium-risk regressions remain.
- **Unhealthy**: build failure, failed/currently mismatched production, exposed sensitive artifacts, or a high-risk security/data-integrity issue exists.

Then report:

1. exact local, remote-main, and production commit identities;
2. build, test/CI, and browser results;
3. findings ordered by severity with file/line evidence when applicable;
4. unverified areas and why;
5. the smallest recommended next actions.

Do not describe the repository as clean when ignored local artifacts are safe but visible untracked files or uncommitted source changes still exist; state that distinction plainly.
