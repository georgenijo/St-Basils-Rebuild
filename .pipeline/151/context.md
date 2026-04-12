# Context Brief — Issue #151: Server actions: family management

## Issue Summary

Create three server actions in `src/actions/family.ts` that let authenticated members manage their own family: update family details (name, phone, address), add family members, and remove family members (with head-of-household protection). Follows the established server action pattern from `src/actions/announcements.ts`.

## Type

feature

## Acceptance Criteria

- Members can edit their own family details (family_name, phone, address)
- Members can add family members to their own family
- Members can remove family members from their own family
- Members cannot modify other families' data
- Head of household cannot be removed
- All inputs validated with Zod before DB operations

## Codebase Analysis

### Files Directly Involved

| File                                                           | Why                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/actions/family.ts`                                        | **CREATE** — new file containing all three server actions                                                                |
| `src/lib/validators/member.ts`                                 | **READ** — contains `updateFamilySchema`, `addFamilyMemberSchema`, `removeFamilyMemberSchema` (already exists from #150) |
| `src/lib/supabase/server.ts`                                   | **READ** — `createClient()` used for auth + DB operations                                                                |
| `supabase/migrations/20260409000000_create_families.sql`       | **READ** — families table schema, RLS policies                                                                           |
| `supabase/migrations/20260409000001_create_family_members.sql` | **READ** — family_members table schema, RLS policies                                                                     |

### Database Impact

- **Tables affected**: `families` (UPDATE), `family_members` (INSERT, DELETE), `profiles` (SELECT for auth/family_id lookup)
- **New tables needed**: None — #145 and #146 already created them
- **Migration dependencies**: `20260409000000_create_families.sql` and `20260409000001_create_family_members.sql` must exist (they do)
- **RLS considerations**: Already comprehensive:
  - `families` UPDATE policy: members can update own family but NOT membership_status, membership_type, membership_expires_at, or head_of_household
  - `family_members` INSERT/DELETE policy: members can add/remove from their own family
  - RLS handles cross-family protection at DB level, but server actions should also verify `profile.family_id` match before attempting operations

### Existing Patterns to Follow

| Pattern                                          | Example File                         | Notes                                                                      |
| ------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------- |
| Server action signature                          | `src/actions/announcements.ts`       | `(prevState: ActionState, formData: FormData) => Promise<ActionState>`     |
| ActionState type                                 | `src/actions/announcements.ts:9-13`  | `{ success: boolean; message: string; errors?: Record<string, string[]> }` |
| Zod validation → auth check → DB op → revalidate | `src/actions/announcements.ts:15-98` | Parse with `.safeParse()`, check user, insert/update, `revalidatePath()`   |
| Supabase client creation                         | `src/lib/supabase/server.ts`         | `const supabase = await createClient()`                                    |
| FormData extraction                              | `src/actions/announcements.ts:21-29` | `formData.get('field')` with explicit casts                                |

### Test Coverage

- Existing tests: `src/lib/validators/member.test.ts` covers all three Zod schemas (updateFamily, addFamilyMember, removeFamilyMember)
- Test gaps: No unit tests for the server actions themselves (consistent with other actions — no action files have unit tests except `users.test.ts`)

### Related Issues

| Issue | Relationship                                                           |
| ----- | ---------------------------------------------------------------------- |
| #145  | Dependency — families table migration (exists)                         |
| #146  | Dependency — family_members table migration (exists)                   |
| #150  | Dependency — Zod validators (exists in `src/lib/validators/member.ts`) |
| #158  | Depends on this — Member portal Family tab will use these actions      |
| #152  | Same batch — shares server actions (similar pattern)                   |
| #153  | Same batch — donations server actions (similar pattern)                |

## Risks

- **Head-of-household check**: The `removeFamilyMember` action must prevent removing the family member whose `profile_id` matches `families.head_of_household`. This check is NOT enforced by RLS — it must be explicit in the action.
- **No family assigned**: A member with `profile.family_id = NULL` should get a clear error, not a silent failure or DB error.
- **RLS double-protection**: While RLS prevents cross-family access, the server action should also validate `profile.family_id` matches the target family for clear error messages.

## Key Conventions

- `'use server'` directive at top of action files
- ActionState return type with `success`, `message`, `errors` fields
- Zod `.safeParse()` first, then auth check, then DB operation
- `revalidatePath('/member')` after mutations (member portal path)
- No `'use client'` — these are server-only files
- Import validators from `@/lib/validators/member`
- Import supabase client from `@/lib/supabase/server`
