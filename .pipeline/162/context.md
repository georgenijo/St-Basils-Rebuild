# Context Brief — Issue #162: Admin: record payments received

## Issue Summary

When a member pays in person (cash, check, Zelle), the admin needs a UI to record it. This creates a `payments` row and updates related records (membership expiry, share paid status, event charge paid status). The server actions and Zod validators already exist (#154). This issue is about building the admin UI page.

## Type

feature

## Acceptance Criteria

- Admin can record payment for any family and type (membership, share, event, donation)
- Related records are updated (membership expiry, share paid, event charge paid)
- Payment appears in the member's history
- Only admins can access this

## Codebase Analysis

### Files Directly Involved

| File                                                    | Why                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/actions/admin-payments.ts`                         | EXISTING — `recordPaymentReceived()` server action (handles DB insert + side effects)  |
| `src/lib/validators/member.ts`                          | EXISTING — `recordPaymentSchema` Zod validator with superRefine conditional validation |
| `src/components/layout/AdminSidebar.tsx`                | MODIFY — add "Payments" nav item                                                       |
| `src/app/(admin)/admin/payments/page.tsx`               | NEW — server component that fetches payments + families data                           |
| `src/app/(admin)/admin/payments/PaymentsPageClient.tsx` | NEW — client component managing table + record payment form state                      |
| `src/components/features/PaymentsTable.tsx`             | NEW — payments table with sorting and filtering                                        |
| `src/components/features/RecordPaymentPanel.tsx`        | NEW — slide-out panel with the payment recording form                                  |

### Database Impact

- Tables read: `payments` (list all), `families` (for family selector), `events` (for event selector), `shares` (for share selector), `event_charges` (for event charge context), `profiles` (for recorded_by display name)
- Tables written: `payments` (insert), `event_charges` (update paid), `shares` (update paid), `families` (update membership_expires_at) — all via existing `recordPaymentReceived()` action
- New tables needed: none
- Migration dependencies: none — all tables exist from #148
- RLS considerations: Server page reads use admin Supabase client. Server action already checks admin role.

### Existing Patterns to Follow

| Pattern                      | Example File                                                     | Notes                                                                       |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Server page + client wrapper | `src/app/(admin)/admin/users/page.tsx` + `UsersPageClient.tsx`   | Server fetches data, passes to client component for interactivity           |
| Slide-out panel              | `src/components/features/UserDetailPanel.tsx`                    | Fixed right-side, 520px, backdrop, escape key, body scroll lock             |
| Table with sort/filter       | `src/components/features/UsersTable.tsx`                         | Column sort, filter dropdown, pagination                                    |
| Summary cards                | `src/app/(admin)/admin/users/page.tsx` (SummaryCard)             | Rounded-2xl border, dot accent, heading text-3xl                            |
| Form with useActionState     | `src/components/features/UserDetailPanel.tsx` (ChangeRoleDialog) | useActionState + hidden fields + validation errors                          |
| Server action pattern        | `src/actions/admin-payments.ts`                                  | Zod validate → requireAdmin → DB mutation → revalidatePath → ActionState    |
| Input styling                | Throughout admin forms                                           | `inputBase` class pattern with rounded-lg, cream-50 bg, burgundy focus ring |
| Button component             | `src/components/ui/Button.tsx`                                   | primary/secondary/ghost variants, sm/md/lg sizes                            |

### Test Coverage

- Existing tests: `e2e/pipeline/154.spec.ts` covers server action logic for `recordPaymentReceived` and `assignEventCosts`
- Test gaps: No UI/integration tests for the payments page. Out of scope for this issue.

### Related Issues

| Issue | Relationship                                                                   |
| ----- | ------------------------------------------------------------------------------ |
| #148  | Prerequisite — payments table schema (MERGED)                                  |
| #154  | Prerequisite — server actions for recording payments (MERGED)                  |
| #157  | Parallel — member portal membership tab shows payment history from member side |

## Risks

- **Family selector UX**: Need to load all families for a dropdown. Parish scale (~50-200 families) is fine for a simple select. No need for autocomplete/search.
- **Conditional fields**: Payment type determines which related fields appear (event selector for event payments, share selector for share payments). Need clear UI state management.
- **Data joins**: The payments table references `families`, `events`, `shares`, and `profiles` (recorded_by). The server page query needs joins to display human-readable names.

## Key Conventions

- Server components by default — `'use client'` only for interactivity
- Admin layout already handles auth + role check — no need for page-level auth
- `revalidatePath('/admin')` in server action already handles cache invalidation
- Currency: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- Dates: `toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })`
