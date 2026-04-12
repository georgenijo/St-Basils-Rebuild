# Implementation Plan — Issue #163: Admin shares management view

## Approach Summary
Create an admin shares management page following the established Users page pattern: a server component fetches all shares (joined with families for the family name), computes summary stats, and passes data to a client component. The client component manages year/status filters, search, sorting, row selection for bulk actions, a mark-paid modal, and CSV export. The existing `markSharesPaid` server action handles the DB mutation and payment record creation.

This approach is chosen because: (1) the Users page provides a well-tested pattern for admin list views, (2) client-side filtering is appropriate at parish scale (hundreds, not thousands of shares), and (3) the `markSharesPaid` action already exists with proper validation, admin auth checks, and payment record creation.

## Prerequisites
- Shares table exists (migration `20260409000002`) — DONE
- `markSharesPaid` server action exists (`src/actions/shares.ts`) — DONE
- `markSharesPaidSchema` validator exists (`src/lib/validators/member.ts`) — DONE
- Admin layout with sidebar exists (`src/app/(admin)/layout.tsx`) — DONE

## Steps

### Step 1: Add "Shares" nav item to admin sidebar
**Files:**
- `src/components/layout/AdminSidebar.tsx` — modify

**What to do:**
Add a new `NavItem` to the `navigation` array, positioned after "Users" and before "Settings":
```typescript
{
  label: 'Shares',
  href: '/admin/shares',
  icon: <HeartIcon />,
}
```

Add a `HeartIcon` SVG component in the Icons section, following the same pattern as existing icons (20x20, stroke-based, 1.5 strokeWidth). Use a heart SVG path.

**Pattern to follow:**
Existing nav items in `AdminSidebar.tsx` (lines 19-50) and icon components (lines 192+).

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- "Shares" appears in the sidebar between "Users" and "Settings"
- Heart icon renders correctly
- Active state highlights when on `/admin/shares`

### Step 2: Create the shares admin page (server component)
**Files:**
- `src/app/(admin)/admin/shares/page.tsx` — create

**What to do:**
Create a server component that:

1. Fetches all shares joined with families:
   ```typescript
   const { data: shares } = await supabase
     .from('shares')
     .select('id, person_name, year, amount, paid, created_at, family_id, families(family_name)')
     .order('created_at', { ascending: false })
   ```

2. Queries distinct years for the year selector:
   ```typescript
   const { data: yearRows } = await supabase
     .from('shares')
     .select('year')
     .order('year', { ascending: false })
   // Deduplicate in JS
   ```

3. Computes summary stats for the current year (done in the server component for SSR):
   - Total shares count
   - Total revenue (count × $50)
   - Paid count
   - Unpaid count

4. Renders:
   - Page header: "Shares" title + "Manage remembrance shares and payment status." description
   - Summary cards (4 cards): Total Shares, Total Revenue (formatted as currency), Paid, Unpaid
   - `SharesPageClient` component receiving shares data and available years

**Pattern to follow:**
`src/app/(admin)/admin/users/page.tsx` — same structure: metadata export, server fetch, error handling, summary cards, client component.

**SummaryCard** — define locally in the file (same pattern as Users page). For revenue, display as `$X,XXX` formatted string instead of a plain count.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Page renders at `/admin/shares`
- Summary cards show correct counts
- Data is fetched server-side and passed to client

### Step 3: Create the shares page client component
**Files:**
- `src/app/(admin)/admin/shares/SharesPageClient.tsx` — create

**What to do:**
Create a `'use client'` component that manages:

1. **Year filter state** — defaults to current year, dropdown to switch years
2. **Selected share IDs** — `Set<string>` for bulk mark-paid
3. **Mark-paid modal** — when admin clicks "Mark as Paid" (for selected shares), show a small modal with:
   - Payment method dropdown (cash, check, zelle, online)
   - Optional note field
   - Confirm/Cancel buttons
   - Uses `markSharesPaid` server action via `useActionState`
4. **CSV export** — button that generates and downloads a CSV file with columns: Person Name, Bought By (family name), Amount, Paid Status, Date
5. Passes filtered data + selection state to `SharesTable`

Props:
```typescript
interface SharesPageClientProps {
  shares: Share[]
  years: number[]
}
```

Where `Share` type:
```typescript
interface Share {
  id: string
  person_name: string
  year: number
  amount: number
  paid: boolean
  created_at: string
  family_id: string
  family_name: string
}
```

The year filter is client-side (all data is already fetched). When year changes, filter the shares array.

**CSV export implementation:**
```typescript
function exportCsv(shares: Share[]) {
  const header = 'Person Name,Bought By,Amount,Paid,Date'
  const rows = shares.map(s =>
    `"${s.person_name}","${s.family_name}",${s.amount},${s.paid ? 'Yes' : 'No'},${formatDate(s.created_at)}`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shares-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Mark-paid modal:**
- Only visible when `selectedIds.size > 0` and admin clicks "Mark as Paid"
- Form submits to `markSharesPaid` server action
- On success, clear selection and close modal
- Hidden inputs: `share_ids` (JSON array), `method`, `note`

**Pattern to follow:**
- `src/app/(admin)/admin/users/UsersPageClient.tsx` — client wrapper pattern
- The `markSharesPaid` action signature: `(prevState: ActionState, formData: FormData) => Promise<ActionState>`

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Year filter switches displayed shares
- CSV export downloads correct file
- Mark-paid modal appears with method selector
- Selection state tracks checked rows

### Step 4: Create the shares table component
**Files:**
- `src/components/features/SharesTable.tsx` — create

**What to do:**
Create a `'use client'` table component with:

1. **Search** — filter by person_name or family_name
2. **Payment status filter pills** — All, Paid, Unpaid
3. **Sortable columns**: Person Name, Bought By, Amount, Paid Status, Date
4. **Checkbox column** — for bulk selection (header checkbox for select-all on current page)
5. **Individual "Mark Paid" button** — on each unpaid row (icon button)
6. **Pagination** — 20 items per page

Props:
```typescript
interface SharesTableProps {
  shares: Share[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
  onMarkPaid: (ids: string[]) => void
}
```

Column layout:
| Checkbox | Person Name | Bought By | Amount | Status | Date |
|----------|-------------|-----------|--------|--------|------|

Status badges:
- Paid: `bg-emerald-50 text-emerald-700` — "Paid"
- Unpaid: `bg-amber-50 text-amber-800` — "Unpaid"

**Pattern to follow:**
`src/components/features/UsersTable.tsx` — same structure: search input with SearchIcon, filter pills, sortable column headers with SortIcon, pagination controls, empty state.

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Done when:**
- Table renders with all columns
- Search filters by name/family
- Status filter pills work
- Columns are sortable
- Checkboxes work for selection
- Pagination works

### Step 5: Final lint and type check
**Files:**
- All new and modified files

**What to do:**
Run full lint and typecheck. Fix any issues.

```bash
npm run lint && npx tsc --noEmit
```

**Done when:**
- Zero lint errors from changed files
- Zero TypeScript errors

## Acceptance Criteria (Full)
- [ ] Shows all shares for the selected year
- [ ] Year filter works (default: current year)
- [ ] Payment status filter (All, Paid, Unpaid)
- [ ] Admin can mark shares as paid (individual or bulk)
- [ ] CSV export includes name, bought by, paid status
- [ ] Sidebar has Shares entry with heart icon
- [ ] Summary cards: total shares, total revenue, paid vs unpaid count
- [ ] Sortable, searchable table

## RLS Policy Plan
No new RLS policies needed:
| Table | Policy | Rule |
|-------|--------|------|
| `shares` | Admin SELECT | `is_admin()` — already exists |
| `shares` | Admin UPDATE | `is_admin()` — already exists (used by `markSharesPaid`) |
| `families` | Public SELECT | Already exists — needed for join |

## Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| Large year range in selector | Query distinct years from DB, not hardcoded range |
| Bulk mark-paid needs payment method | Modal with method dropdown before confirming |
| CSV special characters | Wrap values in quotes in CSV output |
| Client-side data volume | Parish scale (~100-500 shares/year) is fine for full client-side filtering |

## Out of Scope
- Creating/deleting shares from admin page (members buy shares from member portal)
- Payment history view (separate feature)
- Print-optimized layout (CSV export covers the printing use case)
- E2E tests

## Estimated Complexity
medium — 3 new files (page, client, table), 1 modification (sidebar). All following well-established patterns. The `markSharesPaid` action already handles the complex DB logic.
