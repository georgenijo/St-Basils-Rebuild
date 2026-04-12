# Implementation Plan — Issue #159: Member portal: Payments tab

## Approach Summary

Create the Payments tab as a server component page at `/member/payments` with three summary cards and a payment history table (excluding membership payments). A client-side `RecordDonationPanel` slide-out handles donation recording using the existing `recordDonation` server action. The approach follows the established patterns from the Overview page (`member/page.tsx`) and Membership page (`member/membership/page.tsx`), with the slide-out panel following the `UserDetailPanel` pattern.

## Prerequisites

- Member layout exists at `src/app/(member)/layout.tsx` (merged via #155)
- `payments` table migration exists (`20260409000003_create_payments.sql`, #148)
- `event_charges` table migration exists (`20260409000004_create_event_charges.sql`, #149)
- `recordDonation` server action exists at `src/actions/donations.ts` (#153)
- `recordDonationSchema` Zod schema exists at `src/lib/validators/member.ts`
- Sidebar already has "Payments" nav item pointing to `/member/payments`

## Steps

### Step 1: Create the RecordDonationPanel client component

**Files:**

- `src/components/member/RecordDonationPanel.tsx` — create

**What to do:**
Create a `'use client'` slide-out panel component that:

1. Props: `isOpen: boolean`, `onClose: () => void`
2. Uses `useActionState` from React (imported from `'react'`) with the `recordDonation` action from `@/actions/donations`
3. Renders a fixed right-side slide-out panel (width 480px, max-width 90vw) following the `UserDetailPanel` pattern:
   - Backdrop: `fixed inset-0 z-40 bg-black/30` with click-to-close
   - Panel: `fixed inset-y-0 right-0 z-50 w-[480px] max-w-[90vw] bg-cream-50` with slide transition
   - Header: "Record a Donation" title + close button (X icon)
   - Body: form with fields:
     - Donation type `<select>` with options matching `recordDonationSchema` enum: General (`general`), Car Blessing (`car_blessing`), Christmas Caroling (`christmas_caroling`), Event Specific (`event_specific`), Other (`other`)
     - Amount `<input type="number">` with $ prefix styling
     - Note `<input type="text">` marked optional
   - Footer: Cancel button (calls `onClose`) + Submit button
4. On successful submission (`state.success === true`), close the panel via `onClose()`
5. Display validation errors from `state.errors` under each field
6. Escape key closes the panel (when no dialog is active)
7. Lock body scroll when open
8. Use `cn()` from `@/lib/utils` for conditional classes
9. Style form elements consistently with the mockup: `rounded-lg border border-wood-800/15 bg-white px-3 py-2.5 text-sm` for inputs/selects

**Pattern to follow:**

- Panel structure: `src/components/features/UserDetailPanel.tsx` (backdrop, panel, escape key, body scroll lock)
- Form submission: `src/components/features/ContactForm.tsx` or any form using `useActionState`

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "RecordDonationPanel" || echo "No type errors"
```

**Done when:**

- Component file exists and compiles without type errors
- Has proper `'use client'` directive
- Handles open/close state, form submission, validation errors, and success

### Step 2: Create the Payments page server component

**Files:**

- `src/app/(member)/member/payments/page.tsx` — create

**What to do:**
Create a server component page that:

1. Export `metadata: Metadata` with `title: 'Payments'`
2. Auth check: get user via `createClient()` → `supabase.auth.getUser()`, return null if no user
3. Profile lookup: get `family_id` from `profiles` table. If no family_id, show a message (same pattern as membership page)
4. Fetch data in parallel with `Promise.all`:
   - **Non-membership payments**: from `payments` table, `family_id = familyId`, `type != 'membership'`, ordered by `created_at DESC`
     - Use `.neq('type', 'membership')` filter
     - Select: `id, type, amount, method, note, created_at, related_event_id`
   - **Unpaid event charges**: from `event_charges` table, `family_id = familyId`, `paid = false`
     - Select: `id, event_id, amount`
   - **Events for titles**: will be fetched after, based on event IDs from both payments and charges
5. After the initial fetch, collect all `event_id` values from both event-type payments (`related_event_id`) and unpaid charges, then fetch event titles in a single query from the `events` table
6. Compute summary card values:
   - **Paid This Year**: sum of `amount` from non-membership payments where `created_at` is in the current year. Use `const currentYear = new Date().getFullYear()` and filter in JS
   - **Outstanding**: sum of `amount` from unpaid event charges
   - **Donations**: sum of `amount` from payments where `type = 'donation'` in the current year
7. Render three summary cards using `Card variant="outlined"` with dot colors:
   - Paid This Year: emerald dot, formatted as USD
   - Outstanding: red dot, formatted as USD (red text if > 0)
   - Donations: blue dot, formatted as USD
8. Render "Payment History" header with "Record Donation" button on the right
   - Button uses the existing `Button` component with `variant="primary"` and `size="sm"`
   - Button triggers the `RecordDonationPanel` — but since this is a server component, wrap the interactive part in a small client wrapper
9. Render a payment history table inside a `Card variant="outlined"`:
   - `<thead>` with columns: Date, Type, Description, Method, Amount, Status
   - `<tbody>` rows for each payment
   - Date: formatted with `Intl.DateTimeFormat` using `America/New_York`, `month: 'short', day: 'numeric', year: 'numeric'`
   - Type: colored badge — Event (amber: `bg-amber-100 text-amber-800`), Donation (blue: `bg-blue-100 text-blue-800`), Shares (purple: `bg-purple-100 text-purple-800`)
   - Description: for `event` type → event title from lookup or "Event payment"; for `donation` → note field or "Donation"; for `share` → "Shares purchased"
   - Method: `capitalize` text or "—" if null
   - Amount: `$X.XX` format with `Intl.NumberFormat`
   - Status: all payments in the `payments` table are "Paid" (green badge); unpaid event charges show as "Due" (amber badge)
10. Append unpaid event charges to the display list as "Due" rows, merged with paid payments and sorted by date descending
11. Empty state: "No payment history yet." centered text when no rows

**Important detail on merging payments + charges:**
Create a unified display array that combines:

- Payments from `payments` table (status = 'Paid')
- Unpaid event charges from `event_charges` table (status = 'Due', type = 'event')
  Sort the combined array by date descending.

**Since the page needs a client interactive element (the Record Donation button + panel), create a small client wrapper component `PaymentsClient` at the bottom of the file or inline it.**

Actually, the cleaner approach: make the page a server component that passes data to a client component for the interactive parts. But since the table itself is static, the better approach is:

- The page is a server component
- Import and render `<PaymentsPageClient>` which is a thin `'use client'` wrapper at `src/components/member/PaymentsPageClient.tsx` that handles the "Record Donation" button state and renders the `RecordDonationPanel`
- Pass all server-fetched data as props to this client component

**Pattern to follow:**

- Data fetching: `src/app/(member)/member/page.tsx` (Promise.all pattern, profile/family lookup)
- Table rendering: `src/app/(member)/member/membership/page.tsx` (thead/tbody, date formatting, badges)
- Mockup: `mockup-member-portal.html` lines 458-531

**Verify:**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "payments" || echo "No type errors"
```

**Done when:**

- Page renders at `/member/payments` without errors
- Three summary cards display with correct computed values
- Payment history table shows non-membership payments + unpaid charges
- "Record Donation" button is visible

### Step 3: Create the PaymentsPageClient wrapper component

**Files:**

- `src/components/member/PaymentsPageClient.tsx` — create

**What to do:**
Create a thin `'use client'` component that:

1. Props: `children: React.ReactNode` (the table/cards from server component — actually, simpler approach)
2. Actually, re-think: the simplest pattern is to have the page server component render all the static content, and only have a small client island for the button + panel. Create `RecordDonationButton.tsx` instead that just manages the open/close state of the panel.

**Revised approach — merge this into the RecordDonationPanel:**
Instead of a separate wrapper, modify the `RecordDonationPanel` from Step 1 to also export a `RecordDonationButton` component that manages its own open state internally. This is simpler and follows the principle of colocation.

Actually, the cleanest approach: the `RecordDonationPanel` component manages its own trigger button. Export a single component that renders:

- A trigger button (visible always)
- The slide-out panel (visible when open)

This way the server page just does `<RecordDonationPanel />` with no prop drilling.

**Update to Step 1:** Revise `RecordDonationPanel` to be self-contained:

- Internal `useState` for `isOpen`
- Renders its own trigger button + the panel
- No props needed except perhaps a className for the button

**Verify:**

```bash
npx tsc --noEmit --pretty
```

**Done when:**

- `RecordDonationPanel` is self-contained with its own trigger button
- Can be dropped into the server page with a single `<RecordDonationPanel />`

### Step 4: Final lint and type check

**Files:**

- All files created in Steps 1-2

**What to do:**

1. Run `npm run lint` and fix any lint errors in files we created
2. Run `npx tsc --noEmit` and fix any type errors in files we created

**Verify:**

```bash
npm run lint && npx tsc --noEmit
```

**Done when:**

- Zero lint errors from our files
- Zero type errors from our files

## Acceptance Criteria (Full)

- [ ] Page exists at `/member/payments` and renders for authenticated members with a family
- [ ] Table excludes membership payments (filters `type != 'membership'`)
- [ ] Summary cards show: Paid This Year, Outstanding, Donations — all computed accurately
- [ ] Unpaid event charges appear in the table with "Due" status badge
- [ ] Record Donation button opens slide-out panel
- [ ] Panel has donation type select, amount input, optional note
- [ ] Panel calls `recordDonation` server action and handles success/errors
- [ ] New donations appear in the table after submission (via revalidation)
- [ ] Empty state message when no payments exist
- [ ] Null method values display as "—"

## RLS Policy Plan

| Table           | Policy                            | Rule                                              |
| --------------- | --------------------------------- | ------------------------------------------------- |
| `payments`      | `Select payments` (existing)      | Members see own family's payments, admins see all |
| `event_charges` | `Select event charges` (existing) | Members see own family's charges, admins see all  |
| `events`        | Public read (existing)            | All authenticated/public can read event titles    |

No new RLS policies needed — all existing policies are sufficient.

## Risk Mitigation

| Risk                             | Mitigation                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Null `method` column on payments | Display "—" when method is null                                                                  |
| Outstanding computed wrong       | Use `event_charges` table with `paid = false`, not payments table                                |
| revalidatePath scope             | `recordDonation` calls `revalidatePath('/member')` which covers `/member/payments`               |
| Large payment history            | No LIMIT on initial query since member portals have bounded data per family; add if needed later |

## Out of Scope

- Pagination for payment history (low data volume per family)
- Editing or deleting payments (admin-only feature, different issue)
- Payment method recording on donations (the `recordDonation` action doesn't set method — by design, members record the donation, admins record the payment method)

## Estimated Complexity

medium — One new page with server-side data fetching, one client component for the slide-out panel form. Follows well-established patterns from sibling pages.
