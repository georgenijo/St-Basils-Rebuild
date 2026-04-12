# Architect Review — Issue #185: Member directory: searchable family list for logged-in members

## VERDICT: APPROVED

## Review Summary

The plan is well-structured, follows existing patterns, and addresses all acceptance criteria. The RLS design is correct — two new permissive SELECT policies that OR with existing ones, scoped to `directory_visible = true` and active authenticated users. The head-of-household name resolution via `family_members` where `relationship = 'self'` is the right call to avoid RLS complexity on cross-family `profiles` reads.

## Detailed Review

### Correctness: PASS

- All 8 acceptance criteria from the issue are addressed in the plan.
- Step ordering is correct: migration (Step 1) → action/validator (Step 2) → sidebar (Step 3) → toggle (Step 4) → page (Step 5) → client component (Step 6). Dependencies are respected.
- The directory page fetches families (RLS filters to visible), then fetches members by ID list (RLS filters to visible families' members). No logic gaps.
- Head-of-household name resolution via `family_members` with `relationship = 'self'` is correct since the head member creates a self-referencing family_member row.

### Architecture Alignment: PASS

- **RLS is the authorization layer**: Both new policies enforce access at the DB level. The page doesn't manually filter `directory_visible` — it relies on RLS. Correct.
- **UTC in, local out**: `created_at` display uses `America/New_York` timezone. Correct.
- **Sanity for content, Supabase for data**: Directory data is operational, not editorial. Supabase is correct.
- **Server components by default**: Page is a server component; only the interactive search/expand is `'use client'`. Correct.
- **One ticket per branch**: Scoped to issue #185 only. Correct.

### Database Design: PASS

- `directory_visible BOOLEAN NOT NULL DEFAULT true` — correct type, sensible default (opt-out model per issue spec).
- The column name is descriptive and consistent with the existing snake_case convention.
- No new indexes needed — the directory query fetches all visible families (no WHERE on `directory_visible` at the query level since RLS handles it).
- The new policies use `(SELECT auth.uid())` for performance. Correct.
- Migration is safe on existing data — adding a NOT NULL column with DEFAULT doesn't lock the table (Postgres fills the default lazily for existing rows).
- No FK or cascade changes needed.

### Security: PASS

- **RLS policies**: The new SELECT policies correctly require `profiles.is_active = true`, matching the project's deactivation pattern. Inactive users cannot see the directory.
- **No write access widening**: New policies are SELECT-only on both tables. INSERT/UPDATE/DELETE policies are unchanged.
- **Privacy toggle**: Goes through the existing family Update RLS policy, which allows members to update their own family's non-admin columns. `directory_visible` is not in the admin-controlled blocklist, so members can toggle it. Correct.
- **Zod validation**: The toggle action validates input with Zod. Correct.
- **No email exposure**: Plan explicitly excludes email from the directory display. Correct.
- **No secrets in code**: No secrets referenced.

### Implementation Quality: PASS

- Steps are atomic and independently verifiable with real commands.
- Pattern references are specific (file paths, line numbers).
- The plan is specific enough to implement without guesswork (exact SQL, exact TypeScript interfaces).
- CONCERN (minor): Step 5 fetches members with `.in('family_id', familyIds)`. If `familyIds` is empty (no visible families), Supabase's `.in()` with an empty array returns no results, which is correct behavior. No issue.

### Risk Assessment: PASS

- All risks from the context brief are addressed in the Risk Mitigation table.
- The RLS policy interaction is correctly analyzed (permissive OR behavior).
- Performance for ~100 families is fine with client-side search.
- Head-of-household name resolution approach avoids the `profiles` cross-read problem.

## Required Changes (if REJECTED)

N/A

## Recommendations (non-blocking)

- In Step 5, guard the `.in()` call: if `familyIds` is empty, skip the query and pass `[]` for members. This avoids an unnecessary DB round-trip.
- Consider adding `aria-live="polite"` on the search results count so screen readers announce filter changes.

## Approved Scope

Implementation of all 6 steps as described:

1. Migration adding `directory_visible` column + 2 RLS SELECT policies
2. Zod schema + server action for visibility toggle
3. Sidebar "Directory" nav item
4. Privacy toggle on Family tab
5. Directory page (server component)
6. DirectoryClient component (search, cards, expand)
