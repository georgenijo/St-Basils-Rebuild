# Context Brief — Issue #163: Admin shares management view

## Issue Summary
Admins need a page at `/admin/shares` to view all remembrance shares for the current year (used during weekly services — the list of names to remember). The page needs a sortable/searchable table, year and payment status filters, ability to mark shares as paid (individual or bulk), CSV export for printing, and summary cards showing totals/revenue/paid vs unpaid. A "Shares" nav item with heart icon must be added to the admin sidebar.

## Type
feature

## Acceptance Criteria
- Shows all shares for the selected year
- Year filter works (default: current year)
- Payment status filter (All, Paid, Unpaid)
- Admin can mark shares as paid (individual or bulk)
- CSV export includes name, bought by (family), paid status
- Sidebar has Shares entry with heart icon
- Summary cards: total shares, total revenue, paid vs unpaid count
- Sortable, searchable table

## Codebase Analysis

### Files Directly Involved
| File | Why |
|------|-----|
| `src/app/(admin)/admin/shares/page.tsx` | NEW — server component that fetches shares data and renders the page |
| `src/app/(admin)/admin/shares/SharesPageClient.tsx` | NEW — client component with table state, mark-paid modal, CSV export |
| `src/components/features/SharesTable.tsx` | NEW — sortable/filterable/selectable table for shares |
| `src/components/layout/AdminSidebar.tsx` | MODIFY — add "Shares" nav item with heart icon |
| `src/actions/shares.ts` | EXISTING — `markSharesPaid()` server action already exists |
| `src/lib/validators/member.ts` | EXISTING — `markSharesPaidSchema` already defined |

### Database Impact
- Tables affected: `shares` (read), `families` (join for family_name), `payments` (created by existing `markSharesPaid` action)
- New tables needed: none
- Migration dependencies: none — `shares` table exists (migration `20260409000002`)
- RLS considerations: Admin SELECT policy exists on `shares` table (`is_admin()`). Public SELECT on `families` for the join. No new policies needed.

### Existing Patterns to Follow
| Pattern | Example File | Notes |
|---------|-------------|-------|
| Admin page with summary cards + table | `src/app/(admin)/admin/users/page.tsx` | Server fetch → summary cards → client component with table |
| Client page wrapper with state | `src/app/(admin)/admin/users/UsersPageClient.tsx` | Manages selection state, passes data to table |
| Sortable/filterable table | `src/components/features/UsersTable.tsx` | Search input, filter pills, sortable column headers, pagination |
| Admin sidebar nav item | `src/components/layout/AdminSidebar.tsx` | `NavItem[]` array with label, href, SVG icon component |
| Server action with FormData | `src/actions/shares.ts` | `markSharesPaid()` — validates with Zod, checks admin role, updates DB, creates payment records |
| Summary card component | `src/app/(admin)/admin/users/page.tsx` lines 111-140 | `SummaryCard` with label, count, accent color dot |

### Test Coverage
- Existing tests: `src/actions/shares.test.ts` covers `buyShares` and `markSharesPaid` server actions
- Test gaps: No UI tests for the shares admin page (out of scope)

### Related Issues
| Issue | Relationship |
|-------|-------------|
| #147 | Prerequisite — created the shares table (MERGED) |
| #152 | Prerequisite — created `markSharesPaid` server action (MERGED) |

## Risks
- **Large year range**: If shares exist across many years, the year selector needs a reasonable range. Mitigation: query distinct years from DB.
- **Bulk mark-paid UX**: Need a payment method selector when marking paid. The existing `markSharesPaid` action requires a method. Mitigation: show a small modal/form with method dropdown before confirming.
- **CSV export**: Client-side generation is sufficient at parish scale. No server endpoint needed.

## Key Conventions
- Server components by default — `'use client'` only for interactivity (table, filters, selection)
- Admin pages live under `src/app/(admin)/admin/`
- Design system: `font-heading` for headings, `font-body` for body text, `burgundy-700` accent, `wood-800/900` text, `cream-50/100` backgrounds
- Tables: rounded-xl border, sortable headers with chevron icons, filter pills, pagination
