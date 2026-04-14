# Architect Review — Issue #184: Transactional notification emails for payments, membership, and account events

## VERDICT: APPROVED

## Review Summary
Plan covers all 10 templates, wires into correct server actions, adds prefs column + settings page + daily cron. Scope matches issue. A few concerns on clarity and error handling — non-blocking. Implementer should execute the **final** chosen approach in Step 10 and ignore the preceding deliberation.

## Detailed Review

### Correctness: PASS
- All 9 acceptance criteria mapped to steps.
- Step ordering correct: migration → layout component → templates → helper → action wiring → cron → settings page.
- FamilyLinked explicitly scoped as template-only (issue calls for it, no admin link action exists — correct call, documented in context brief).
- Dependencies #180/#152/#161/#179 confirmed merged; trigger points (`confirmPayment`, `rejectPayment`, `assignEventCosts`, `buyShares`, `markSharesPaid`, `setPassword`, `recordPaymentReceived`) all exist.

### Architecture Alignment: PASS
- Server components by default (Step 13 isolates form into client component — right call).
- Cron uses service-role admin client, correct for batch ops.
- Sanity vs Supabase boundary respected (prefs in Supabase `profiles` — structured data).
- One PR per ticket, branch already allocated.
- **CONCERN**: `sendFamilyNotification` in Step 7 spec doesn't mention try/catch wrapping. Risk table item "Email failures silently breaking actions" exists but Step 7 must actually implement it. Implementer: wrap each `sendEmail` call in try/catch inside `sendFamilyNotification`; log failure, don't rethrow.

### Database Design: PASS
- `notification_preferences JSONB NOT NULL DEFAULT '{...}'::jsonb` — correct.
- Migration timestamp `20260412100000` doesn't collide with latest `20260412000005`. Good.
- No FKs/indexes needed (JSONB read on single row lookup by `id`).
- RLS analysis correct: existing profiles update policy covers non-role columns.

### Security: PASS
- Cron secret: `Authorization: Bearer ${CRON_SECRET}` — matches Vercel's documented pattern.
- Zod validation on prefs update (Step 12).
- Auth check in `updateNotificationPreferences` action.
- Service-role client used only inside cron route, not exposed.
- **CONCERN**: Step 12 Zod schema uses `z.boolean()` but FormData values are strings. Action must preprocess (`z.preprocess(v => v === 'true' || v === 'on', z.boolean())`) or parse via `formData.get(key) === 'on'` before schema validation. Plan hand-waves this in the action body — make it explicit.

### Implementation Quality: PASS
- Each step has files, what-to-do, pattern reference, verify command, done-when. Good structure.
- Patterns reference real files (`announcement-broadcast.tsx`, `payment-rejected.tsx`, `admin-payments.ts:369-389`) — all verified to exist.
- **CONCERN**: Step 10 waffles through 5 approaches before landing. Implementer: execute **only** the final "Revised approach" (pass `flow` query param from callback → hidden input → conditional email send). Ignore alternatives 1-4.
- **CONCERN**: Step 14 says "Need to find the member layout" — file is `src/app/(member)/layout.tsx` (verified). Add the link there.

### Risk Assessment: PASS
- Timezone risk acknowledged (DATE column, UTC comparison in cron).
- Email volume within free tier.
- FamilyLinked scoped correctly as out-of-scope wiring.
- Email failure isolation listed in risk table (must be implemented per Step 7 concern above).

## Required Changes (if REJECTED)
N/A — approved.

## Recommendations (non-blocking)
- Step 7: wrap `sendEmail` per-recipient in try/catch so one bad email doesn't abort the loop.
- Step 10: delete approaches 1-4 from the plan notes during implementation; only "Revised approach" matters.
- Step 11: log cron output (reminders14/3/expired counts) to stderr so Vercel function logs show activity.
- Step 13: use native `<input type="checkbox">` for toggles — avoids extra component. Tailwind styling fine.
- Consider a smoke-test verification: run `EMAIL_TRANSPORT=mock` locally and trigger `confirmPayment` to verify one email lands in `.e2e/mailbox/`.

## Approved Scope
- Migration `20260412100000_add_notification_preferences.sql` adding JSONB column to `profiles`.
- `src/emails/components/email-layout.tsx` shared layout.
- 9 new templates + refactor of `payment-rejected.tsx` to use shared layout.
- `src/lib/notifications.ts` helper with `shouldNotify`, `getFamilyEmails`, `sendFamilyNotification`.
- Email wiring into `admin-payments.ts` (confirmPayment, rejectPayment, assignEventCosts, recordPaymentReceived-membership), `shares.ts` (buyShares, markSharesPaid), `set-password.ts` (welcome on invite flow only).
- `src/app/api/cron/dues-reminders/route.ts` + `vercel.json` daily cron.
- `src/actions/notifications.ts` + Zod schema for preference updates.
- `src/app/(member)/member/settings/page.tsx` settings page.
- Settings link in `src/app/(member)/layout.tsx`.
- FamilyLinked template created but NOT wired (admin link action absent).
