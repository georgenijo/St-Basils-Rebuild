# Context Brief — Issue #158: Member portal: Family tab

## Issue Summary
Members need a Family tab in the member portal at `/member/family` where they can view and edit their family details (name, phone, address) and manage family members (view list, add new members, remove non-head members). The tab uses slide-out panels for edit/add forms, matching the existing admin `UserDetailPanel` pattern.

## Type
feature

## Acceptance Criteria
- [ ] Family details are editable via slide-out panel
- [ ] Family members list shows all household members
- [ ] Add/remove family members works
- [ ] Head of household cannot be removed

## Codebase Analysis

### Files Directly Involved
| File | Why |
|------|-----|
| `src/app/(member)/member/family/page.tsx` | **CREATE** — New page for the Family tab |
| `src/components/features/FamilyPanel.tsx` | **CREATE** — Slide-out panel for editing family details |
| `src/components/features/AddMemberPanel.tsx` | **CREATE** — Slide-out panel for adding a family member |
| `src/actions/family.ts` | EXISTS — Server actions: `updateFamilyDetails`, `addFamilyMember`, `removeFamilyMember` |
| `src/lib/validators/member.ts` | EXISTS — Zod schemas: `updateFamilySchema`, `addFamilyMemberSchema`, `removeFamilyMemberSchema` |
| `src/components/layout/MemberSidebar.tsx` | EXISTS — Already has "Family" nav item pointing to `/member/family` |
| `src/app/(member)/layout.tsx` | EXISTS — Auth check, role check, family fetch for sidebar |

### Database Impact
- Tables affected: `families` (read + update), `family_members` (read + insert + delete), `profiles` (read)
- New tables needed: none
- Migration dependencies: `20260409000000_create_families.sql` (#145), `20260409000001_create_family_members.sql` (#146) — both exist
- RLS considerations: All existing — members can SELECT/UPDATE their own family, INSERT/DELETE their own family_members. Non-admins blocked from changing `membership_status`, `membership_type`, `membership_expires_at`, `head_of_household` on families table.

### Existing Patterns to Follow
| Pattern | Example File | Notes |
|---------|-------------|-------|
| Server component page with data fetching | `src/app/(member)/member/membership/page.tsx` | Auth check, profile fetch, parallel data queries, Card-based layout |
| Slide-out panel with form + useActionState | `src/components/features/UserDetailPanel.tsx` | Fixed right panel, backdrop, escape key, body scroll lock, transitions |
| Server action with Zod validation | `src/actions/family.ts` | Already implements all three needed actions: updateFamilyDetails, addFamilyMember, removeFamilyMember |
| UI components | `src/components/ui/Card.tsx`, `src/components/ui/Button.tsx` | Card (variant="outlined"), Button (variant="primary"|"ghost"|"secondary") |
| Member portal page structure | `src/app/(member)/member/page.tsx` | Page header with h1 + subtitle, Card-based layout, no-family fallback state |

### Test Coverage
- Existing tests that touch this area: `src/lib/validators/member.test.ts` (validator tests), `src/actions/shares.test.ts` (action test pattern)
- Test gaps: No tests for family.ts actions, no E2E tests for family tab

### Related Issues
| Issue | Relationship |
|-------|-------------|
| #155 | Dependency — member layout (DONE, merged) |
| #145 | Dependency — families table migration (DONE, merged) |
| #146 | Dependency — family_members table migration (DONE, merged) |
| #151 | Dependency — family management server actions (DONE, merged) |
| #159 | Sibling — Payments tab (same portal, separate page) |
| #160 | Sibling — Shares tab (same portal, separate page) |

## Risks
- Slide-out panels add `'use client'` components; the page itself should remain a server component for data fetching
- Head-of-household protection is in the server action but the UI should also disable/hide the remove button for the head
- The `relationship` field for the head of household is stored as 'self' — need to display "Head of Household" label correctly
- Avatar initials generation needs to match the pattern in `UserDetailPanel.tsx`

## Key Conventions
- Server components by default; `'use client'` only for interactive panels
- Tailwind classes match design system: `font-heading` for headings, `text-wood-900` for primary text, `text-wood-800/60` for secondary, `bg-cream-50` backgrounds
- Card variant="outlined" for content containers
- `revalidatePath('/member')` already called by server actions for cache invalidation
- Form actions use `useActionState` pattern (not useFormState)
- Slide-out panels: 520px wide, right-aligned, with backdrop overlay, escape key close, body scroll lock
