# Implementation Summary — Issue #154: Server actions: admin event charges and payment recording

## Changes Made

### Step 1: Extend recordPaymentSchema with relation fields
- `src/lib/validators/member.ts` — Added `related_event_id` and `related_share_id` optional UUID fields to `recordPaymentSchema`. Added `.superRefine()` to enforce conditional validation: event type requires event ID, share type requires share ID, membership/donation must not set either.
- Verification: PASSED — `npm test` runs all 31 validator tests passing, `tsc --noEmit` clean

### Steps 2-3: Create admin-payments.ts with both actions
- `src/actions/admin-payments.ts` — Created new file with `'use server'` directive containing:
  - `requireAdmin()` helper: shared auth check pattern (getUser → profiles.role → reject if not admin)
  - `assignEventCosts()`: parses charges JSON from FormData, Zod validates, admin check, bulk inserts `event_charges` rows, handles 23505 duplicate key error
  - `recordPaymentReceived()`: Zod validates (including superRefine), admin check, inserts `payments` row with `recorded_by = user.id`, then applies side effects per type (event → mark charge paid, share → mark share paid, membership → compute and update expiry)
- Verification: PASSED — `tsc --noEmit` clean

### Step 4: Lint and type-check
- Verification: PASSED — `npm run lint` shows 0 errors (3 pre-existing warnings in unrelated files), `tsc --noEmit` clean

## Commits
| Hash | Message |
|------|---------|
| b25093c | feat: extend recordPaymentSchema with relation fields and conditional validation |
| c2b9163 | feat: add assignEventCosts and recordPaymentReceived server actions |

## Verification Results
- Lint: PASS (0 new errors)
- TypeScript: PASS (0 new errors)
- Unit tests: PASS (31/31 validator tests)
- Step verifications: all passed

## Files Changed
```
 src/actions/admin-payments.ts | 215 ++++++++++++++++++++++++++++++++++++++++++
 src/lib/validators/member.ts  |  65 ++++++++++---
 2 files changed, 265 insertions(+), 15 deletions(-)
```

## Notes for Reviewer
- The `requireAdmin` helper is local to `admin-payments.ts` rather than extracted to a shared util, since only this file uses it currently. Can be extracted when other admin action files need it.
- Side-effect failures (e.g., marking charge as paid after payment insert) return partial success messages instead of failure, per architect recommendation — the payment is the source of truth.
- Membership expiry logic: extends from max(current expiry, today) by 1 month (monthly) or 1 year (annual/default).
