# Implementation Plan — Issue #180: Zero-fee payment flow: Zelle, Venmo, and Cash App integration

## Approach Summary

Build a bookkeeping layer on top of free P2P payment rails (Zelle, Venmo, Cash App). The portal generates reference memos, shows per-method payment instructions with deep links, and creates pending payment records that the treasurer confirms or rejects. Implementation follows bottom-up order: schema migration → validators → server actions → UI components → admin queue.

Payment method handles (Zelle email, Venmo handle, Cash App tag) will be stored as environment variables (`CHURCH_ZELLE_EMAIL`, `CHURCH_VENMO_HANDLE`, `CHURCH_CASHAPP_TAG`) rather than hardcoded, making them configurable per deployment.

## Prerequisites
- Payments table exists (`20260409000003_create_payments.sql`) ✓
- Families table exists with `family_name` column ✓  
- Member portal layout exists with sidebar navigation ✓
- Admin payments page exists with PaymentsTable ✓

## Steps

### Step 1: Database migration — add status, reference_memo, confirmed_by, confirmed_at columns and expand method enum

**Files:**
- `supabase/migrations/20260412000001_add_payment_status_and_methods.sql` — create

**What to do:**
Create a migration that:
1. Adds `status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected'))` to `payments`
2. Adds `reference_memo TEXT` to `payments`
3. Adds `confirmed_by UUID REFERENCES public.profiles(id)` to `payments`
4. Adds `confirmed_at TIMESTAMPTZ` to `payments`
5. Adds `rejected_reason TEXT` to `payments` (for treasurer's rejection note)
6. Drops the existing method CHECK constraint and recreates with `('cash', 'check', 'zelle', 'venmo', 'cashapp', 'online')`
7. Adds index `idx_payments_status` on `payments(status)` for the pending queue query
8. Updates the INSERT RLS policy to allow members to insert any payment type when `status = 'pending'`:
   ```sql
   DROP POLICY "Insert payments" ON public.payments;
   CREATE POLICY "Insert payments"
     ON public.payments FOR INSERT
     TO authenticated
     WITH CHECK (
       public.is_admin()
       OR (
         family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
         AND recorded_by = (SELECT auth.uid())
         AND status = 'pending'
         AND confirmed_by IS NULL
         AND confirmed_at IS NULL
       )
     );
   ```

Follow pattern from `20260409000003_create_payments.sql` — header comment with issue number, clear section comments.

**Verify:**
```bash
grep -c 'status' supabase/migrations/20260412000001_add_payment_status_and_methods.sql
```

**Done when:**
- Migration file exists with all 7 changes
- RLS policy allows member INSERT with `status = 'pending'` constraint

### Step 2: Reference memo generator utility

**Files:**
- `src/lib/reference-memo.ts` — create
- `src/lib/reference-memo.test.ts` — create

**What to do:**
Create a pure utility function `generateReferenceMemo` that produces deterministic reference codes:

```typescript
type MemoInput =
  | { type: 'membership'; familyName: string; date: Date }
  | { type: 'share'; familyName: string; personNames: string[]; year: number }
  | { type: 'event'; familyName: string; eventSlug: string }
  | { type: 'donation'; familyName: string; donationType: string; date: Date }

export function generateReferenceMemo(input: MemoInput): string
```

Format rules from the issue:
| Type | Format | Example |
|------|--------|---------|
| Membership | `DUES-{MON}{YY}-{FAMILY}` | `DUES-APR26-NIJO` |
| Share | `SHARE-{YEAR}-{NAMES}-{FAMILY}` | `SHARE-2026-MARY-JOSEPH-MATHEW` |
| Event | `EVENT-{SLUG}-{FAMILY}` | `EVENT-FAMNIGHT-JOHN` |
| Donation | `DONATE-{TYPE}-{MON}{YY}-{FAMILY}` | `DONATE-GEN-APR26-VARGHESE` |

Helper rules:
- Family name: take last word, uppercase, max 10 chars
- Person names: first name only, uppercase, joined with `-`, max 3 names then truncate
- Month: 3-letter uppercase (JAN, FEB, etc.)
- Year: 2-digit
- Slug: uppercase, truncate to 12 chars, replace spaces/special chars with nothing

Unit tests: test each type, edge cases (long names, special chars, empty arrays).

**Pattern to follow:** `src/lib/event-time.ts` + `src/lib/event-time.test.ts` — pure function with comprehensive Vitest tests.

**Verify:**
```bash
npx vitest run src/lib/reference-memo.test.ts
```

**Done when:**
- `generateReferenceMemo` produces correct memos for all 4 types
- All unit tests pass

### Step 3: Zod validators for payment submission and confirm/reject

**Files:**
- `src/lib/validators/member.ts` — modify (add `submitPaymentSchema`)
- `src/lib/validators/member.test.ts` — modify (add tests)

**What to do:**
Add `submitPaymentSchema` to `src/lib/validators/member.ts`:

```typescript
export const submitPaymentSchema = z.object({
  type: z.enum(['membership', 'share', 'event', 'donation']),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(9999999.99, 'Amount exceeds maximum')
    .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
  method: z.enum(['zelle', 'venmo', 'cashapp']),
  reference_memo: z.string().min(1, 'Reference memo is required').max(100),
  related_event_id: z.string().uuid().optional().or(z.literal('')),
  related_share_id: z.string().uuid().optional().or(z.literal('')),
})
```

Also update `recordPaymentSchema` to include `'venmo'` and `'cashapp'` in the `method` enum (line 94), and update `markSharesPaidSchema` similarly (line 138).

Add a new admin-side validator in a new section at the bottom:

```typescript
export const confirmPaymentSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID'),
})

export const rejectPaymentSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less'),
})
```

Add corresponding type exports.

Add unit tests for `submitPaymentSchema`, `confirmPaymentSchema`, and `rejectPaymentSchema`.

**Pattern to follow:** Existing validators in the same file.

**Verify:**
```bash
npx vitest run src/lib/validators/member.test.ts
```

**Done when:**
- `submitPaymentSchema` validates member payment submissions
- `confirmPaymentSchema` and `rejectPaymentSchema` validate admin actions
- Method enums updated to include venmo/cashapp
- All validator tests pass

### Step 4: Member payment submission server action

**Files:**
- `src/actions/payments.ts` — create

**What to do:**
Create a new server action `submitPayment` that:
1. Validates with `submitPaymentSchema`
2. Auth check — get user
3. Profile/family lookup — get `family_id`
4. Insert into `payments` with `status = 'pending'`, `recorded_by = user.id`
5. `revalidatePath('/member')`
6. Return success

Follow the exact pattern of `src/actions/donations.ts`:
- `'use server'` directive
- `ActionState` type
- Zod validation → auth check → profile lookup → DB insert → revalidate

Do NOT include side effects (membership extension, share marking, etc.) — those happen on confirm, not submit.

**Pattern to follow:** `src/actions/donations.ts`

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- `submitPayment` action compiles cleanly
- Inserts pending payment row for authenticated member

### Step 5: Admin confirm and reject server actions

**Files:**
- `src/actions/admin-payments.ts` — modify (add `confirmPayment`, `rejectPayment`)

**What to do:**

Add `confirmPayment` action:
1. Validate with `confirmPaymentSchema`
2. `requireAdmin()` check
3. Fetch the payment by ID, verify `status = 'pending'`
4. Update payment: `status = 'confirmed'`, `confirmed_by = user.id`, `confirmed_at = now()`
5. Fire side effects based on payment type — extract the existing side-effect logic from `recordPaymentReceived` (lines 139-207) into a shared helper `applyPaymentSideEffects(supabase, payment)` at the top of the file, then call it from both `recordPaymentReceived` and `confirmPayment`
6. `revalidatePath('/admin')`

Add `rejectPayment` action:
1. Validate with `rejectPaymentSchema`
2. `requireAdmin()` check
3. Fetch the payment by ID, verify `status = 'pending'`
4. Update payment: `status = 'rejected'`, `rejected_reason = reason`
5. Look up the member's email (via payment.family_id → profiles → email for head of household or recorded_by user)
6. Send rejection email using `sendEmail()` with a new `PaymentRejected` React Email template
7. `revalidatePath('/admin')`

Import new validators from `src/lib/validators/member.ts`.

**Pattern to follow:** Existing `recordPaymentReceived` in same file for side effects; `requireAdmin` helper already exists.

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- `confirmPayment` confirms pending payment and fires side effects
- `rejectPayment` rejects with reason and sends email
- Side-effect logic shared between `recordPaymentReceived` and `confirmPayment`

### Step 6: Payment rejection email template

**Files:**
- `src/emails/payment-rejected.tsx` — create

**What to do:**
Create a React Email template `PaymentRejected` with props:
- `familyName: string`
- `amount: number`
- `type: string`
- `method: string`
- `referenceMemo: string`
- `reason: string`

Content: "Your payment of $XX.XX (reference: MEMO) was not confirmed. Reason: ..."

Follow the exact pattern and styles of `src/emails/contact-notification.tsx` — same inline style objects, same church footer.

**Pattern to follow:** `src/emails/contact-notification.tsx`

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- Email template compiles and follows existing style patterns

### Step 7: Member payment flow UI — MakePaymentPanel component

**Files:**
- `src/components/member/MakePaymentPanel.tsx` — create

**What to do:**
Create a slide-over panel component that:

1. **Props**: `paymentType`, `amount`, `familyName`, `referenceMemo`, `relatedEventId?`, `relatedShareId?`, `open`, `onClose`
2. **State**: selected method (zelle/venmo/cashapp), submission pending
3. **Layout** (3 sections in the panel body):
   a. **Method tabs**: Zelle | Venmo | Cash App — radio button styled as tab pills
   b. **Per-method instructions**:
      - **Zelle**: Show church email (from env via prop `zelleEmail`), Copy button, QR code placeholder image, step-by-step text
      - **Venmo**: Deep link button `https://venmo.com/u/{handle}?txn=pay&amount={amount}&note={memo}`, step-by-step text
      - **Cash App**: Deep link button `https://cash.app/$tag/{amount}`, step-by-step text (note must be added manually)
   c. **Reference memo**: Displayed in a monospace box with Copy button
4. **"I've sent the payment" button**: Calls `submitPayment` server action via `useActionState`
5. **Success state**: Modal/message "Pending Confirmation — usually 1-2 business days"

Follow `RecordDonationPanel.tsx` pattern: backdrop, escape key, body scroll lock, `useActionState`.

Payment config props (`zelleEmail`, `venmoHandle`, `cashappTag`) will be passed down from the page server component which reads them from `process.env`.

**Pattern to follow:** `src/components/member/RecordDonationPanel.tsx`

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- Panel renders with method tabs, instructions per method, reference memo, and submit button
- Submission calls `submitPayment` action
- Success state shows pending confirmation message

### Step 8: Update member payments page to integrate MakePaymentPanel

**Files:**
- `src/app/(member)/member/payments/page.tsx` — modify

**What to do:**
1. Add a "Make a Payment" button next to the existing "Record Donation" button
2. Pass payment config from env vars: `process.env.CHURCH_ZELLE_EMAIL`, `process.env.CHURCH_VENMO_HANDLE`, `process.env.CHURCH_CASHAPP_TAG`
3. Create a new client wrapper component `MemberPaymentsClient` to manage panel state for the MakePaymentPanel
4. The panel needs to know: payment type, amount, family name, and reference memo. For dues/events/shares, the member clicks a "Pay" button on a specific row to open the panel pre-filled with that payment's details
5. Add `status` to the payment query and display pending/confirmed/rejected status badges
6. Add `reference_memo` to the query and show it in the table

Keep the existing `RecordDonationPanel` as-is — donations still go through the existing flow but can optionally use the new payment methods.

**Pattern to follow:** Current page structure, `PaymentsPageClient.tsx` pattern for admin page.

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- Member can click "Pay" on unpaid event charges to open the MakePaymentPanel
- Panel shows with correct pre-filled data
- Status badges show in the payment history table

### Step 9: Admin pending payments queue

**Files:**
- `src/app/(admin)/admin/payments/page.tsx` — modify
- `src/app/(admin)/admin/payments/PaymentsPageClient.tsx` — modify
- `src/components/features/PaymentsTable.tsx` — modify

**What to do:**

**PaymentsTable.tsx** changes:
1. Add `status` and `reference_memo` to the `Payment` interface
2. Add a Status column with badges: pending (yellow), confirmed (green), rejected (red)
3. Add Confirm/Reject buttons on pending rows (only visible to admins)
4. Add `onConfirm` and `onReject` callback props (optional, only passed from admin page)
5. Add a filter option for status (pending/confirmed/rejected/all)

**PaymentsPageClient.tsx** changes:
1. Add state for confirm/reject dialogs
2. Wire up `confirmPayment` and `rejectPayment` server actions
3. Add a reject reason textarea in a confirmation dialog

**Admin page.tsx** changes:
1. Add `status`, `reference_memo` to the payments query select
2. Pass the new fields through to `PaymentsPageClient`
3. Add a "Pending" count badge in the summary cards

**Pattern to follow:** Existing `PaymentsTable` structure for columns/filters.

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- Admin sees status column on all payments
- Pending payments show Confirm/Reject action buttons
- Confirm updates status to confirmed and fires side effects
- Reject opens dialog for reason, updates status, sends email

### Step 10: Update method enums in admin RecordPaymentPanel

**Files:**
- `src/components/features/RecordPaymentPanel.tsx` — modify

**What to do:**
Update the `METHODS` constant (line 37-42) to include:
```typescript
const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'online', label: 'Online' },
]
```

Also update `METHOD_LABELS` in `PaymentsTable.tsx` to include venmo and cashapp.

**Pattern to follow:** Existing constant structure.

**Verify:**
```bash
npx tsc --noEmit
```

**Done when:**
- Admin can select Venmo and Cash App when manually recording payments
- Method labels display correctly in the payments table

## Acceptance Criteria (Full)
- [ ] Member can select Zelle, Venmo, or Cash App as payment method
- [ ] Zelle: shows church email with Copy button + QR code placeholder
- [ ] Venmo: deep link opens app with amount and memo pre-filled
- [ ] Cash App: deep link opens app with amount pre-filled
- [ ] Reference memo is auto-generated and copyable
- [ ] "I've sent the payment" creates a pending payment record
- [ ] Admin sees pending payment queue with Confirm/Reject actions
- [ ] Confirm updates payment status and fires downstream side effects
- [ ] Reject sends notification email to the member
- [ ] Zero transaction fees on all paths
- [ ] Existing admin payment recording still works
- [ ] Existing donation recording still works

## RLS Policy Plan
| Table | Policy | Rule |
|-------|--------|------|
| `payments` | Insert payments (updated) | Admin can insert any payment; members can insert for own family with `status = 'pending'`, `recorded_by = auth.uid()`, `confirmed_by IS NULL`, `confirmed_at IS NULL` |
| `payments` | Update payments (unchanged) | Admins only |
| `payments` | Select payments (unchanged) | Members see own family, admins see all |
| `payments` | Delete payments (unchanged) | Admins only |

## Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| RLS expansion allows member to insert confirmed payments | WITH CHECK constrains member INSERT to `status = 'pending'` only |
| Member sets confirmed_by or confirmed_at on insert | WITH CHECK constrains these to NULL on member INSERT |
| Side-effect duplication between recordPayment and confirmPayment | Extract shared `applyPaymentSideEffects` helper |
| Deep link URLs change | Payment handles stored in env vars, not hardcoded |
| Migration breaks existing data | DEFAULT 'confirmed' ensures existing rows get correct status |

## Out of Scope
- QR code generation for Zelle (placeholder image for now — can be added later)
- Push notifications (email only for rejection)
- Payment reminders/auto-follow-up on pending payments
- Every.org integration (#186 — separate issue)
- Transactional email for payment confirmation (#184 — separate issue)

## Estimated Complexity
high — 10 steps spanning migration, 3 server actions, 2 UI components, email template, and validator changes across 12+ files
