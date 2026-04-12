# Implementation Plan — Issue #158: Member portal: Family tab

## Approach Summary
Create the Family tab as a server component page at `/member/family` that fetches family details and members from Supabase, rendering two cards (Family Details, Family Members). Interactive editing uses two `'use client'` slide-out panel components that follow the existing `UserDetailPanel` pattern with `useActionState` for form submissions. The server actions and validators already exist — this is purely a UI feature.

## Prerequisites
- Families table migration exists (`20260409000000_create_families.sql`) ✓
- Family members table migration exists (`20260409000001_create_family_members.sql`) ✓
- Family server actions exist (`src/actions/family.ts`) ✓
- Zod validators exist (`src/lib/validators/member.ts`) ✓
- Member layout with sidebar exists (`src/app/(member)/layout.tsx`) ✓
- Sidebar already links to `/member/family` ✓

## Steps

### Step 1: Create the Family page (server component)
**Files:**
- `src/app/(member)/member/family/page.tsx` — create

**What to do:**
Create a server component page that:
1. Gets auth user via `createClient()` + `getUser()`
2. Fetches profile for `family_id` (same pattern as `membership/page.tsx` lines 20-31)
3. If no `family_id`, show fallback card ("Your family hasn't been set up yet")
4. Fetches family details and family members in parallel via `Promise.all`:
   - `families`: `id, family_name, head_of_household, phone, address, created_at`
   - `family_members`: `id, full_name, relationship, profile_id` ordered by `created_at asc`
5. Renders page header: `<h1>Family</h1>` + subtitle "Your household details and members"
6. Renders `FamilyDetailsCard` — a simple card showing family_name, head of household name (looked up from family_members where profile_id matches head_of_household), phone, address, member since. Has an "Edit" button that will be handled by the client wrapper.
7. Renders `FamilyMembersCard` — a card listing all family members with avatar (initials), name, relationship badge. "You" badge on the member whose `profile_id === user.id`. "Add Member" button in header. Each non-head member has a remove button.
8. Wraps the interactive parts in a client component `FamilyClient` that manages panel state.

**Pattern to follow:**
- Page structure: `src/app/(member)/member/membership/page.tsx` (auth, data fetch, no-family fallback)
- Card layout: `src/app/(member)/member/page.tsx` (Card variant="outlined")

**Verify:**
```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "family/page" || echo "No type errors"
```

**Done when:**
- Page renders at `/member/family` with family details and members list
- TypeScript compiles without errors

### Step 2: Create the FamilyClient wrapper component
**Files:**
- `src/components/features/FamilyClient.tsx` — create

**What to do:**
Create a `'use client'` component that:
1. Accepts props: `family` (details object), `members` (array), `currentUserId` (string), `headOfHousehold` (string | null)
2. Manages state for which panel is open: `null | 'edit-family' | 'add-member'`
3. Renders the Family Details card with an "Edit" button that opens the edit panel
4. Renders the Family Members list with:
   - Avatar circle with initials (2 chars from name, e.g., "GN" for "George Nijo") — use same `getInitials` pattern as `UserDetailPanel.tsx` line 62-72
   - Name and relationship label (capitalize first letter; for 'self' show "Self")
   - "You" badge (blue, small) for the member whose `profile_id === currentUserId`
   - Remove button (red trash icon) for each member EXCEPT where `profile_id === headOfHousehold` — the head cannot be removed
   - Remove uses a form with hidden `member_id` field calling `removeFamilyMember` server action via `useActionState`
5. "Add Member" button in the members card header that opens the add-member panel
6. Renders `EditFamilyPanel` and `AddMemberPanel` conditionally based on state

**Pattern to follow:**
- Panel state management: similar to `UserDetailPanel.tsx` `activeDialog` state pattern
- Remove action: form with hidden field + `useActionState`, similar to `UserActionDialog` pattern

**Verify:**
```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "FamilyClient" || echo "No type errors"
```

**Done when:**
- Component manages panel open/close state
- Family details card renders with Edit button
- Members list renders with avatars, badges, and remove buttons
- Head of household has no remove button

### Step 3: Create the EditFamilyPanel slide-out component
**Files:**
- `src/components/features/EditFamilyPanel.tsx` — create

**What to do:**
Create a `'use client'` slide-out panel that:
1. Props: `open` (boolean), `onClose` (callback), `family` (object with family_name, phone, address)
2. Uses the same slide-out pattern as `UserDetailPanel.tsx`:
   - Fixed right panel, 520px wide (`w-[520px] max-w-[90vw]`)
   - Backdrop overlay (`fixed inset-0 z-40 bg-black/30`)
   - `translate-x-0` when open, `translate-x-full` when closed
   - Escape key close, body scroll lock
   - `role="dialog"`, `aria-modal="true"`, `aria-label="Edit family details"`
3. Contains a form with three fields:
   - Family Name (text input, required) — pre-filled with `family.family_name`
   - Phone (tel input, optional) — pre-filled with `family.phone`
   - Address (text input, optional) — pre-filled with `family.address`
4. Form uses `useActionState` with `updateFamilyDetails` action
5. Shows field-level validation errors from Zod
6. On success: closes the panel (via `useEffect` watching `state.success`)
7. Footer: Cancel button + Save Changes button (primary)
8. Close button (X) in header matching `UserDetailPanel.tsx` pattern

**Pattern to follow:**
- Panel UI: `UserDetailPanel.tsx` lines 170-215 (backdrop, panel container, header, close button)
- Form pattern: `useActionState` with `updateFamilyDetails` from `src/actions/family.ts`
- Form styling: match mockup — `form-group`, `form-label`, `form-input` styles translated to Tailwind

**Verify:**
```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "EditFamilyPanel" || echo "No type errors"
```

**Done when:**
- Panel slides in from right when opened
- Form is pre-filled with current family details
- Submitting updates family details via server action
- Panel closes on success
- Validation errors display inline

### Step 4: Create the AddMemberPanel slide-out component
**Files:**
- `src/components/features/AddMemberPanel.tsx` — create

**What to do:**
Create a `'use client'` slide-out panel that:
1. Props: `open` (boolean), `onClose` (callback)
2. Same slide-out UI pattern as `EditFamilyPanel`
3. Contains a form with two fields:
   - Full Name (text input, required)
   - Relationship (select dropdown: spouse, child, parent, sibling, other) — note: 'self' is NOT an option since the user already exists
4. Form uses `useActionState` with `addFamilyMember` action
5. Shows field-level validation errors from Zod
6. On success: closes the panel + resets form fields
7. Footer: Cancel button + Add Member button (primary)

**Pattern to follow:**
- Same panel pattern as EditFamilyPanel (Step 3)
- Mockup reference: lines 733-755 of `mockup-member-portal.html`

**Verify:**
```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "AddMemberPanel" || echo "No type errors"
```

**Done when:**
- Panel slides in with add member form
- Submitting adds a family member via server action
- Panel closes and form resets on success
- Validation errors display inline

## Acceptance Criteria (Full)
- [x] Family details card shows family_name, head of household, phone, address, member since
- [x] Family details are editable via slide-out panel (Edit button → EditFamilyPanel)
- [x] Family members list shows all household members with avatars, names, and relationship badges
- [x] "You" badge on the current user's row
- [x] Add family member works via slide-out panel (Add Member button → AddMemberPanel)
- [x] Remove family member works (remove button on non-head members)
- [x] Head of household cannot be removed (no remove button shown)
- [x] No-family fallback state when user has no family_id

## RLS Policy Plan
| Table | Policy | Rule |
|-------|--------|------|
| `families` | Select families | Members see own family (exists) |
| `families` | Update families | Members update own family, blocked from admin columns (exists) |
| `family_members` | Select family members | Members see own family's members (exists) |
| `family_members` | Insert family members | Members add to own family (exists) |
| `family_members` | Delete family members | Members remove from own family (exists) |

No new RLS policies needed — all exist from #145 and #146 migrations.

## Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| Client components bloating the page | Only FamilyClient + two panels are client components; page.tsx stays server component |
| Head removal bypass | Server action has head-of-household protection; UI also hides remove button for head |
| Missing relationship display for head | Look up head's name from family_members array where profile_id === head_of_household |
| Panel focus trap | Follow UserDetailPanel pattern (escape key, backdrop click, body scroll lock) |

## Out of Scope
- Editing individual family members (issue doesn't specify, mockup only has "Edit" but no edit-member panel defined)
- Family member profile linking (assigning auth accounts to family members)
- Responsive mobile panel behavior beyond max-width constraint

## Estimated Complexity
medium — Three new files (page + 2 panels + 1 client wrapper), no migrations, no new server actions. The slide-out panel pattern is well-established in the codebase.
