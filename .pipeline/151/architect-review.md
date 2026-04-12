# Architect Review — Issue #151: Server actions: family management

## VERDICT: APPROVED

## Review Summary

Clean, well-scoped plan for three server actions in a single new file. Correctly follows the established action pattern, reuses existing Zod validators, and relies on existing RLS policies for DB-level enforcement. The head-of-household guard is correctly designed. No new migrations or RLS changes needed.

## Detailed Review

### Correctness: PASS

- All three actions follow the correct flow: Zod parse → auth check → profile/family_id lookup → DB operation → revalidatePath.
- The head-of-household check correctly compares `family_members.profile_id` against `families.head_of_household` — both reference `profiles.id`.
- Early return for `profile.family_id === null` prevents confusing DB errors.
- Empty string → null conversion for phone/address is correct since these are nullable text columns.
- Step ordering is correct — single file, no dependency ordering issues.

### Architecture Alignment: PASS

- RLS is the authorization layer — the plan relies on existing RLS policies for DB-level enforcement AND adds action-level checks for clear error messages. This is the correct double-layer approach.
- Sanity for content, Supabase for data — family data correctly goes through Supabase.
- Server components by default — `'use server'` directive, no client code.
- One ticket per branch — correctly scoped to just the three actions.
- `revalidatePath('/member')` is the correct path for the member portal.

### Database Design: PASS

- No new tables or migrations needed — existing schema from #145/#146 is sufficient.
- RLS policies are comprehensive and already exist.
- The plan correctly avoids updating admin-controlled columns (membership_status, etc.) which the RLS WITH CHECK would block anyway.
- Column types in Zod schemas match DB column types.

### Security: PASS

- All inputs validated with Zod before use.
- Auth check via `supabase.auth.getUser()` on every action.
- Profile family_id lookup prevents cross-family access at the application level.
- RLS provides DB-level enforcement as a second layer.
- Head-of-household removal explicitly blocked.
- No string interpolation in queries — using Supabase client's parameterized methods.

### Implementation Quality: PASS

- Single step with a clear verify command (`npx tsc --noEmit`).
- Pattern references are specific (file paths, line numbers).
- Zod schemas are already tested in `member.test.ts`.
- ActionState type correctly duplicated per-file (matches project convention).

### Risk Assessment: PASS

- All three risks from context brief are addressed: head-of-household check, null family_id handling, cross-family protection.
- No additional risks identified.

## Required Changes (if REJECTED)

N/A

## Recommendations (non-blocking)

- The `removeFamilyMember` action makes two sequential queries (fetch member, then fetch family head_of_household). These could be combined into a single query joining family_members with families, but the current approach is clearer and the performance difference is negligible for a member-facing action.

## Approved Scope

Implementation of `src/actions/family.ts` containing:

1. `updateFamilyDetails` — Zod validate, auth, profile lookup, update families table (family_name, phone, address only)
2. `addFamilyMember` — Zod validate, auth, profile lookup, insert into family_members
3. `removeFamilyMember` — Zod validate, auth, profile lookup, head-of-household guard, delete from family_members
   All with `revalidatePath('/member')` on success.
