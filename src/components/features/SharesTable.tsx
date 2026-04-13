'use client'

import { useState, useMemo } from 'react'

import { cn } from '@/lib/utils'
import type { Share } from '@/app/(admin)/admin/shares/SharesPageClient'

// ─── Types ───────────────────────────────────────────────────────────

interface SharesTableProps {
  shares: Share[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
  onMarkPaid: (ids: string[]) => void
}

type SortKey = 'person_name' | 'family_name' | 'amount' | 'paid' | 'created_at'
type SortDir = 'asc' | 'desc'
type FilterValue = '' | 'paid' | 'unpaid'

const PAGE_SIZE = 20

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={cn('ml-1 inline-block transition-transform', !active && 'opacity-30')}
      aria-hidden="true"
    >
      <path
        d="M6 2L9 5H3L6 2Z"
        fill="currentColor"
        className={cn(active && dir === 'asc' ? 'opacity-100' : 'opacity-30')}
      />
      <path
        d="M6 10L3 7H9L6 10Z"
        fill="currentColor"
        className={cn(active && dir === 'desc' ? 'opacity-100' : 'opacity-30')}
      />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export function SharesTable({
  shares,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onMarkPaid,
}: SharesTableProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let result = shares

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) => s.person_name.toLowerCase().includes(q) || s.family_name.toLowerCase().includes(q)
      )
    }

    if (filter === 'paid') {
      result = result.filter((s) => s.paid)
    } else if (filter === 'unpaid') {
      result = result.filter((s) => !s.paid)
    }

    return [...result].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'person_name':
          cmp = a.person_name.localeCompare(b.person_name)
          break
        case 'family_name':
          cmp = a.family_name.localeCompare(b.family_name)
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'paid':
          cmp = Number(a.paid) - Number(b.paid)
          break
        default:
          cmp = a.created_at.localeCompare(b.created_at)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [shares, search, filter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageIds = paginated.map((s) => s.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const thClass =
    'px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 cursor-pointer select-none hover:text-wood-900 transition-colors'

  function sortableThProps(key: SortKey) {
    return {
      onClick: () => toggleSort(key),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleSort(key)
        }
      },
      tabIndex: 0 as const,
      role: 'button' as const,
      'aria-sort': (sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') as
        | 'ascending'
        | 'descending'
        | 'none',
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by name or family..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-wood-800/10 bg-cream-50 py-2 pl-9 pr-3 font-body text-sm text-wood-900 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
                filter === value
                  ? 'bg-burgundy-700 text-cream-50'
                  : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-wood-800/10">
        <table className="w-full">
          <thead className="border-b border-wood-800/10 bg-cream-100/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={() => onToggleSelectAll(pageIds)}
                  className="h-4 w-4 rounded border-wood-800/20 text-burgundy-700 focus:ring-burgundy-700/20"
                  aria-label="Select all on this page"
                />
              </th>
              <th className={thClass} {...sortableThProps('person_name')}>
                Person Name
                <SortIcon active={sortKey === 'person_name'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden sm:table-cell')}
                {...sortableThProps('family_name')}
              >
                Bought By
                <SortIcon active={sortKey === 'family_name'} dir={sortDir} />
              </th>
              <th className={cn(thClass, 'hidden sm:table-cell')} {...sortableThProps('amount')}>
                Amount
                <SortIcon active={sortKey === 'amount'} dir={sortDir} />
              </th>
              <th className={thClass} {...sortableThProps('paid')}>
                Status
                <SortIcon active={sortKey === 'paid'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden sm:table-cell')}
                {...sortableThProps('created_at')}
              >
                Date
                <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
              </th>
              <th className="w-10 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wood-800/5">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                >
                  {search || filter ? 'No shares match your filters.' : 'No shares yet.'}
                </td>
              </tr>
            ) : (
              paginated.map((share) => (
                <tr
                  key={share.id}
                  className={cn(
                    'transition-colors hover:bg-cream-100/30',
                    selectedIds.has(share.id) && 'bg-burgundy-700/[0.04]'
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(share.id)}
                      onChange={() => onToggleSelect(share.id)}
                      className="h-4 w-4 rounded border-wood-800/20 text-burgundy-700 focus:ring-burgundy-700/20"
                      aria-label={`Select ${share.person_name}`}
                    />
                  </td>

                  {/* Person Name */}
                  <td className="px-4 py-3">
                    <span className="font-body text-sm font-medium text-wood-900">
                      {share.person_name}
                    </span>
                  </td>

                  {/* Bought By (family) */}
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="font-body text-sm text-wood-800/70">{share.family_name}</span>
                  </td>

                  {/* Amount */}
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="font-body text-sm text-wood-800/70">
                      {formatCurrency(share.amount)}
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        share.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                      )}
                    >
                      {share.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 sm:table-cell">
                    {formatDate(share.created_at)}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {!share.paid && (
                      <button
                        type="button"
                        onClick={() => onMarkPaid([share.id])}
                        className="rounded-lg p-1.5 text-wood-800/40 transition-colors hover:bg-cream-100 hover:text-burgundy-700"
                        title="Mark as paid"
                        aria-label={`Mark ${share.person_name} as paid`}
                      >
                        <CheckIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="font-body text-sm text-wood-800/60">
            {filtered.length} share{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg px-3 py-1.5 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100 disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-body text-xs text-wood-800/60">
              {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg px-3 py-1.5 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute left-3 top-1/2 -translate-y-1/2 text-wood-800/40"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
