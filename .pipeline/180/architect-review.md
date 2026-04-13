# Architect Review — Issue #180: Zero-fee payment flow: Zelle, Venmo, and Cash App integration

## VERDICT: APPROVED

## Review Summary

The plan is well-structured with correct bottom-up ordering (migration → validators → actions → UI). RLS expansion is correctly constrained to `status = 'pending'` for member INSERT. Side-effect extraction is the right call. A few concerns noted below but none blocking.

## Detailed Review

### Correctness: PASS
- All 10 acceptance criteria from the issue are addressed in the plan.
- Step ordering respects dependencies: migration (1) before validators (3) before actions (4-5) before UI (7-9).
- The unnamed CHECK constraint on `method` needs careful handling in the migration. The plan says "drop and recreate" — Postgres auto-names it `payments_method_check`. The migration should use `ALTER TABLE payments DROP CONSTRAINT payments_method_check` explicitly. This is a minor detail the implementer should handle.
- Side-effect extraction from `recordPaymentReceived` to a shared helper is correct and avoids logic duplication.

### Architecture Alignment: PASS
- **RLS is the authorization layer**: The updated INSERT policy correctly enforces `status = 'pending'` and `confirmed_by IS NULL` at the DB level — members cannot bypass this via the API.
- **UTC in, local out**: `confirmed_at TIMESTAMPTZ` is correct. Reference memo dates use display-layer formatting only.
- **Sanity for content, Supabase for data**: Payment data correctly goes to Supabase.
- **Server components by default**: The plan correctly uses `'use client'` only for the MakePaymentPanel and updated PaymentsPageClient — the page components remain server components.
- **One ticket per branch**: Scope is appropriate for one PR.

### Database Design: PASS
- Column names are consistent with existing schema (snake_case).
- `status` defaults to `'confirmed'` — correct for backward compatibility with admin-recorded payments.
- `rejected_reason TEXT` is a good addition not in the original issue spec but needed for the reject flow.
- Foreign key on `confirmed_by` references `profiles(id)` — consistent with `recorded_by`.
- Index on `status` is correct for the pending queue query pattern.
- Migration is safe on existing data: `ALTER TABLE ADD COLUMN` with `DEFAULT` is a fast metadata-only operation in modern Postgres.

### Security: PASS
- RLS INSERT policy correctly constrains member inserts: own family, `status = 'pending'`, `confirmed_by IS NULL`, `confirmed_at IS NULL`. This prevents members from inserting pre-confirmed payments.
- All server actions have Zod validation before DB operations.
- Admin actions use `requireAdmin()` check.
- No secrets in code — payment handles stored in env vars.
- `recorded_by = (SELECT auth.uid())` in RLS prevents impersonation.

### Implementation Quality: CONCERN
- Step 8 is the most complex UI step and could be more specific about the client wrapper component structure. The plan mentions "create a new client wrapper component `MemberPaymentsClient`" but doesn't detail its props or state management. The implementer should follow the admin `PaymentsPageClient` pattern closely.
- The QR code for Zelle is listed as "placeholder image" — this is fine for the initial implementation but should be called out in the PR description.

### Risk Assessment: PASS
- All risks from the context brief are addressed with specific mitigations.
- The plan correctly identifies that deep link URLs may change and stores handles in env vars.
- The migration DEFAULT value ensures existing data compatibility.
- The extracted side-effect helper prevents logic divergence.

## Recommendations (non-blocking)
- When implementing the `MemberPaymentsClient` wrapper in Step 8, consider using a reducer or multiple state variables rather than a single complex state object — the panel needs `open`, `paymentType`, `amount`, `familyName`, `referenceMemo`, `relatedEventId`, and `relatedShareId`.
- For the reference memo Copy button, use the Clipboard API (`navigator.clipboard.writeText()`) with a fallback, and show a brief "Copied!" toast/indicator.
- Consider adding a `submitted_at` column (defaulting to `created_at`) to track when the member submitted vs. when the row was created, in case there's a timing difference. Not required for this iteration.

## Approved Scope
Implementation of all 10 steps as described in the plan:
1. Database migration adding status, reference_memo, confirmed_by, confirmed_at, rejected_reason columns; expanding method enum; updating INSERT RLS
2. Reference memo generator with unit tests
3. Zod validators for submit, confirm, reject
4. Member submitPayment server action
5. Admin confirmPayment and rejectPayment server actions with shared side-effect helper
6. Payment rejection email template
7. MakePaymentPanel client component
8. Member payments page integration
9. Admin pending payments queue with confirm/reject UI
10. Method enum updates in admin RecordPaymentPanel and PaymentsTable
