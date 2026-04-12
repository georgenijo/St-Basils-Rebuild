# Architect Review — Issue #154: Server actions: admin event charges and payment recording

## VERDICT: APPROVED

## Review Summary
The plan is well-structured and covers both server actions with appropriate Zod validation, admin auth checks, and DB operations. The schema extension for relation fields is necessary and correctly identified. Existing test compatibility is preserved. Two minor concerns noted below but neither blocks implementation.

## Detailed Review

### Correctness: PASS
- Both actions follow the established pattern: Zod → auth → DB → revalidate → return
- The schema extension with `superRefine` correctly enforces conditional relation field requirements per payment type
- Step ordering is correct: schema extension (Step 1) before action creation (Steps 2-3)
- All acceptance criteria from the issue are addressed
- Existing `recordPaymentSchema` tests will continue to pass since they test `membership` and `donation` types which don't require relation fields

### Architecture Alignment: PASS
- RLS is the authorization layer — uses authenticated client, not admin client. RLS policies on all tables enforce admin-only mutations. The action-level admin check is a defense-in-depth measure, not the sole authorization mechanism.
- Supabase for data — correct store for payments and charges
- Server actions with `'use server'` directive — no unnecessary `'use client'`
- One ticket per branch — scope is tight: two related actions in one file

### Database Design: PASS
- No new migrations needed — all tables exist
- The `payments` table CHECK constraints (`chk_payments_event_relation`, `chk_payments_share_relation`, `chk_payments_no_relation`) are enforced at DB level, and the Zod superRefine provides early validation before hitting the DB
- The composite FK `(related_share_id, family_id) → shares(id, family_id)` ensures share-family consistency at DB level
- The unique constraint `(event_id, family_id)` on `event_charges` prevents duplicates, and the plan handles the 23505 error

### Security: PASS
- Admin auth check pattern from `users.ts:32-47` is the proven pattern
- All input validated with Zod before DB operations
- No string interpolation in queries — Supabase client handles parameterization
- `recorded_by` is set to `user.id` from the auth check, not from form input — prevents impersonation
- RLS policies are pre-existing and complete for all operations

### Implementation Quality: CONCERN
- Steps are atomic and verifiable
- Pattern references are specific (file paths and line numbers)
- Minor concern: The plan specifies `charges` comes as JSON string in FormData, which is the correct approach for array-of-objects, but the implementer should ensure `JSON.parse` errors are caught before Zod validation, not after. A malformed JSON string would throw before reaching Zod.

### Risk Assessment: CONCERN
- Non-atomic side effects: The plan accepts sequential INSERT + UPDATE operations. If the UPDATE fails after a successful INSERT, the payment exists but the side effect (e.g., marking charge as paid) doesn't. This is acceptable for an admin tool — the payment record is the source of truth, and the paid flag can be corrected. However, the implementer should return a partial success message (not a full failure) if the payment was inserted but the side effect failed.

## Recommendations (non-blocking)
- In Step 3, when the side-effect UPDATE fails, return `{ success: true, message: 'Payment recorded, but failed to update related record. Please check manually.' }` rather than a failure state. The payment was recorded successfully.
- Consider adding `{ onConflict: 'event_id,family_id' }` upsert option in `assignEventCosts` as an alternative to error handling, if the desired behavior is to update existing charges rather than reject duplicates. However, the current approach (reject duplicates) is valid for the issue requirements.

## Approved Scope
- Extend `recordPaymentSchema` in `src/lib/validators/member.ts` with `related_event_id`, `related_share_id`, and `superRefine` validation
- Create `src/actions/admin-payments.ts` with `assignEventCosts` and `recordPaymentReceived`
- Both actions: Zod validation, admin auth check, DB operations, side effects, error handling, revalidation
