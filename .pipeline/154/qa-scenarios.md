# QA Scenarios — Issue #154: Server actions: admin event charges and payment recording

## Validator Tests (Vitest unit tests)

### recordPaymentSchema — superRefine conditional validation

- **S1**: Event payment WITH related_event_id → PASS
- **S2**: Event payment WITHOUT related_event_id → FAIL (event ID required)
- **S3**: Share payment WITH related_share_id → PASS
- **S4**: Share payment WITHOUT related_share_id → FAIL (share ID required)
- **S5**: Membership payment WITH related_event_id set → FAIL (should not be set)
- **S6**: Membership payment WITH related_share_id set → FAIL (should not be set)
- **S7**: Donation payment with no relation IDs → PASS
- **S8**: Donation payment WITH related_event_id set → FAIL
- **S9**: Event payment with empty string related_event_id → FAIL (empty string allowed by .or(z.literal('')) but superRefine should catch)
- **S10**: String coercion — amount as string "100" → coerces to 100, PASS

### assignEventCostsSchema

- **S11**: Valid single charge → PASS (already tested)
- **S12**: Charge with zero amount → FAIL
- **S13**: Charge with invalid family_id → FAIL

## Playwright E2E Tests (route/compilation verification)

Since these are server actions with no UI yet (admin UI is #161/#162), Playwright tests verify:

- **S14**: App compiles and homepage still loads (regression)
- **S15**: Admin route exists and is not 404
- **S16**: Public pages unaffected (regression)

## Code Review (manual)

- **S17**: `requireAdmin` checks auth AND role, not just auth
- **S18**: `recorded_by` comes from `user.id`, not form input
- **S19**: Side-effect failures return partial success, not failure
- **S20**: `revalidatePath('/admin')` called on success
- **S21**: JSON.parse errors caught before Zod validation
- **S22**: Membership expiry logic uses max(current expiry, today) as base
