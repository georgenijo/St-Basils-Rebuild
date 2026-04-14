# QA Test Scenarios — Issue #184: Transactional notification emails

## Context for scope

No Vercel preview URL exists (branch not pushed, no PR). No `.pipeline/test-credentials.json`. The new code depends on a Supabase migration (`notification_preferences` column) that has not been applied to any environment. This constrains E2E testing:

- **Cannot test** admin email sends, settings page rendering, invite welcome flow, or dues-reminder cron output end-to-end — all require migration + seeded fixtures against a live deployment.
- **Can test**: cron auth gating (no DB needed), route-level auth redirects (no DB needed), unit test suite, template compile/render.

Recommendation: push branch, let Vercel build a preview, apply migration in the preview Supabase project, then re-run full E2E.

## Scenarios

### S1: Cron route returns 401 without Authorization header
- **Type:** error-state (security)
- **Preconditions:** dev server up, migration NOT required (route exits before any DB work).
- **Steps:** GET `/api/cron/dues-reminders` with no `Authorization` header.
- **Expected:** 401 JSON `{"error":"unauthorized"}`.
- **Method:** playwright-cli

### S2: Cron route returns 401 with wrong bearer
- **Type:** error-state (security)
- **Preconditions:** dev server up, `CRON_SECRET` set or unset.
- **Steps:** GET with `Authorization: Bearer wrong-secret`.
- **Expected:** 401.
- **Method:** playwright-cli

### S3: Cron route returns 401 with `Bearer undefined` (regression — prior CVE from code review)
- **Type:** error-state (security)
- **Preconditions:** `CRON_SECRET` unset in local env.
- **Steps:** GET with `Authorization: Bearer undefined`.
- **Expected:** 401 — fail-closed behavior.
- **Method:** playwright-cli

### S4: `/member/settings` redirects to `/login` when unauthenticated
- **Type:** error-state (auth)
- **Preconditions:** dev server up, no session cookie.
- **Steps:** GET `/member/settings`.
- **Expected:** 302/redirect to `/login` (enforced by `(member)/layout.tsx`).
- **Method:** playwright-cli

### S5: Unit test suite passes
- **Type:** regression
- **Preconditions:** deps installed.
- **Steps:** `npm test`.
- **Expected:** 251/251 pass.
- **Method:** manual (already verified in implementation phase).

### S6: Existing smoke tests pass
- **Type:** regression
- **Preconditions:** dev server up.
- **Steps:** `npm run test:smoke`.
- **Expected:** no regressions from email/layout/migration additions.
- **Method:** playwright-cli

### S7 (deferred — requires preview): Admin confirms pending payment → PaymentConfirmed email queued
- **Type:** happy-path
- **Deferred:** needs migration applied + admin+member fixtures + mock email sink.

### S8 (deferred): Admin rejects pending payment → PaymentRejected email sent
- **Deferred:** same reason as S7.

### S9 (deferred): Admin assigns event charges → EventChargeAssigned per family
- **Deferred:** same.

### S10 (deferred): Member buys shares → SharesPurchased email
- **Deferred:** same.

### S11 (deferred): Admin marks shares paid → SharesPaid email
- **Deferred:** same.

### S12 (deferred): Admin records membership payment → MembershipRenewed email
- **Deferred:** same.

### S13 (deferred): Invite flow set-password sends WelcomeMember
- **Deferred:** needs Supabase auth admin invite + email sink.

### S14 (deferred): Member toggles prefs on `/member/settings` → update persists and gates future emails
- **Deferred:** needs auth'd session + DB migration.

### S15 (deferred): Cron `/api/cron/dues-reminders` with valid Bearer runs full batch
- **Deferred:** needs `CRON_SECRET` env + families with expiry dates seeded.

## Method plan

- Run S1–S4, S6 against local `npm run dev`.
- S5 re-verify via `npm test`.
- Document S7–S15 as deferred with clear preconditions; flag in QA results for the ship stage to pick up against a preview URL.
