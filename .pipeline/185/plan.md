# Implementation Plan — Issue #185: Member directory: searchable family list for logged-in members

## Approach Summary

Add a `directory_visible` boolean column to `families`, create two new RLS policies (one for cross-family reads on `families`, one on `family_members` for expanded view), build a server component directory page at `/member/directory` with a client-side searchable/expandable family list, add a privacy toggle to the family tab, and wire up a sidebar nav entry. The page fetches all visible families with their members in a single server query and does client-side filtering to keep it simple for a ~100-family parish.

## Prerequisites

- Migration `20260409000000_create_families.sql` exists (verified)
- Migration `20260409000001_create_family_members.sql` exists (verified)
- Member portal layout at `src/app/(member)/layout.tsx` exists with auth check (verified)
- MemberSidebar at `src/components/layout/MemberSidebar.tsx` exists (verified)
- FamilyClient at `src/components/features/FamilyClient.tsx` exists (verified)
- Family server actions at `src/actions/family.ts` exist (verified)

## Steps

### Step 1: Database migration — add `directory_visible` column + RLS policies

**Files:**

- `supabase/migrations/20260412000001_add_directory_visible.sql` — create

**What to do:**
Create a migration that:

1. Adds `directory_visible BOOLEAN NOT NULL DEFAULT true` to `families`
2. Creates a new SELECT policy on `families` named `"Members can read directory families"` that allows authenticated active members to read families where `directory_visible = true`:

   ```sql
   CREATE POLICY "Members can read directory families"
     ON public.families FOR SELECT
     TO authenticated
     USING (
       directory_visible = true
       AND EXISTS (
         SELECT 1 FROM public.profiles
         WHERE profiles.id = (SELECT auth.uid())
         AND profiles.is_active = true
       )
     );
   ```

   This is a new permissive policy that ORs with the existing "Select families" policy. Members can now see their own family (via existing policy) AND all directory-visible families (via this new one).

3. Creates a new SELECT policy on `family_members` named `"Members can read directory family members"` that allows active members to read family_members for directory-visible families:
   ```sql
   CREATE POLICY "Members can read directory family members"
     ON public.family_members FOR SELECT
     TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM public.families
         WHERE families.id = family_members.family_id
         AND families.directory_visible = true
       )
       AND EXISTS (
         SELECT 1 FROM public.profiles
         WHERE profiles.id = (SELECT auth.uid())
         AND profiles.is_active = true
       )
     );
   ```

**Pattern to follow:**
`supabase/migrations/20260409000000_create_families.sql` — follows the same RLS pattern with `(SELECT auth.uid())` and multi-condition USING clauses.

**Verify:**

```bash
grep -c "directory_visible" supabase/migrations/20260412000001_add_directory_visible.sql
```

**Done when:**

- Migration file exists with ALTER TABLE, two CREATE POLICY statements
- Policies use `(SELECT auth.uid())` pattern for performance
- Policies check `profiles.is_active = true`

### Step 2: Add Zod schema and server action for directory visibility toggle

**Files:**

- `src/lib/validators/member.ts` — modify
- `src/actions/family.ts` — modify

**What to do:**

In `src/lib/validators/member.ts`, add after `removeFamilyMemberSchema` (line 28):

```typescript
export const updateDirectoryVisibilitySchema = z.object({
  directory_visible: z.boolean(),
})
export type UpdateDirectoryVisibilityData = z.infer<typeof updateDirectoryVisibilitySchema>
```

In `src/actions/family.ts`, add a new server action `updateDirectoryVisibility`:

- Import `updateDirectoryVisibilitySchema` from validators
- Accept `prevState: ActionState` and `formData: FormData`
- Parse `formData.get('directory_visible') === 'true'` as boolean input to Zod
- Auth check → profile fetch → update `families.directory_visible` where `id = profile.family_id`
- RLS will enforce own-family-only (existing Update policy allows this column since it's not in the admin-controlled blocklist)
- `revalidatePath('/member')` on success

Follow the exact pattern of `updateFamilyDetails` (lines 18-72 in `src/actions/family.ts`).

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Zod schema validates a boolean `directory_visible`
- Server action follows auth → profile → update → revalidate pattern
- TypeScript compiles without errors

### Step 3: Add "Directory" nav item to MemberSidebar

**Files:**

- `src/components/layout/MemberSidebar.tsx` — modify

**What to do:**

Add a new entry to the `navigation` array (line 19-45) after the Shares entry (line 43):

```typescript
{
  label: 'Directory',
  href: '/member/directory',
  icon: <DirectoryIcon />,
},
```

Add a `DirectoryIcon` function component (address-book/people-search style icon) following the same SVG pattern as the other icons in the file (width/height 20, viewBox 0 0 24 24, stroke currentColor, strokeWidth 1.5). Use a "book with people" or "contact list" icon — a simple address book icon:

```typescript
function DirectoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M15 14a3 3 0 0 0-6 0" />
    </svg>
  )
}
```

**Verify:**

```bash
grep -n "Directory" src/components/layout/MemberSidebar.tsx
```

**Done when:**

- "Directory" appears in the sidebar nav after "Shares"
- Icon follows existing SVG conventions

### Step 4: Add privacy toggle to FamilyClient

**Files:**

- `src/app/(member)/member/family/page.tsx` — modify (fetch `directory_visible`)
- `src/components/features/FamilyClient.tsx` — modify (add toggle UI)

**What to do:**

In `src/app/(member)/member/family/page.tsx`:

- Add `directory_visible` to the family select query (line 57): change `'id, family_name, head_of_household, phone, address, created_at'` to `'id, family_name, head_of_household, phone, address, created_at, directory_visible'`

In `src/components/features/FamilyClient.tsx`:

- Add `directory_visible: boolean` to the `Family` interface (line 13-20)
- Import `updateDirectoryVisibility` from `@/actions/family`
- Add a `DirectoryVisibilityToggle` sub-component below the "Family Details" Card (after line 107) and before the "Family Members" Card:
  - A Card with a row: label "Show in Member Directory", description "Other members can see your family name and phone number", and a toggle switch
  - The toggle uses a form with hidden input `directory_visible` set to the opposite of current value
  - Uses `useActionState` pattern matching `RemoveMemberButton` (lines 190-227)
  - On submit, calls `updateDirectoryVisibility` server action
  - Toggle appears as a styled switch (a `<button>` with role="switch" and aria-checked)

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Family page fetches `directory_visible`
- Toggle renders in the family tab between Details and Members cards
- Toggle calls server action on click
- Accessible: role="switch", aria-checked, proper label

### Step 5: Create the directory page (server component)

**Files:**

- `src/app/(member)/member/directory/page.tsx` — create

**What to do:**

Create a server component page following the pattern of `src/app/(member)/member/shares/page.tsx`:

1. Export metadata: `{ title: 'Directory' }`
2. Create Supabase client, get user (same auth pattern as shares page)
3. Fetch all visible families with a single query:

   ```typescript
   const { data: families } = await supabase
     .from('families')
     .select('id, family_name, phone, address, created_at, head_of_household')
     .order('family_name', { ascending: true })
   ```

   RLS will automatically filter to only directory-visible families (plus the user's own family). This is correct — the new permissive policy handles it.

4. For each family, fetch family members:

   ```typescript
   const familyIds = (families ?? []).map((f) => f.id)
   const { data: allMembers } = await supabase
     .from('family_members')
     .select('id, family_id, full_name, relationship')
     .in('family_id', familyIds)
     .order('created_at', { ascending: true })
   ```

   RLS on family_members will filter to visible families' members.

5. Build a lookup of `head_of_household` UUID → name using `family_members` where `relationship = 'self'`. For each family, find the member whose `full_name` matches the head. Alternative: since `head_of_household` is a profile UUID and `family_members.profile_id` can match it — but `profile_id` is nullable and not always set. Simplest: for each family, find the family_member with `relationship = 'self'` as the "head" name. If no 'self' member exists, fall back to family_name.

6. Render page header + pass data to `<DirectoryClient>` component.

**Verify:**

```bash
test -f src/app/\(member\)/member/directory/page.tsx && echo "exists"
```

**Done when:**

- Page exists at the correct route
- Auth check follows existing pattern
- Data fetch uses Supabase with RLS (no manual filtering of `directory_visible`)
- Passes families + members to client component

### Step 6: Create the DirectoryClient component

**Files:**

- `src/components/features/DirectoryClient.tsx` — create

**What to do:**

Create a `'use client'` component receiving `families` and `members` arrays.

**Props:**

```typescript
interface DirectoryFamily {
  id: string
  family_name: string
  phone: string | null
  address: string | null
  created_at: string
  head_of_household: string | null
}

interface DirectoryMember {
  id: string
  family_id: string
  full_name: string
  relationship: string
}

interface DirectoryClientProps {
  families: DirectoryFamily[]
  members: DirectoryMember[]
}
```

**Features:**

1. **Search bar** — `useState` for search term, filters families by `family_name` or head member name (case-insensitive `.includes()`). Use a text input with search icon, matching the wood-800 design palette from shares page.

2. **Results count** — "Showing X of Y families"

3. **Family cards** — Map over filtered families. Each card (using `Card variant="outlined"`):
   - Left side: avatar circle with family name initials (reuse `getInitials`/`avatarColor` pattern from FamilyClient)
   - Family name (bold)
   - Head of household name (derived from members with `relationship === 'self'`)
   - Phone number (or "—" if none)
   - Address (or "—")
   - Member since year (from `created_at`, formatted with `America/New_York`)
   - Family member count badge
   - Expand/collapse chevron button

4. **Expanded view** — When a card is clicked/expanded, show family members list below the card:
   - Each member: name + relationship badge (pill)
   - Use same relationship label and badge styling as FamilyClient

5. **Empty state** — "No families found" with suggestion to adjust search. If no families at all: "The member directory is empty."

6. **Accessibility** — Search input with label, cards as interactive with `aria-expanded`, member list as `<ul>`.

**Pattern to follow:**

- `src/components/features/FamilyClient.tsx` for `getInitials`, `avatarColor`, `relationshipLabel` patterns
- `src/app/(member)/member/shares/page.tsx` for Card layout and color scheme

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Component renders search bar and family cards
- Search filters client-side by family name and head name
- Cards expand to show members
- Phone shown, email NOT shown
- Empty state renders correctly
- No TypeScript errors

## Acceptance Criteria (Full)

- [ ] Directory page loads at `/member/directory`
- [ ] Only logged-in members can access (member layout redirects unauthenticated)
- [ ] Search filters by family name and head of household name
- [ ] Families with `directory_visible = false` do not appear (RLS-enforced)
- [ ] Click expands to show family members with name + relationship badge
- [ ] Phone shown, email NOT shown
- [ ] Privacy toggle on Family tab maps to `families.directory_visible`
- [ ] Admin can see all families regardless of visibility (existing `is_admin()` policy)
- [ ] "Directory" nav item appears in sidebar after "Shares"
- [ ] Empty state shows when no families match search

## RLS Policy Plan

| Table            | Policy                                      | Rule                                                                                                          |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `families`       | `Members can read directory families`       | Active authenticated members can SELECT families where `directory_visible = true`                             |
| `family_members` | `Members can read directory family members` | Active authenticated members can SELECT family_members belonging to families where `directory_visible = true` |

## Risk Mitigation

| Risk                                   | Mitigation                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS policy interaction widening access | New policies are SELECT-only. Existing INSERT/UPDATE/DELETE policies are unchanged. The new permissive SELECT policies OR with existing ones, which is correct.            |
| Cross-family member reads              | New `family_members` SELECT policy scoped to `directory_visible = true` families only — won't expose members of hidden families                                            |
| Head of household name lookup          | Use `family_members` with `relationship = 'self'` instead of cross-family `profiles` read — avoids RLS complexity                                                          |
| Performance with many families         | Client-side search is fine for ~100 families. All data fetched in 2 parallel queries (families + members). No N+1.                                                         |
| Privacy toggle bypass                  | `directory_visible` update goes through RLS — members can only update their own family. The existing Update policy allows this column (not in admin-controlled blocklist). |

## Out of Scope

- Admin directory management (admin already sees all families via existing RLS)
- Email display in directory (explicitly excluded per issue for privacy)
- Server-side search/pagination (unnecessary for parish size)
- Profile photo/avatar in directory (no avatar upload feature exists)

## Estimated Complexity

medium — One migration, two new files (page + client component), modifications to three existing files (sidebar, family page, family actions). No new external dependencies.
