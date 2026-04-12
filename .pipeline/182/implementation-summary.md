# Implementation Summary — Issue #182: Notify subscribers when a recurring event is cancelled or modified

## Changes Made

### Step 1: Add notify_subscribers to Zod validators
- `src/lib/validators/event.ts` — added `notify_subscribers: z.string().optional()` to `eventInstanceSchema`, `cancelInstanceSchema`, and `restoreInstanceSchema`
- Verification: PASSED (tsc --noEmit clean)

### Step 2: Create React Email template
- `src/emails/event-change-notification.tsx` — created new template with `EventChangeNotification` component handling cancelled/modified/restored change types. Uses church brand styles matching `announcement-broadcast.tsx`.
- Verification: PASSED (tsc --noEmit clean)

### Steps 3-4: Notification helper + server action wiring
- `src/actions/event-instances.ts` — added `sendOccurrenceNotification()` helper and wired into all three server actions
  - Helper fetches parent event + recurrence rules + confirmed subscribers in parallel
  - Computes next occurrence for cancellations via `rrulestr` from `rrule` package
  - Builds change diff for modifications (old vs new start time, end time, location)
  - Sends individual emails via `sendEmail()` with per-subscriber error handling
  - Email errors logged but never fail the primary DB mutation
  - Added `notify_subscribers` parsing to `upsertEventInstance`, `cancelEventInstance`, `restoreEventInstance`
- Verification: PASSED (tsc --noEmit clean)

### Step 5: Add notify checkbox to OccurrenceModal
- `src/components/features/OccurrenceModal.tsx` — added "Send notification to subscribers" checkbox to:
  - EditView form (unchecked by default)
  - CancelView form (checked by default)
  - ModifiedView restore form (unchecked by default)
  - CancelledView restore form (unchecked by default)
- Verification: PASSED (tsc --noEmit clean)

### Step 6: Final lint and type check
- Lint: 0 errors, 3 pre-existing warnings (none in files I changed)
- TypeScript: 0 errors

## Commits
| Hash | Message |
|------|---------|
| a5ef4e1 | feat: add notify_subscribers field to event instance Zod validators |
| 132811f | feat: add React Email template for event change notifications |
| b56b1a9 | feat: add occurrence notification helper and wire into server actions |
| 6077700 | feat: add notify subscribers checkbox to OccurrenceModal forms |

## Verification Results
- Lint: PASS (0 errors)
- TypeScript: PASS (0 errors)
- Unit tests: N/A (no unit tests for this feature)
- Step verifications: All passed

## Files Changed
```
 src/actions/event-instances.ts              | 177 ++++++++++++++++-
 src/components/features/OccurrenceModal.tsx |  51 ++++-
 src/emails/event-change-notification.tsx    | 301 ++++++++++++++++++++++++++++
 src/lib/validators/event.ts                 |   3 +
 4 files changed, 529 insertions(+), 3 deletions(-)
```

## Notes for Reviewer
- The `rrulestr` import from `rrule` package is used server-side in the action file. The package was already a dependency but only used client-side via `@fullcalendar/rrule` before.
- Email sending is sequential (not batched). At parish scale (~50-200 subscribers) this is acceptable. For larger scale, could migrate to Resend batch API.
- The `sendOccurrenceNotification()` function's `supabase` parameter type uses `Awaited<ReturnType<typeof createClient>>` to correctly type the server-side Supabase client.
- No plan deviations.
