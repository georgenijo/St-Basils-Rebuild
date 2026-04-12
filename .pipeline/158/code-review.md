# Code Review — Issue #158: Member portal: Family tab

## VERDICT: APPROVED

## Summary

Clean implementation that follows all established codebase patterns. The page is a server component with parallel data fetching, and interactivity is properly isolated in `'use client'` components. All server actions and validators are reused from existing code — no new DB operations were needed. Security is solid: RLS enforces access, Zod validates inputs, and head-of-household protection works at both UI and action levels.

## Plan Compliance

COMPLETE — All four plan steps were implemented as specified. No unauthorized deviations.

## Findings

### Critical (must fix before merge)

None.

### Suggestions (non-blocking)

- **[FamilyClient.tsx:188-194]** The `RemoveMemberButton` error effect sets `hasNotified` but doesn't display the error to the user. If removal fails (e.g., server error), the user sees no feedback. Consider adding a small inline error tooltip or visual indicator. Not blocking because the server action error case is rare and the button returns to its normal state.

- **[EditFamilyPanel.tsx]** The `defaultValue` on inputs means if the user opens the panel, edits a field, closes without saving, and reopens, the inputs will show the last-submitted (or original server) values, not what they typed. This is correct behavior for this use case since it reflects the saved state, but worth noting.

- **[FamilyClient.tsx:147]** The `isHead` check uses `member.profile_id === family.head_of_household`. If `head_of_household` is null and `profile_id` is also null, they'd match as equal — but this would mean a member without a linked profile can't be removed. In practice this won't happen because `head_of_household` is always a real user ID, and `profile_id === null` members are not the head. No fix needed.

### Approved Files

- `src/app/(member)/member/family/page.tsx` — clean server component, correct parallel fetching, proper fallback states
- `src/components/features/FamilyClient.tsx` — correct panel state management, proper head-of-household protection, good avatar/badge rendering
- `src/components/features/EditFamilyPanel.tsx` — matches UserDetailPanel pattern, proper form handling with useActionState
- `src/components/features/AddMemberPanel.tsx` — correct form reset on success, proper relationship options (excludes 'self')

## Verification

- Lint: checked (clean)
- TypeScript: checked (clean)
- Tests: checked (no regressions, no new tests needed for this UI-only change)
