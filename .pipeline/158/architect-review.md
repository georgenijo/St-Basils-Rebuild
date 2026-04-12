# Architect Review — Issue #158: Member portal: Family tab

## VERDICT: APPROVED

## Review Summary
The plan is well-structured and follows established codebase patterns. All dependencies (migrations, server actions, validators) already exist. The plan correctly separates server component (data fetching) from client components (interactivity) and reuses existing patterns from `UserDetailPanel`. No new RLS policies are needed. The four-step approach with atomic commits is appropriate for this scope.

## Detailed Review

### Correctness: PASS
- All acceptance criteria from the issue are addressed in the plan.
- Step ordering is correct: page first (Step 1), then client wrapper (Step 2), then panels (Steps 3-4). However, since they all reference each other, they'll need to be built together — the plan accounts for this by having them as separate commit steps.
- Head-of-household protection is correctly planned at both UI level (hide remove button) and server level (existing action check).
- The plan correctly identifies that 'self' should not be in the relationship dropdown for AddMember, since the user already exists as a family member.

### Architecture Alignment: PASS
- **RLS is the authorization layer**: All existing RLS policies cover the needed operations. No middleware-only auth.
- **Server components by default**: Page is a server component; only interactive panels and the client wrapper use `'use client'`.
- **Sanity for content, Supabase for data**: Family data correctly stays in Supabase.
- **One ticket per branch**: Scope is appropriately bounded to this single feature.

### Database Design: PASS
- No new tables or migrations needed — this is UI-only.
- Existing RLS policies from #145 and #146 fully cover the SELECT, UPDATE, INSERT, DELETE operations needed.
- The plan correctly queries `family_members` with the right columns and join pattern.

### Security: PASS
- All three server actions (`updateFamilyDetails`, `addFamilyMember`, `removeFamilyMember`) already have Zod validation, auth checks, and family_id ownership verification.
- RLS policies provide DB-level enforcement even if server action checks were bypassed.
- Head-of-household protection exists in `removeFamilyMember` action (lines 177-185 of `src/actions/family.ts`).
- No new attack surface introduced.

### Implementation Quality: PASS
- Steps are atomic and independently verifiable with TypeScript compilation checks.
- Existing patterns are clearly referenced with specific file paths and line numbers.
- The plan is specific enough to implement without guesswork — field names, component props, and UI structure are all specified.

### Risk Assessment: PASS
- All risks from the context brief are addressed with concrete mitigations.
- The out-of-scope section correctly excludes edit-member functionality (not in the issue spec).

## Recommendations (non-blocking)
- **Step 2**: When implementing remove, consider showing a brief confirmation or using an optimistic UI pattern to prevent accidental removals. A simple `window.confirm()` or inline confirmation would suffice — but this is a polish item, not blocking.
- **Step 1**: The `revalidatePath('/member')` in the existing server actions will revalidate the overview page but should also add `/member/family` for the family page specifically. However, since Next.js revalidates the entire route segment, `/member` should cover it. Verify during implementation.

## Approved Scope
Implementation of the `/member/family` page with:
1. Server component page fetching family details and members
2. Client wrapper managing panel state
3. Edit Family Details slide-out panel with `updateFamilyDetails` action
4. Add Family Member slide-out panel with `addFamilyMember` action
5. Remove family member via inline form with `removeFamilyMember` action
6. No-family fallback state
