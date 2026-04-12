# Implementation Plan — Issue #162: Admin: record payments received

## Approach Summary

Build a `/admin/payments` page with a payments table and a slide-out panel for recording new payments. The page follows the established server-page + client-wrapper pattern (like Users). The server component fetches payments with joins, families, events, and unpaid shares. The client component manages table state and the record-payment panel open/close state. The panel contains a form that calls the existing `recordPaymentReceived` server action.

This approach is chosen because: (1) all server action logic already exists from #154, (2) the UI patterns (table, slide-out, form) are well-established in the codebase, and (3) the page is admin-only with parish-scale data volumes.

## Prerequisites

- Issue #148 merged (payments table schema) — DONE
- Issue #154 merged (server actions) — DONE
- `recordPaymentReceived` server action exists in `src/actions/admin-payments.ts` — DONE
- `recordPaymentSchema` Zod validator exists in `src/lib/validators/member.ts` — DONE

## Steps

### Step 1: Add "Payments" to AdminSidebar

**Files:**

- `src/components/layout/AdminSidebar.tsx` — modify

**What to do:**
Add a "Payments" nav item to the `navigation` array, positioned after "Users" and before "Settings". Include a dollar/wallet-style SVG icon matching the existing icon style (20x20, stroke-based, 1.5 stroke width).

```typescript
{
  label: 'Payments',
  href: '/admin/payments',
  icon: <PaymentsIcon />,
},
```

Add a `PaymentsIcon` function component in the Icons section at the bottom of the file.

**Pattern to follow:**
Existing nav items and icon components in the same file.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- "Payments" appears in sidebar navigation between "Users" and "Settings"
- TypeScript compiles without errors

### Step 2: Create the payments server page

**Files:**

- `src/app/(admin)/admin/payments/page.tsx` — create

**What to do:**
Create a server component that:

1. Fetches all payments with joins: `families(family_name)`, `events(title)`, `shares(person_name, year)`, and the `recorded_by` profile via a separate query on `profiles(id, full_name, email)`
2. Fetches all families (id, family_name) for the family selector in the form
3. Fetches all events (id, title) for the event selector
4. Fetches unpaid shares grouped by family for the share selector
5. Computes summary card counts: total payments, and counts by type
6. Renders summary cards, then passes data to `PaymentsPageClient`

Query for payments:

```typescript
const { data: payments } = await supabase
  .from('payments')
  .select(
    `
    id, family_id, type, amount, method, note,
    recorded_by, related_event_id, related_share_id,
    created_at,
    families(family_name),
    events(title),
    shares(person_name, year)
  `
  )
  .order('created_at', { ascending: false })
```

For `recorded_by` display names, fetch profiles separately and build a map, since `recorded_by` is a nullable FK and Supabase can't join on nullable FKs cleanly.

Summary cards: Total, Membership, Share, Event, Donation (matching the Users page SummaryCard pattern).

**Pattern to follow:**
`src/app/(admin)/admin/users/page.tsx` — server component with data fetching + summary cards + client wrapper.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Page renders at `/admin/payments` with summary cards
- Data is fetched and passed to client component
- TypeScript compiles without errors

### Step 3: Create the PaymentsTable component

**Files:**

- `src/components/features/PaymentsTable.tsx` — create

**What to do:**
Create a client component table displaying payments with:

- Columns: Family, Type, Amount, Method, Note, Recorded By, Date
- Sort by column (default: date descending)
- Filter by type (All, Membership, Share, Event, Donation)
- Type badges with colors (membership=indigo, share=amber, event=emerald, donation=violet)
- Method badges (cash, check, zelle, online)
- Amount formatted as USD
- Date formatted as short date
- Empty state message when no payments match filter

Props:

```typescript
interface PaymentsTableProps {
  payments: Payment[]
  onRowClick?: (payment: Payment) => void
}
```

Where `Payment` is a type defined at the top of the file matching the joined query shape.

**Pattern to follow:**
`src/components/features/UsersTable.tsx` — sorting, filtering, badge colors, date formatting.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Table renders payments with all columns
- Sorting and filtering work
- TypeScript compiles without errors

### Step 4: Create the RecordPaymentPanel slide-out

**Files:**

- `src/components/features/RecordPaymentPanel.tsx` — create

**What to do:**
Create a slide-out panel (following `UserDetailPanel` pattern) containing a form for recording payments. The form uses `useActionState` with the existing `recordPaymentReceived` server action.

Panel structure:

1. Backdrop + slide-out panel (520px, right-aligned)
2. Header with "Record Payment" title and close button
3. Form body:
   - Family select dropdown (required)
   - Payment type radio buttons: Membership, Share, Event, Donation (required)
   - Conditional fields based on type:
     - Event → event select dropdown (required)
     - Share → share select dropdown showing unpaid shares for selected family (required)
   - Amount input (required, number, step 0.01)
   - Method select: Cash, Check, Zelle, Online (required)
   - Note textarea (optional)
4. Footer with Cancel and Submit buttons
5. Success state: show success message, then close panel after brief delay

Form fields use `name` attributes matching `recordPaymentSchema` field names:

- `family_id`, `type`, `amount`, `method`, `note`, `related_event_id`, `related_share_id`

The form submits to `recordPaymentReceived` via `useActionState`. On success, close the panel and call `router.refresh()` to reload server data.

Escape key closes the panel (only when no unsaved changes, or always — keep it simple).

Props:

```typescript
interface RecordPaymentPanelProps {
  open: boolean
  onClose: () => void
  families: { id: string; family_name: string }[]
  events: { id: string; title: string }[]
  unpaidShares: { id: string; family_id: string; person_name: string; year: number }[]
}
```

**Pattern to follow:**

- Panel: `src/components/features/UserDetailPanel.tsx` — backdrop, positioning, transitions, escape key, scroll lock
- Form: `useActionState` pattern from `UserDetailPanel.tsx` (ChangeRoleDialog)
- Input styling: `w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20`
- Error display: per-field errors from `state.errors`, general error from `state.message`

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Panel opens/closes with smooth transition
- Form displays all required fields
- Conditional fields show/hide based on payment type
- Share dropdown filters by selected family
- Form submits to server action and handles success/error
- TypeScript compiles without errors

### Step 5: Create the PaymentsPageClient wrapper

**Files:**

- `src/app/(admin)/admin/payments/PaymentsPageClient.tsx` — create

**What to do:**
Create a client component that manages:

- Record payment panel open/close state
- Passes data through to PaymentsTable and RecordPaymentPanel

Props:

```typescript
interface PaymentsPageClientProps {
  payments: Payment[]
  families: { id: string; family_name: string }[]
  events: { id: string; title: string }[]
  unpaidShares: { id: string; family_id: string; person_name: string; year: number }[]
}
```

Renders:

1. "Record Payment" button (top-right, using Button component)
2. PaymentsTable
3. RecordPaymentPanel (controlled by open state)

**Pattern to follow:**
`src/app/(admin)/admin/users/UsersPageClient.tsx` — client wrapper managing panel state.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**

- Client component renders table and panel
- "Record Payment" button opens the panel
- TypeScript compiles without errors

### Step 6: Final lint and type check

**Files:**

- All modified/created files

**What to do:**
Run full lint and typecheck. Fix any issues.

```bash
npm run lint && npx tsc --noEmit
```

**Done when:**

- Zero lint errors
- Zero TypeScript errors

## Acceptance Criteria (Full)

- [ ] Admin can navigate to `/admin/payments` from sidebar
- [ ] Payments page shows summary cards (total, by type)
- [ ] Payments table lists all payments with family name, type, amount, method, date
- [ ] Table supports sorting and filtering by type
- [ ] "Record Payment" button opens slide-out panel
- [ ] Form has family selector, type selector, conditional event/share fields, amount, method, note
- [ ] Submitting creates payment and updates related records (via existing server action)
- [ ] Success closes panel and refreshes data
- [ ] Only admins can access (handled by admin layout)

## RLS Policy Plan

No new RLS policies needed. All existing policies handle this:
| Table | Policy | Rule |
|-------|--------|------|
| `payments` | Admin SELECT | `role = 'admin'` — already exists |
| `families` | Admin SELECT | Already exists |
| `events` | Public SELECT | Already exists |
| `shares` | Admin SELECT | Already exists |

## Risk Mitigation

| Risk                        | Mitigation                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| Family selector at scale    | Parish has ~50-200 families. Simple `<select>` is sufficient.                 |
| Conditional form fields     | Clear state reset when type changes — clear related_event_id/related_share_id |
| Share filtering by family   | Filter client-side from pre-fetched unpaid shares list                        |
| Data freshness after submit | `revalidatePath('/admin')` in server action + `router.refresh()` in client    |

## Out of Scope

- Payment editing/deletion (future issue)
- Payment detail slide-out (clicking a row — future enhancement)
- Pagination (parish scale doesn't need it)
- CSV export
- E2E tests for the UI

## Estimated Complexity

medium — 4 new files + 1 modification, all following established patterns. No new server actions or database changes needed.
