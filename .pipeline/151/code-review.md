# Code Review — Issue #151: Server actions: family management

## VERDICT: APPROVED

## Summary

Clean implementation of three server actions in a single new file, following the established project pattern exactly. All inputs are Zod-validated, auth-checked, and family-scoped. The head-of-household guard is correctly implemented with proper null handling. No security gaps, no logic errors, no type issues.

## Plan Compliance

COMPLETE — Every step in the plan was implemented exactly as specified. No deviations.

## Findings

### Critical (must fix before merge)

None.

### Suggestions (non-blocking)

- **[src/actions/family.ts:62,63]** `parsed.data.phone || null` converts empty string to null, which is correct. However, if Zod already validated with `.optional().or(z.literal(''))`, the value could be `undefined` (when omitted) or `''` (when empty). Both `undefined || null` and `'' || null` produce `null`, so this is safe. Just noting the implicit behavior is correct.

### Approved Files

- `src/actions/family.ts` — no issues. All three actions (updateFamilyDetails, addFamilyMember, removeFamilyMember) are correct.

## Verification

- Lint: checked — 0 errors (3 pre-existing warnings in unrelated files)
- TypeScript: checked — compiles cleanly
- Tests: checked — 194/194 pass
