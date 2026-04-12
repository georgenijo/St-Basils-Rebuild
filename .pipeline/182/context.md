# Context Brief — Issue #182: Notify subscribers when a recurring event is cancelled or modified

## Issue Summary

When an admin cancels, modifies, or restores an individual occurrence of a recurring event (via the #181 UI), email notifications should be sent to confirmed subscribers. The admin controls whether to notify via a checkbox in the occurrence modal. Three email templates are needed: cancelled, modified, and restored.

## Type

feature

## Acceptance Criteria

- Cancelling an occurrence with "notify" checked sends email to confirmed subscribers
- Modifying an occurrence with "notify" checked sends email with change details
- Restoring an occurrence with "notify" checked sends "back on" email
- Email includes the event name, date, what changed, and next occurrence (for cancellations)
- Admin can opt out of sending notification (uncheck the box)
- Uses existing Resend infrastructure and React Email templates
- Default: checked for cancellations, unchecked for edits (per issue recommendation)

## Codebase Analysis

### Files Directly Involved

| File                                          | Why                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/actions/event-instances.ts`              | Server actions that handle cancel/modify/restore — notification logic added here          |
| `src/components/features/OccurrenceModal.tsx` | Admin UI — add "notify subscribers" checkbox to EditView, CancelView, and restore actions |
| `src/lib/validators/event.ts`                 | Zod schemas — add `notify_subscribers` boolean to all three instance schemas              |
| `src/emails/event-change-notification.tsx`    | NEW — React Email template for all three change types                                     |
| `src/lib/email.ts`                            | Existing `sendEmail()` utility — used to send individual emails                           |
| `src/lib/resend.ts`                           | Existing Resend singleton — provides `resend` proxy object                                |
| `src/lib/email-sink.ts`                       | Mock email sink for testing — used automatically when `EMAIL_TRANSPORT=mock`              |
| `src/lib/event-time.ts`                       | `formatInChurchTimeZone()` for formatting dates in email bodies                           |

### Database Impact

- Tables affected: `email_subscribers` (read confirmed subscribers), `event_instances` (already written by #181 actions), `events` (read parent event title/details)
- New tables needed: none
- Migration dependencies: none — all tables exist
- RLS considerations: Server actions already run as authenticated admin. Reading `email_subscribers` requires admin role (RLS already enforces this). No new RLS policies needed.

### Existing Patterns to Follow

| Pattern                         | Example File                                                                                   | Notes                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React Email template structure  | `src/emails/announcement-broadcast.tsx`                                                        | Church brand styles: #253341 header, #9B1B3D burgundy CTA, #D4A017 gold divider, #FFFDF8 off-white. Uses `@react-email/components`. Container max-width 560px. Unsubscribe link in footer. |
| Email sending via `sendEmail()` | `src/actions/newsletter.ts` lines 73, 120, 149                                                 | From address: `"St. Basil's Church <noreply@stbasilsboston.org>"`. Uses `sendEmail()` from `@/lib/email`. Supports mock transport automatically.                                           |
| Subscriber query                | `supabase/functions/announcement-email/index.ts` lines 304-308                                 | `.from('email_subscribers').select('email, name, unsubscribe_token').eq('confirmed', true).is('unsubscribed_at', null)`                                                                    |
| Batch sending                   | `supabase/functions/announcement-email/index.ts` lines 335-358                                 | Batches of 100 via Resend batch API. But for server actions, simpler to loop with `sendEmail()` since volume is low (parish scale).                                                        |
| Form action with FormData + Zod | `src/actions/event-instances.ts`                                                               | `formData.get('field')` → Zod parse → Supabase query → `revalidatePath()` → return `ActionState`                                                                                           |
| Checkbox in form data           | Standard HTML: `formData.get('notify_subscribers')` returns `"on"` when checked, null when not |

### Test Coverage

- Existing tests: `e2e/pipeline/181.spec.ts` covers occurrence edit/cancel/restore flows
- Test gaps: No email notification tests for event changes. The mock email sink infrastructure exists and can verify emails were sent.

### Related Issues

| Issue | Relationship                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| #181  | Prerequisite — provides the admin UI and server actions this builds on (MERGED)                                            |
| #184  | Parallel — transactional notification emails for payments/membership/account (different scope, but similar email patterns) |

## Risks

- **Email volume on free tier**: Resend free tier is 100 emails/day. A popular recurring event cancelled could send emails to all subscribers. Parish scale (~50-200 subscribers) should be fine, but no batching safeguard exists in server actions. Mitigation: use `sendEmail()` in a loop (not batch API) for simplicity; volume is low.
- **Server action timeout**: Sending many emails sequentially in a server action could be slow. Mitigation: parish scale makes this unlikely to timeout. For future scale, could move to background job.
- **Restore action deletes the row**: `restoreEventInstance` calls `.delete()` on the instance row. The notification needs the event data BEFORE the delete happens, and must fetch the parent event for context.
- **No "next occurrence" calculation**: The issue asks for "next occurrence date" in cancellation emails. This requires RRULE expansion logic. The codebase has `rrule` package installed. Need to compute next occurrence after the cancelled date.

## Key Conventions

- UTC in, local out — store UTC, display in America/New_York at the boundary
- Server components by default — `'use client'` only for interactivity
- RLS is the authorization layer — but email sending runs server-side as admin, so RLS is already satisfied
- From address for notifications: `"St. Basil's Church <noreply@stbasilsboston.org>"`
- Email metadata should include `template` key for filtering in mock email sink
- Unsubscribe link: `${siteUrl}/api/newsletter/unsubscribe?token=${unsubscribe_token}`
