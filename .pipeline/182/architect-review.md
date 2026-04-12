# Architect Review — Issue #182: Notify subscribers when a recurring event is cancelled or modified

## VERDICT: APPROVED

## Review Summary
The plan is well-structured, follows existing codebase patterns, and correctly solves all acceptance criteria. It makes good architectural choices: co-locating notification logic with server actions (not a separate edge function), using the existing `sendEmail()` utility with mock transport support, and keeping email failures non-blocking. The single-template approach with `changeType` prop is clean. Minor concerns noted below but none blocking.

## Detailed Review

### Correctness: PASS
- All six acceptance criteria from the issue are covered in the plan.
- Step ordering is correct: validators → template → helper → wire into actions → UI → lint.
- The restore action concern (deleting the instance row before sending notification) is correctly addressed — the helper queries the parent `events` table, not `event_instances`.
- The `rrule` package `.after()` approach for next occurrence computation is correct.

### Architecture Alignment: PASS
- RLS enforcement: The server actions use the session-scoped Supabase client. Admin RLS policies on `email_subscribers` ensure only admins can read subscriber data. No bypass needed.
- UTC in, local out: The plan correctly uses `formatInChurchTimeZone()` for email content. Timestamps stay in UTC in the DB.
- Supabase for data: Correct — subscriber data and events are in Supabase, not Sanity.
- Server components by default: The `OccurrenceModal` is already `'use client'` (required for forms/interactivity). No new client components introduced.
- One ticket per branch: Scope is appropriate — just notification layer on top of #181.

### Database Design: PASS
- No new tables or migrations needed. Correct assessment.
- The subscriber query pattern (`.eq('confirmed', true).is('unsubscribed_at', null)`) matches the existing broadcast pattern exactly.
- The join query for `events` + `recurrence_rules` is valid — FK relationship exists.

### Security: PASS
- Admin-only operations gated by existing auth checks in server actions (line 49-50 checks `getUser()`).
- Subscriber data read is RLS-protected (admin SELECT policy).
- No SQL injection risk — all queries use Supabase query builder.
- Zod validation on `notify_subscribers` input — validated as optional string.
- No secrets in code — Resend API key accessed via environment variable through the existing `resend` singleton.

### Implementation Quality: CONCERN
- Steps are atomic and independently verifiable. Good.
- Each step has a real verify command (`npx tsc --noEmit`).
- Existing patterns are well-referenced.

CONCERN: Step 4 description for `upsertEventInstance` references `event.startAt` and `event.endAt` as if they're available in the action scope, but the action doesn't fetch the parent event — it only receives form data. The helper function should handle all event data fetching internally (which the plan's Step 3 design already does). The Step 4 description's pseudo-code for the `details` parameter should simply omit `oldStartAt`/`oldEndAt`/`oldLocation` and let the helper compute the diff internally by fetching the parent event. The implementer should note this and pass only the override values, not "old" values.

### Risk Assessment: PASS
- All risks from context brief addressed with reasonable mitigations.
- Parish-scale volume assumption is sound for v1.
- The `rrule.after()` graceful fallback for non-recurring events is noted.

## Recommendations (non-blocking)
- In Step 3, when computing the "next occurrence" for cancellations, handle the edge case where the cancelled date IS the last occurrence (no `.after()` result). Display "This was the final scheduled occurrence" or similar instead of omitting the next occurrence line.
- Consider wrapping the email sending loop in a try-catch per subscriber so one bad email address doesn't prevent notification to remaining subscribers.
- The helper function in Step 3 should compute the "old vs new" diff for modified occurrences internally by comparing the parent event's `start_at`/`end_at`/`location` against the overrides, rather than receiving old values as parameters. This simplifies the caller in Step 4.

## Approved Scope
Implementation of email notifications for event instance changes:
1. Zod validator updates (3 schemas)
2. One new React Email template (`event-change-notification.tsx`)
3. Notification helper function in `event-instances.ts`
4. Wiring into all three server actions
5. Checkbox UI in OccurrenceModal (4 forms)
6. Lint/type verification
