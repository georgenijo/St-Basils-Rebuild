# Context Brief — Issue #180: Zero-fee payment flow: Zelle, Venmo, and Cash App integration

## Issue Summary

Add a member-facing payment flow that lets members initiate payments via Zelle, Venmo, or Cash App from the portal. The portal acts as a bookkeeping layer — no payment processing, no fees. Members select a method, get instructions/deep links, copy an auto-generated reference memo, then click "I've sent the payment" to create a pending record. The admin treasurer sees a pending queue and confirms/rejects payments.

## Type
feature

## Acceptance Criteria
- [ ] Member can select Zelle, Venmo, or Cash App as payment method
- [ ] Zelle: shows church email with Copy button + QR code
- [ ] Venmo: deep link opens app with amount and memo pre-filled
- [ ] Cash App: deep link opens app with amount pre-filled
- [ ] Reference memo is auto-generated and copyable
- [ ] "I've sent the payment" creates a pending payment record
- [ ] Admin sees pending payment queue with Confirm/Reject actions
- [ ] Confirm updates payment status and fires downstream side effects
- [ ] Reject sends notification email to the member
- [ ] Zero transaction fees on all paths

## Codebase Analysis

### Files Directly Involved
| File | Why |
|------|-----|
| `supabase/migrations/20260409000003_create_payments.sql` | Base payments table — needs `status`, `reference_memo`, `confirmed_by`, `confirmed_at` columns |
| `src/lib/validators/member.ts` | Zod schemas — needs `submitPaymentSchema` for member-submitted payments |
| `src/actions/donations.ts` | Pattern for member-initiated payment action (auth, family lookup, insert) |
| `src/actions/admin-payments.ts` | Admin payment actions — needs `confirmPayment` and `rejectPayment` actions |
| `src/app/(member)/member/payments/page.tsx` | Member payments page — needs payment method selector + instruction panels |
| `src/components/member/RecordDonationPanel.tsx` | Existing member slide-over panel pattern to follow |
| `src/app/(admin)/admin/payments/page.tsx` | Admin payments page — needs pending queue view |
| `src/app/(admin)/admin/payments/PaymentsPageClient.tsx` | Admin payments client — needs pending tab/queue |
| `src/components/features/PaymentsTable.tsx` | Admin payments table — needs status column and confirm/reject actions |
| `src/components/features/RecordPaymentPanel.tsx` | Admin record payment panel — method enum needs updating |
| `src/emails/contact-notification.tsx` | Email template pattern for rejection notification |
| `src/lib/email.ts` | Email sending utility |

### Database Impact
- Tables affected: `payments` (ALTER TABLE to add columns)
- New tables needed: none
- Migration dependencies: `20260409000003_create_payments.sql` must exist (it does)
- RLS considerations:
  - Current INSERT policy allows members to insert only `type = 'donation'`. Must expand to allow all types when `status = 'pending'`.
  - Current UPDATE is admin-only — stays admin-only (for confirm/reject).
  - Need to ensure members can only submit payments for their own family with `status = 'pending'`.

### Schema Changes Required
```sql
ALTER TABLE payments
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  ADD COLUMN reference_memo TEXT,
  ADD COLUMN confirmed_by UUID REFERENCES profiles(id),
  ADD COLUMN confirmed_at TIMESTAMPTZ;
```
- `status` defaults to `'confirmed'` so admin-recorded payments (existing behavior) are confirmed on creation.
- Member-submitted payments will be inserted with `status = 'pending'`.
- `method` CHECK constraint needs updating: currently `('cash', 'check', 'zelle', 'online')`, must add `'venmo'` and `'cashapp'`.

### Existing Patterns to Follow
| Pattern | Example File | Notes |
|---------|-------------|-------|
| Member slide-over panel | `src/components/member/RecordDonationPanel.tsx` | `useActionState`, backdrop, escape key, body scroll lock |
| Member server action | `src/actions/donations.ts` | Auth check → profile/family lookup → Zod validate → insert → revalidatePath |
| Admin server action | `src/actions/admin-payments.ts` | `requireAdmin()` helper, Zod validate, DB operation, side effects, revalidate |
| Email template | `src/emails/contact-notification.tsx` | React Email components, inline styles, church footer |
| Zod validator | `src/lib/validators/member.ts` | Schema + exported type inference |

### Test Coverage
- Existing tests: `src/lib/validators/member.test.ts` covers existing payment validators
- Test gaps: No unit tests for reference memo generation, no E2E for member payment submission
- Smoke tests exist in `e2e/smoke/` but don't cover payment flows

### Related Issues
| Issue | Relationship |
|-------|-------------|
| #148 | Payments table — base table this builds on |
| #154 | Admin payment server actions — extended with confirm/reject |
| #155 | Member portal layout — where payment UI lives |
| #159 | Member payments tab — payment initiation lives here |
| #184 | Transactional notification emails — related but separate scope |
| #186 | Every.org online payments — future complementary feature |

## Risks
- **RLS expansion**: Widening INSERT policy from donation-only to all types for members introduces risk. Must ensure members can only insert `status = 'pending'` rows and cannot set `confirmed_by` or `confirmed_at`.
- **Method enum mismatch**: Adding `'venmo'` and `'cashapp'` to DB CHECK constraint also requires updating Zod schemas and the admin `RecordPaymentPanel` method list.
- **Migration safety**: ALTER TABLE with NOT NULL + DEFAULT is safe on Postgres — existing rows get the default value. No downtime concern.
- **Deep link reliability**: Venmo/Cash App deep links may change. Store handles in site_settings or env vars rather than hardcoding.
- **Side effects on confirm**: Confirming a pending payment must trigger the same side effects as admin-recorded payments (extend membership, mark shares paid, mark event charges paid). This logic exists in `recordPaymentReceived` and must be extracted/reused.

## Key Conventions
- RLS is the authorization layer — DB must enforce access control, not just middleware
- UTC in, local out — timestamps stored as UTC
- Server components by default — `'use client'` only where needed
- One ticket per branch, one PR per ticket
- Zod validation on every server action
- `useActionState` for form submission pattern
- Slide-over panels for create/edit flows
