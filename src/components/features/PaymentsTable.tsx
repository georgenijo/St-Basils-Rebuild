'use client'

import { useState, useMemo } from 'react'

import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

export interface Payment {
  id: string
  family_id: string
  type: 'membership' | 'share' | 'event' | 'donation'
  amount: number
  method: string | null
  note: string | null
  recorded_by: string | null
  related_event_id: string | null
  related_share_id: string | null
  created_at: string
  family_name: string | null
  event_title: string | null
  share_label: string | null
  recorded_by_name: string | null
}

interface PaymentsTableProps {
  payments: Payment[]
}

type SortKey = 'family' | 'type' | 'amount' | 'method' | 'date'
type SortDir = 'asc' | 'desc'
type FilterValue = '' | 'membership' | 'share' | 'event' | 'donation'

// ─── Constants ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  membership: 'Membership',
  share: 'Share',
  event: 'Event',
  donation: 'Donation',
}

const TYPE_COLORS: Record<string, string> = {
  membership: 'bg-indigo-50 text-indigo-700',
  share: 'bg-amber-50 text-amber-800',
  event: 'bg-emerald-50 text-emerald-700',
  donation: 'bg-violet-50 text-violet-700',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  zelle: 'Zelle',
  online: 'Online',
}

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'membership', label: 'Membership' },
  { value: 'share', label: 'Share' },
  { value: 'event', label: 'Event' },
  { value: 'donation', label: 'Donation' },
]

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Component ──────────────────────────────────────────────────────

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<FilterValue>('')
  const [search, setSearch] = useState('')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    let result = payments

    if (filter) {
      result = result.filter((p) => p.type === filter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.family_name?.toLowerCase().includes(q) ||
          p.note?.toLowerCase().includes(q) ||
          p.event_title?.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'family':
          cmp = (a.family_name ?? '').localeCompare(b.family_name ?? '')
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'method':
          cmp = (a.method ?? '').localeCompare(b.method ?? '')
          break
        case 'date':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [payments, filter, search, sortKey, sortDir])

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-wood-800/15 bg-white py-2 pl-9 pr-4 font-body text-sm text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20 sm:w-64"
          />
        </div>

        {/* Filter */}
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-body text-sm font-medium transition-colors',
                filter === opt.value
                  ? 'bg-burgundy-700/10 text-burgundy-700'
                  : 'text-wood-800/60 hover:bg-cream-100 hover:text-wood-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-wood-800/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-wood-800/10 bg-cream-50/50">
                <SortHeader
                  label="Family"
                  sortKey="family"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Type"
                  sortKey="type"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Amount"
                  sortKey="amount"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortHeader
                  label="Method"
                  sortKey="method"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Detail
                </th>
                <th className="hidden px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50 lg:table-cell">
                  Recorded By
                </th>
                <SortHeader
                  label="Date"
                  sortKey="date"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center font-body text-sm text-wood-800/50"
                  >
                    {payments.length === 0
                      ? 'No payments recorded yet.'
                      : 'No payments match the current filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-wood-800/[0.06] last:border-b-0 transition-colors hover:bg-cream-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-body text-sm font-medium text-wood-900">
                      {payment.family_name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          TYPE_COLORS[payment.type] ?? 'bg-gray-50 text-gray-700'
                        )}
                      >
                        {TYPE_LABELS[payment.type] ?? payment.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-body text-sm font-medium text-wood-900 tabular-nums">
                      {usd.format(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-wood-800/80">
                      {METHOD_LABELS[payment.method ?? ''] ?? payment.method ?? '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-body text-sm text-wood-800/60">
                      {payment.type === 'event' && payment.event_title
                        ? payment.event_title
                        : payment.type === 'share' && payment.share_label
                          ? payment.share_label
                          : payment.note || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-body text-sm text-wood-800/60 lg:table-cell">
                      {payment.recorded_by_name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-wood-800/60">
                      {formatDate(payment.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-3 font-body text-sm text-wood-800/50">
          Showing {filtered.length} of {payments.length} payments
        </p>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = current === sortKey

  return (
    <th
      className={cn(
        'px-4 py-3 font-body text-xs font-semibold uppercase tracking-wider',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          isActive ? 'text-wood-900' : 'text-wood-800/50 hover:text-wood-800'
        )}
      >
        {label}
        {isActive && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={dir === 'desc' ? 'rotate-180' : ''}
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        )}
      </button>
    </th>
  )
}

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
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
