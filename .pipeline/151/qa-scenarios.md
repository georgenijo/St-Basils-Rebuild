# QA Scenarios — Issue #151: Server actions: family management

## Scope

This issue adds server-only code (`src/actions/family.ts`) with no UI changes.
The UI that consumes these actions is #158 (out of scope). Testing focuses on:

- Code correctness (TypeScript, lint, unit tests)
- Module import safety (no runtime errors from adding the file)
- Regression (existing pages/routes still work)

## Scenarios

### S1: TypeScript compiles cleanly

- Run `npx tsc --noEmit` — expect 0 errors
- **Result:** PASS

### S2: Lint passes on new file

- Run `npx eslint src/actions/family.ts` — expect 0 errors
- **Result:** PASS

### S3: All existing unit tests pass (194 tests)

- Run `npx vitest run` — expect 194/194 pass
- **Result:** PASS

### S4: Zod validators cover edge cases (31 tests in member.test.ts)

- The Zod schemas used by the actions are tested in `src/lib/validators/member.test.ts`
- **Result:** PASS (31/31)

### S5: /member route still redirects unauthenticated users to /login

- Playwright: navigate to /member, verify redirect to /login
- **Result:** (run via Playwright)

### S6: Public pages regression — homepage, events, contact, about, giving

- Playwright: navigate to each, verify 200 status and no console errors
- **Result:** (run via Playwright)

### S7: Action follows established pattern

- Manual code review: Zod validate → auth → profile/family_id → DB → revalidate
- Matches `src/actions/announcements.ts` pattern exactly
- ActionState type matches project convention (local per file)
- **Result:** PASS

### S8: Head-of-household guard in removeFamilyMember

- Code review: fetches member, verifies family_id match, fetches family head_of_household, compares
- Null-safe: `family && member.profile_id && member.profile_id === family.head_of_household`
- **Result:** PASS

### S9: Cross-family protection

- Code review: action-level check `member.family_id !== profile.family_id` + RLS at DB level
- Double-layer protection as per architect review
- **Result:** PASS

### S10: Empty string → null conversion for optional fields

- `parsed.data.phone || null` and `parsed.data.address || null`
- Handles both `undefined` and `''` from Zod correctly
- **Result:** PASS
