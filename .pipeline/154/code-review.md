# Code Review — Issue #154: Server actions: admin event charges and payment recording

## VERDICT: APPROVED

## Summary

Both server actions are implemented correctly following established patterns. Zod validation runs before any DB operation, admin auth is checked via profile role query, RLS policies provide DB-level enforcement, and side-effect failures return partial success messages. The schema extension preserves backward compatibility with existing tests.

## Plan Compliance

COMPLETE — All 4 plan steps implemented:

1. recordPaymentSchema extended with relation fields + superRefine ✓
2. assignEventCosts action created ✓
3. recordPaymentReceived action created ✓
4. Lint and type-check pass ✓

No unauthorized deviations. The `requireAdmin` helper was extracted as a local function within the file — a reasonable factoring choice that reduces duplication between the two actions.

## Findings

### Critical (must fix before merge)

None.

### Suggestions (non-blocking)

- **[src/actions/admin-payments.ts:27]** The `requireAdmin` return type uses `as const` assertions for the error strings. This works but the function signature could be more explicit with a discriminated union return type. Low priority — the current approach is type-safe and matches the codebase style.

- **[src/actions/admin-payments.ts:175-178]** The membership expiry calculation uses `new Date()` which gives UTC time. Since `membership_expires_at` is a `DATE` column (not `TIMESTAMPTZ`), and the calculation outputs `toISOString().split('T')[0]` (UTC date string), there could be an off-by-one at the date boundary near midnight ET. This is a minor edge case — membership expiry checks are unlikely to be time-critical to the hour, and the church timezone is UTC-4/5 so 11pm ET is already the next UTC day. Acceptable for now.

- **[src/lib/validators/member.ts:99-110]** The superRefine for membership/donation types rejects if `related_event_id` or `related_share_id` is set. However, the action passes `formData.get('related_event_id') ?? ''` which means an empty string is always present. The schema has `.optional().or(z.literal(''))` so empty string passes the UUID check and evaluates as falsy in the superRefine `if (data.related_event_id)` check. This works correctly — empty strings are falsy in JS. No issue, just noting the flow.

### Approved Files

- `src/actions/admin-payments.ts` — no issues
- `src/lib/validators/member.ts` — no issues

## Verification

- Lint: checked — 0 new errors
- TypeScript: checked — 0 new errors
- Tests: checked — 31/31 validator tests pass
