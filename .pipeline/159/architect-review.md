# Architect Review — Issue #159: Member portal: Payments tab

## VERDICT: APPROVED

## Review Summary

The plan correctly implements the Payments tab following established member portal patterns. It properly separates the server component (data fetching + rendering) from the client component (donation panel interaction). The approach of merging payments + unpaid event charges into a unified display list is sound. Two minor concerns noted below — neither blocks implementation.

## Detailed Review

### Correctness: PASS

- All acceptance criteria from the issue are addressed
- The `type != 'membership'` filter correctly scopes the tab
- Summary card computations are correct: Paid This Year from payments, Outstanding from event_charges, Donations from donation-type payments
- The unified display array combining paid payments + unpaid charges is the right approach for showing "Due" rows alongside "Paid" rows
- Step ordering is correct — component before page

### Architecture Alignment: PASS

- Server component by default, `'use client'` only for the donation panel — correct
- RLS enforces access at DB level — no middleware-only auth
- UTC in, America/New_York out for display — correctly specified
- Sanity for content, Supabase for data — payments are structured data, Supabase is correct
- One ticket per branch — scope is appropriate

### Database Design: PASS

- No new tables or migrations needed — reads from existing `payments`, `event_charges`, `events`
- Existing RLS policies are sufficient for member SELECT on own family's data
- No new indexes needed — existing indexes on `family_id` and `type` cover the query patterns

### Security: PASS

- The `recordDonation` server action already validates with Zod, checks auth, verifies family membership, and sets `recorded_by = user.id`
- The INSERT RLS policy restricts members to `type = 'donation'` with their own `family_id` and `recorded_by = auth.uid()` — preventing impersonation
- No new server actions, no new attack surface

### Implementation Quality: CONCERN

- Steps 1 and 3 are muddled — Step 3 revises the approach from Step 1 mid-plan. The implementer should treat the final revised approach as canonical: `RecordDonationPanel` is self-contained with its own trigger button and internal open state. Step 3 should be ignored as a separate step; it's folded into Step 1.
- The effective plan is 2 implementation steps + 1 verification step, which is clean.

### Risk Assessment: PASS

- All risks from context brief are addressed
- The `revalidatePath('/member')` coverage for child routes is correctly noted
- No LIMIT on per-family queries is acceptable given bounded family data volume

## Recommendations (non-blocking)

- When implementing, treat the plan as 2 steps: (1) RecordDonationPanel with self-contained button, (2) Payments page. Ignore Step 3 as it was folded into Step 1's revision.
- Consider adding a `limit(50)` on the payments query as a safety measure, even though per-family data is bounded. Not required.

## Approved Scope

Implementation of:

1. `src/components/member/RecordDonationPanel.tsx` — self-contained client component with trigger button, slide-out panel, donation form using `useActionState` + `recordDonation`
2. `src/app/(member)/member/payments/page.tsx` — server component with 3 summary cards, unified payment history table (payments + unpaid charges), imports RecordDonationPanel
