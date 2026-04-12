# Context Brief — Issue #159: Member portal: Payments tab

## Issue Summary

Create the Payments tab for the member portal that displays all non-membership payments (event charges, donations, share purchases) with summary cards and a "Record Donation" slide-out panel. The membership tab already handles membership-specific payments separately.

## Type

feature

## Acceptance Criteria

- Table excludes membership payments (type != 'membership')
- Summary cards show: Paid This Year (non-membership total), Outstanding (unpaid event charges), Donations (total donated)
- Record Donation slide-out panel works with donation type select, amount, optional note
- Record Donation calls the existing `recordDonation` server action
- New donations appear in the table after submission (revalidation)

## Codebase Analysis

### Files Directly Involved

| File                                            | Why                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `src/app/(member)/member/payments/page.tsx`     | **CREATE** — the main payments page (server component)           |
| `src/components/member/RecordDonationPanel.tsx` | **CREATE** — client component for slide-out donation form        |
| `src/actions/donations.ts`                      | **EXISTS** — `recordDonation` server action already implemented  |
| `src/lib/validators/member.ts`                  | **EXISTS** — `recordDonationSchema` already defined              |
| `src/components/layout/MemberSidebar.tsx`       | **EXISTS** — already has Payments nav item at `/member/payments` |
| `src/app/(member)/layout.tsx`                   | **EXISTS** — member layout with auth guard, no changes needed    |
| `src/components/ui/Card.tsx`                    | **EXISTS** — Card component with `outlined` variant              |
| `src/components/ui/Button.tsx`                  | **EXISTS** — Button component with `primary` variant             |

### Database Impact

- Tables affected: `payments` (read), `event_charges` (read), `events` (read for titles)
- New tables needed: none
- Migration dependencies: `20260409000003_create_payments.sql` (#148), `20260409000004_create_event_charges.sql` (#149) — both exist
- RLS considerations: Existing RLS on `payments` allows members to SELECT their own family's payments. Existing RLS on `event_charges` allows members to SELECT their own family's charges. No new policies needed.

### Database Schema Details

**payments table:**

- `id` UUID PK
- `family_id` UUID FK → families
- `type` TEXT CHECK ('membership', 'share', 'event', 'donation')
- `amount` NUMERIC(10,2)
- `method` TEXT CHECK ('cash', 'check', 'zelle', 'online') — nullable
- `note` TEXT — nullable
- `recorded_by` UUID FK → profiles — nullable
- `related_event_id` UUID FK → events — nullable
- `related_share_id` UUID FK → shares — nullable (composite FK with family_id)
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**event_charges table:**

- `id` UUID PK
- `event_id` UUID FK → events (CASCADE)
- `family_id` UUID FK → families (CASCADE)
- `amount` NUMERIC(10,2)
- `paid` BOOLEAN default false
- `created_at`, `updated_at` TIMESTAMPTZ

### Existing Patterns to Follow

| Pattern                                               | Example File                                  | Notes                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Member page with summary cards + data table           | `src/app/(member)/member/page.tsx`            | Server component, parallel data fetches with Promise.all, Card variant="outlined", badge styles, date formatting |
| Member page with detail cards + payment history table | `src/app/(member)/member/membership/page.tsx` | Table with thead/tbody, usd formatter, method display, status badges                                             |
| Server action with Zod + auth + insert                | `src/actions/donations.ts`                    | `recordDonation` — uses formData, Zod validation, profile lookup, revalidatePath                                 |
| Slide-out panel pattern                               | `mockup-member-portal.html:641-731`           | Fixed right panel, overlay backdrop, form with cancel/submit buttons                                             |

### Test Coverage

- Existing tests that touch this area: `src/actions/shares.test.ts` (tests share-related actions), `src/lib/validators/member.test.ts` (tests validator schemas)
- Test gaps: No E2E tests for member portal pages yet. No unit tests for the payments page.

### Related Issues

| Issue | Relationship                                                         |
| ----- | -------------------------------------------------------------------- |
| #155  | Dependency — member layout (already merged, layout exists)           |
| #148  | Dependency — payments table (already merged, migration exists)       |
| #149  | Dependency — event_charges table (already merged, migration exists)  |
| #153  | Dependency — donations server action (already merged, action exists) |
| #157  | Sibling — membership tab (already merged, pattern reference)         |
| #160  | Sibling — shares tab (not yet built, will follow similar pattern)    |
| #158  | Sibling — family tab (not yet built)                                 |

## Risks

- The `payments` table `method` column is nullable — event charges assigned by admin may not have a method. UI must handle null method gracefully (show "—").
- Event charges in `event_charges` table represent unpaid amounts, but payments in `payments` table with `type='event'` represent paid amounts. "Outstanding" should sum unpaid event_charges, not derive from payments.
- The slide-out panel is a client component that needs `useActionState` for form handling with the existing server action pattern.
- The `recordDonation` action calls `revalidatePath('/member')` — it should also revalidate `/member/payments`. However, since it revalidates the parent path, Next.js should revalidate child routes too.

## Key Conventions

- Server components by default, `'use client'` only for interactive parts (the donation panel)
- UTC in DB, America/New_York for display
- Tailwind CSS classes matching existing design system (wood-900, wood-800/60, cream-50, etc.)
- Card variant="outlined" for content containers
- Badge color convention: Event = amber, Donation = blue, Shares = purple (from mockup + overview page)
- `cn()` utility from `@/lib/utils` for className merging
