# Implementation Plan — Issue #151: Server actions: family management

## Approach Summary

Create a single new file `src/actions/family.ts` containing three server actions (`updateFamilyDetails`, `addFamilyMember`, `removeFamilyMember`) following the exact pattern from `src/actions/announcements.ts`. All three actions share a common flow: Zod validation → auth check → profile/family_id lookup → DB operation → revalidatePath. The Zod validators already exist in `src/lib/validators/member.ts` from issue #150, so no new validator code is needed.

## Prerequisites

- Migration `20260409000000_create_families.sql` exists (✓ — issue #145)
- Migration `20260409000001_create_family_members.sql` exists (✓ — issue #146)
- Zod schemas exist in `src/lib/validators/member.ts` (✓ — issue #150)
- Branch `issue/151-server-actions-family-management` exists and is clean (✓)

## Steps

### Step 1: Create `src/actions/family.ts` with all three server actions

**Files:**

- `src/actions/family.ts` — create

**What to do:**

Create `src/actions/family.ts` with `'use server'` directive. Define a local `ActionState` type identical to `src/actions/announcements.ts:9-13`:

```
type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}
```

Import:

- `revalidatePath` from `next/cache`
- `createClient` from `@/lib/supabase/server`
- `updateFamilySchema`, `addFamilyMemberSchema`, `removeFamilyMemberSchema` from `@/lib/validators/member`

**Action 1: `updateFamilyDetails(prevState: ActionState, formData: FormData): Promise<ActionState>`**

1. Parse formData with Zod:

   ```
   const parsed = updateFamilySchema.safeParse({
     family_name: formData.get('family_name'),
     phone: formData.get('phone'),
     address: formData.get('address'),
   })
   ```

   Return validation errors if `!parsed.success` (same pattern as announcements.ts:31-36).

2. Auth check:

   ```
   const supabase = await createClient()
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) return { success: false, message: 'Unauthorized' }
   ```

3. Fetch profile to get `family_id`:

   ```
   const { data: profile } = await supabase
     .from('profiles')
     .select('family_id')
     .eq('id', user.id)
     .single()
   ```

   If `!profile?.family_id` return `{ success: false, message: 'No family assigned to your account' }`.

4. Update the family (RLS enforces own-family-only + blocks admin columns):

   ```
   const { error } = await supabase
     .from('families')
     .update({
       family_name: parsed.data.family_name,
       phone: parsed.data.phone || null,
       address: parsed.data.address || null,
     })
     .eq('id', profile.family_id)
   ```

   If error, return `{ success: false, message: 'Failed to update family details' }`.

5. `revalidatePath('/member')` and return success.

**Action 2: `addFamilyMember(prevState: ActionState, formData: FormData): Promise<ActionState>`**

1. Parse formData with Zod:

   ```
   const parsed = addFamilyMemberSchema.safeParse({
     full_name: formData.get('full_name'),
     relationship: formData.get('relationship'),
   })
   ```

   Return validation errors if fails.

2. Auth check (same as above).

3. Fetch profile for `family_id`. Return error if no family assigned.

4. Insert into `family_members` (RLS enforces own-family-only):

   ```
   const { error } = await supabase
     .from('family_members')
     .insert({
       family_id: profile.family_id,
       full_name: parsed.data.full_name,
       relationship: parsed.data.relationship,
     })
   ```

   If error, return `{ success: false, message: 'Failed to add family member' }`.

5. `revalidatePath('/member')` and return success.

**Action 3: `removeFamilyMember(prevState: ActionState, formData: FormData): Promise<ActionState>`**

1. Parse formData with Zod:

   ```
   const parsed = removeFamilyMemberSchema.safeParse({
     member_id: formData.get('member_id'),
   })
   ```

   Return validation errors if fails.

2. Auth check (same as above).

3. Fetch profile for `family_id`. Return error if no family assigned.

4. **Head-of-household protection** — fetch the family_member row being removed and check if their `profile_id` matches the family's `head_of_household`:

   ```
   const { data: member } = await supabase
     .from('family_members')
     .select('id, family_id, profile_id')
     .eq('id', parsed.data.member_id)
     .single()
   ```

   If `!member` return `{ success: false, message: 'Family member not found' }`.
   If `member.family_id !== profile.family_id` return `{ success: false, message: 'You can only remove members from your own family' }`.

   Then check head of household:

   ```
   const { data: family } = await supabase
     .from('families')
     .select('head_of_household')
     .eq('id', profile.family_id)
     .single()

   if (family && member.profile_id && member.profile_id === family.head_of_household) {
     return { success: false, message: 'Cannot remove the head of household' }
   }
   ```

5. Delete the family member (RLS also enforces own-family-only):

   ```
   const { error } = await supabase
     .from('family_members')
     .delete()
     .eq('id', parsed.data.member_id)
   ```

   If error, return `{ success: false, message: 'Failed to remove family member' }`.

6. `revalidatePath('/member')` and return success.

**Pattern to follow:**

- `src/actions/announcements.ts` — overall structure, ActionState type, validation → auth → DB → revalidate flow
- `src/actions/events.ts` — similar auth check pattern

**Verify:**

```bash
npx tsc --noEmit
```

**Done when:**

- `src/actions/family.ts` exists with all three exported async functions
- TypeScript compiles with no errors
- All three actions follow the Zod → auth → profile lookup → DB → revalidate pattern
- `removeFamilyMember` has explicit head-of-household check

## Acceptance Criteria (Full)

- [x] `updateFamilyDetails` validates input with `updateFamilySchema`, checks auth, verifies family_id, updates families table, revalidates `/member`
- [x] `addFamilyMember` validates input with `addFamilyMemberSchema`, checks auth, verifies family_id, inserts into family_members, revalidates `/member`
- [x] `removeFamilyMember` validates input with `removeFamilyMemberSchema`, checks auth, verifies family_id, prevents head-of-household removal, deletes from family_members, revalidates `/member`
- [x] Members cannot modify other families (enforced by both action logic and RLS)
- [x] Head of household cannot be removed (enforced by explicit check in action)
- [x] All inputs validated with Zod before any DB operation
- [x] TypeScript compiles cleanly

## RLS Policy Plan

| Table            | Policy                                  | Rule                                                                                                                              |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `families`       | "Update families" (existing)            | Members can update own family; blocked from changing membership_status, membership_type, membership_expires_at, head_of_household |
| `family_members` | "Insert family members" (existing)      | Members insert into own family only                                                                                               |
| `family_members` | "Delete family members" (existing)      | Members delete from own family only                                                                                               |
| `profiles`       | "Users can read own profile" (existing) | Needed for family_id lookup                                                                                                       |

No new RLS policies needed — #145 and #146 migrations already have comprehensive policies.

## Risk Mitigation

| Risk                                         | Mitigation                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Head-of-household removal not blocked by RLS | Explicit check in `removeFamilyMember` — fetch family's `head_of_household`, compare to member's `profile_id` |
| Member with no family_id                     | Early return with clear error message before any DB write                                                     |
| Cross-family access                          | Double protection: action checks `profile.family_id` match + RLS policies enforce at DB level                 |
| Empty string vs null for phone/address       | Convert empty strings to null before DB write (`parsed.data.phone \|\| null`)                                 |

## Out of Scope

- UI components for the member portal Family tab (that's #158)
- Admin family management actions (different issue)
- Unit tests for server actions (no other action files have them — `users.test.ts` is the only exception and tests a different pattern)

## Estimated Complexity

low — Single file creation following an established pattern, with existing validators and DB schema. Only complexity is the head-of-household guard in `removeFamilyMember`.
