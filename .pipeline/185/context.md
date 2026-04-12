# Context Brief — Issue #185: Member directory: searchable family list for logged-in members

## Issue Summary

Parishioners need a way to find and contact each other (phone trees, carpooling, check-ins). The feature adds a searchable family directory page at `/member/directory` that shows visible families with their phone numbers, plus a privacy toggle on the family tab to opt out, and a new sidebar nav entry.

## Type

feature

## Acceptance Criteria

- Directory page loads at `/member/directory`
- Only logged-in active members can access (layout already redirects unauthenticated)
- Search filters by family name and head of household name
- Families with `directory_visible = false` do not appear (RLS-enforced)
- Click expands to show family members (name + relationship badge)
- Phone shown, email NOT shown
- Privacy toggle works on Family tab (`families.directory_visible`)
- Admin can see all families regardless of visibility (existing `is_admin()` policy)

## Codebase Analysis

### Files Directly Involved

| File                                                     | Why                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDD_add_directory_visible.sql` | New migration: add `directory_visible` column + new RLS policy  |
| `src/app/(member)/member/directory/page.tsx`             | New directory page (server component)                           |
| `src/components/features/DirectoryClient.tsx`            | New client component: search bar, family cards, expand/collapse |
| `src/components/layout/MemberSidebar.tsx`                | Add "Directory" nav item after Shares                           |
| `src/components/features/FamilyClient.tsx`               | Add privacy toggle for `directory_visible`                      |
| `src/actions/family.ts`                                  | Add server action to toggle `directory_visible`                 |
| `src/lib/validators/member.ts`                           | Add Zod schema for directory visibility toggle                  |

### Database Impact

- **Tables affected**: `families` (add column), `family_members` (read for expanded view), `profiles` (read for head-of-household name)
- **New tables needed**: None
- **Migration dependencies**: `20260409000000_create_families.sql` must exist (it does)
- **RLS considerations**:
  - Need new SELECT policy on `families` that allows active members to read families where `directory_visible = true`
  - The existing "Select families" policy only lets members see their own family — a new policy must allow seeing other visible families
  - Existing `is_admin()` SELECT policy already covers admin access to all families
  - `family_members` already allows select for own family only — need a new policy for directory reads of visible families' members
  - `profiles` read needed for head-of-household name lookup — existing "Users can read own profile" + "Admins can read all" won't suffice for cross-family lookups. The head-of-household name can be fetched via `family_members` table where `relationship = 'self'` to avoid needing profiles cross-read.

### Existing Patterns to Follow

| Pattern                             | Example File                               | Notes                                                                       |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| Member page structure               | `src/app/(member)/member/shares/page.tsx`  | Server component page with auth check, data fetch, cards                    |
| Client component with interactivity | `src/components/features/FamilyClient.tsx` | `'use client'`, useState for panels/expand, imports from `@/components/ui`  |
| Server action pattern               | `src/actions/family.ts`                    | Zod validation → auth check → profile fetch → DB operation → revalidatePath |
| Sidebar nav items                   | `src/components/layout/MemberSidebar.tsx`  | `NavItem[]` array with label, href, icon SVG                                |
| Card/Table UI                       | `src/app/(member)/member/shares/page.tsx`  | Card component with outlined variant, table with wood-800 color palette     |
| Avatar initials                     | `src/components/features/FamilyClient.tsx` | `getInitials()`, `avatarColor()` helpers                                    |

### Test Coverage

- Existing tests that touch this area: None specific to member directory
- Test gaps: No E2E tests for member portal pages yet; smoke tests cover auth guard redirects

### Related Issues

| Issue | Relationship                                       |
| ----- | -------------------------------------------------- |
| #145  | Dependency — families table (exists)               |
| #146  | Dependency — family_members table (exists)         |
| #155  | Dependency — member portal layout/sidebar (exists) |
| #158  | Dependency — family tab (exists, toggle goes here) |

## Risks

- **RLS policy interaction**: The existing "Select families" policy lets members see only their own family. Adding a new permissive policy for directory reads will effectively OR with the existing one, which is correct behavior. Must be careful the new policy doesn't inadvertently widen write access.
- **Cross-family member reads**: `family_members` RLS currently restricts SELECT to own family. The directory needs to read other families' members for the expanded view. A new RLS policy is needed on `family_members` for this.
- **Head of household name resolution**: The issue asks for head-of-household name. `families.head_of_household` is a UUID FK to `profiles.id`. Reading profiles cross-family is blocked by RLS. Alternative: use `family_members` where `relationship = 'self'` (which is the head's entry), OR join via the head_of_household → profiles name. The simplest approach: add a new RLS policy scoped to directory reads, or query family_members for `relationship = 'self'` to get the name.
- **Performance**: Loading all visible families + their members could be slow if the parish grows. Should use client-side search (parish is ~100 families max) rather than server-side search to keep it simple.

## Key Conventions

- RLS is the authorization layer — enforce at DB level, not just middleware
- Server components by default — only `'use client'` for search/expand interactivity
- UTC in, local out — `created_at` displayed with `America/New_York` timezone
- Zod validation on all server action inputs
- `auth.uid()` wrapped in `(SELECT ...)` for RLS performance
- Use `@/components/ui` Card, Button components from the design system
- Color palette: `wood-800/60`, `wood-900`, `cream-50` for the member portal
