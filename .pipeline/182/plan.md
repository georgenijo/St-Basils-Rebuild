# Implementation Plan — Issue #182: Notify subscribers when a recurring event is cancelled or modified

## Approach Summary
Add email notifications to the existing occurrence edit/cancel/restore server actions. The admin controls notification via a checkbox in the OccurrenceModal. When checked, the server action fetches confirmed subscribers and sends a templated email to each using the existing `sendEmail()` utility. A single React Email template handles all three change types (cancelled, modified, restored) via a `changeType` prop. For cancellations, compute the next occurrence using the `rrule` package.

This approach is chosen over a Supabase Edge Function (like the announcement broadcast) because: (1) the notification is synchronous with the admin action — no webhook delay, (2) parish-scale volume (~50-200 subscribers) doesn't require batch infrastructure, and (3) it keeps the logic co-located with the server actions for simplicity.

## Prerequisites
- Issue #181 merged (provides `event_instances` server actions and `OccurrenceModal`) — DONE (commit 5d9fa36)
- `email_subscribers` table exists with `confirmed`, `unsubscribed_at`, `unsubscribe_token` columns — DONE
- Resend + React Email packages installed — DONE
- `rrule` package installed — DONE (in package.json)

## Steps

### Step 1: Add `notify_subscribers` field to Zod validators
**Files:**
- `src/lib/validators/event.ts` — modify

**What to do:**
Add `notify_subscribers: z.string().optional()` to all three instance schemas (`eventInstanceSchema`, `cancelInstanceSchema`, `restoreInstanceSchema`). Use `z.string().optional()` because HTML checkbox FormData sends `"on"` (string) when checked and is absent when unchecked. The server action will coerce to boolean.

Specifically:
- `eventInstanceSchema` (line 132): add `notify_subscribers: z.string().optional()` after the `note` field
- `cancelInstanceSchema` (line 144): add `notify_subscribers: z.string().optional()` after the `note` field
- `restoreInstanceSchema` (line 153): add `notify_subscribers: z.string().optional()` after the `original_date` field

**Pattern to follow:**
Existing optional string fields in the same schemas (e.g., `note: z.string().max(1000).optional().or(z.literal(''))`)

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- All three schemas accept `notify_subscribers` as an optional string field
- TypeScript compiles without errors

### Step 2: Create the React Email template
**Files:**
- `src/emails/event-change-notification.tsx` — create

**What to do:**
Create a single email template component `EventChangeNotification` that handles all three change types via a `changeType` prop. Props:

```typescript
interface EventChangeNotificationProps {
  changeType: 'cancelled' | 'modified' | 'restored'
  eventTitle: string
  eventDate: string          // formatted date string, e.g. "Sunday, April 19, 2026"
  eventTime: string          // formatted time, e.g. "9:15 AM"
  changes?: string[]         // for 'modified': list of changes, e.g. ["Start time: 9:15 AM → 10:00 AM"]
  reason?: string            // for 'cancelled': admin note
  nextOccurrence?: string    // for 'cancelled': e.g. "Wednesday, April 22 at 7:00 PM"
  note?: string              // admin note for modified/restored
  unsubscribeToken: string
  siteUrl?: string
}
```

Subject lines (computed in the server action, not in the template):
- Cancelled: `"⚠️ [Event Name] on [Date] has been cancelled"`
- Modified: `"📅 [Event Name] on [Date] — schedule change"`
- Restored: `"✅ [Event Name] on [Date] is back on"`

Template structure — follow `announcement-broadcast.tsx` exactly:
1. Header: dark (#253341) with church name
2. Content section:
   - Heading: event title
   - Gold divider (#D4A017)
   - Change-type-specific body:
     - **Cancelled**: "has been cancelled" message, reason if provided, next occurrence if available
     - **Modified**: "has been updated" message, list of changes (old → new)
     - **Restored**: "is back on" message with date/time confirmation
   - Note from admin (if provided)
3. Footer: church name/address, unsubscribe link

Reuse the exact same style objects from `announcement-broadcast.tsx` (body, container, header, headerText, content, heading, goldDivider, footerSection, footerText, unsubscribeLink). Add additional styles only for change-specific elements (change list items, reason box).

**Pattern to follow:**
`src/emails/announcement-broadcast.tsx` — same structure, same styles, same imports from `@react-email/components`

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Template renders all three change types
- TypeScript compiles without errors
- Uses church brand styles consistent with other email templates

### Step 3: Create the notification helper function
**Files:**
- `src/actions/event-instances.ts` — modify

**What to do:**
Add a private helper function `sendOccurrenceNotification()` in the server action file. This function:

1. Queries `email_subscribers` for confirmed, non-unsubscribed subscribers:
   ```typescript
   const { data: subscribers } = await supabase
     .from('email_subscribers')
     .select('email, unsubscribe_token')
     .eq('confirmed', true)
     .is('unsubscribed_at', null)
   ```

2. Queries the parent `events` table joined with `recurrence_rules` for event details:
   ```typescript
   const { data: event } = await supabase
     .from('events')
     .select('title, start_at, end_at, location, recurrence_rules(rrule_string, dtstart)')
     .eq('id', eventId)
     .single()
   ```

3. For cancellations, computes next occurrence using `rrule` package:
   ```typescript
   import { rrulestr } from 'rrule'
   // Parse the RRULE with dtstart, call .after(cancelledDate) to get next occurrence
   ```

4. Formats dates using `formatInChurchTimeZone()` from `@/lib/event-time`

5. Builds subject line based on change type

6. Loops through subscribers and calls `sendEmail()` for each:
   ```typescript
   for (const sub of subscribers) {
     await sendEmail({
       from: "St. Basil's Church <noreply@stbasilsboston.org>",
       to: sub.email,
       subject,
       react: EventChangeNotification({ ...props, unsubscribeToken: sub.unsubscribe_token }),
       metadata: { template: 'event-change-notification', eventId, changeType },
     })
   }
   ```

7. Errors in email sending are logged but do NOT fail the server action — the DB mutation already succeeded. Log: `console.error('[sendOccurrenceNotification] Email failed:', error)`

Function signature:
```typescript
async function sendOccurrenceNotification(
  supabase: SupabaseClient,
  eventId: string,
  originalDate: string,
  changeType: 'cancelled' | 'modified' | 'restored',
  details: {
    reason?: string
    note?: string
    oldStartAt?: string
    newStartAt?: string | null
    oldEndAt?: string | null
    newEndAt?: string | null
    oldLocation?: string | null
    newLocation?: string | null
  }
): Promise<void>
```

**Pattern to follow:**
- Subscriber query: `supabase/functions/announcement-email/index.ts` lines 304-308
- Email sending: `src/actions/newsletter.ts` (uses `sendEmail()` from `@/lib/email`)
- Date formatting: `src/components/features/OccurrenceModal.tsx` uses `formatInChurchTimeZone()`

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Helper function compiles and is ready to be called from server actions
- Handles all three change types
- Computes next occurrence for cancellations via rrule
- Errors don't crash the server action

### Step 4: Wire notifications into server actions
**Files:**
- `src/actions/event-instances.ts` — modify

**What to do:**
Modify all three server actions to:
1. Parse `notify_subscribers` from formData
2. After successful DB mutation, call `sendOccurrenceNotification()` if notify is checked

**`upsertEventInstance`** (line 25):
- After line 35, add: `notify_subscribers: formData.get('notify_subscribers') ?? '',`
- After the successful upsert (after line 89, before `revalidateEventPaths()`), add:
  ```typescript
  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, originalDate, 'modified', {
      note: parsed.data.note || undefined,
      oldStartAt: event.startAt, // need to fetch parent event start_at for comparison
      newStartAt: startAtOverride,
      oldEndAt: event.endAt,
      newEndAt: endAtOverride,
      oldLocation: event.location,
      newLocation: parsed.data.location || null,
    })
  }
  ```
  NOTE: For the "modified" case, we need the parent event's original times for comparison. The helper function fetches this internally via the event_id, so we pass only what changed.

**`cancelEventInstance`** (line 100):
- After line 107, add: `notify_subscribers: formData.get('notify_subscribers') ?? '',`
- After the successful upsert (after line 137, before `revalidateEventPaths()`), add:
  ```typescript
  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, parsed.data.original_date, 'cancelled', {
      reason: parsed.data.note || undefined,
    })
  }
  ```

**`restoreEventInstance`** (line 147):
- After line 153, add: `notify_subscribers: formData.get('notify_subscribers') ?? '',`
- IMPORTANT: The notification must happen BEFORE the delete (line 170-174), because after deletion the helper needs the event context. Actually, the helper fetches from the `events` table (parent), not `event_instances`, so it works fine after the instance row is deleted. The parent event and recurrence rules are not affected.
- After the successful delete (after line 178, before `revalidateEventPaths()`), add:
  ```typescript
  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, parsed.data.original_date, 'restored', {})
  }
  ```

**Pattern to follow:**
Existing structure in `src/actions/event-instances.ts` — parse formData, validate, mutate DB, then do post-mutation work before returning.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- All three server actions parse notify_subscribers
- Notification is sent only when checkbox is checked
- Notification errors don't prevent the success response

### Step 5: Add notify checkbox to OccurrenceModal UI
**Files:**
- `src/components/features/OccurrenceModal.tsx` — modify

**What to do:**
Add a "Send notification to subscribers" checkbox to three places:

**EditView** (line 152):
- After the Note textarea (after line 253), before the button row (line 255), add:
  ```tsx
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id="edit-notify"
      name="notify_subscribers"
      className="h-4 w-4 rounded border-wood-800/20 text-burgundy-700 focus:ring-burgundy-700/20"
    />
    <label htmlFor="edit-notify" className="font-body text-sm text-wood-800/80">
      Send notification to subscribers
    </label>
  </div>
  ```
  Default: unchecked (per issue recommendation — minor edits may not warrant notification)

**CancelView** (line 268):
- After the Reason textarea (after line 313), before the button row (line 316), add the same checkbox but with `id="cancel-notify"` and `defaultChecked` (per issue recommendation — cancellations should notify by default):
  ```tsx
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id="cancel-notify"
      name="notify_subscribers"
      defaultChecked
      className="h-4 w-4 rounded border-wood-800/20 text-burgundy-700 focus:ring-burgundy-700/20"
    />
    <label htmlFor="cancel-notify" className="font-body text-sm text-wood-800/80">
      Send notification to subscribers
    </label>
  </div>
  ```

**ModifiedView** (line 333) — for the "Revert to regular schedule" form (line 407):
- Before the submit button inside the restore form, add the checkbox with `id="restore-notify"` and `name="notify_subscribers"`, unchecked by default.

**CancelledView** (line 431) — for the "Restore this occurrence" form (line 483):
- Before the submit button inside the restore form, add the checkbox with `id="restore-notify-2"` and `name="notify_subscribers"`, unchecked by default.

**Pattern to follow:**
Existing form inputs in the same file — use `inputBase` styles for consistency, `font-body text-sm` for labels.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Checkbox appears in all relevant forms
- Default checked for cancel, unchecked for edit/restore
- Checkbox value is submitted as form data

### Step 6: Final lint and type check
**Files:**
- All modified files

**What to do:**
Run full lint and typecheck. Fix any issues introduced by these changes.

```bash
npm run lint
npx tsc --noEmit
```

**Verify:**
```bash
npm run lint && npx tsc --noEmit
```

**Done when:**
- Zero lint errors from changed files
- Zero TypeScript errors

## Acceptance Criteria (Full)
- [ ] Cancelling an occurrence with "notify" checked sends email to confirmed subscribers
- [ ] Modifying an occurrence with "notify" checked sends email with change details (old → new)
- [ ] Restoring an occurrence with "notify" checked sends "back on" email
- [ ] Email includes the event name, date, what changed, and next occurrence (for cancellations)
- [ ] Admin can opt out of sending notification (uncheck the box)
- [ ] Cancel checkbox defaults to checked; edit/restore checkbox defaults to unchecked
- [ ] Uses existing `sendEmail()` utility and React Email template
- [ ] Email sending errors are logged but don't fail the server action
- [ ] Emails include unsubscribe link
- [ ] Works with mock email transport for testing

## RLS Policy Plan
No new RLS policies needed. The server actions run as authenticated admin users, and existing RLS policies allow:
| Table | Policy | Rule |
|-------|--------|------|
| `email_subscribers` | Admin SELECT | `role = 'admin'` via `is_admin()` function — already exists |
| `events` | Public SELECT | Everyone can read events — already exists |
| `recurrence_rules` | Public SELECT | Everyone can read recurrence rules — already exists |
| `event_instances` | Admin CRUD | Already enforced by #181 — no change |

## Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| Email volume on Resend free tier | Parish scale (~50-200 subscribers) is well within 100/day limit. If subscriber count grows, can migrate to batch API later. |
| Server action timeout from sequential sends | At ~200ms per email and ~200 subscribers, total ~40s. Within Vercel function timeout (300s). |
| Restore action deletes instance row | Helper fetches from parent `events` table, not `event_instances`. Delete doesn't affect data needed for notification. |
| Next occurrence computation | Use `rrule` package's `.after()` method. Gracefully handle missing recurrence rules (non-recurring events won't have them). |
| Email failures | Caught and logged. Never block the primary DB operation. Admin sees "Occurrence updated" regardless of email result. |

## Out of Scope
- Batch API sending (not needed at parish scale)
- Email delivery tracking / read receipts
- Notification preferences per subscriber (issue recommends admin-level control only)
- Push notifications / SMS
- E2E test for email notification (test infrastructure exists but writing tests is out of scope for this issue)

## Estimated Complexity
medium — 1 new template file, modifications to 3 existing files (validators, server actions, modal), all following well-established patterns in the codebase.
