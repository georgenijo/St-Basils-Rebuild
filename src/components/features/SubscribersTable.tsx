'use client'

import { useState, useMemo } from 'react'

import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

interface Subscriber {
  id: string
  email: string
  confirmed: boolean
  confirmed_at: string | null
  unsubscribed_at: string | null
  created_at: string
}

interface SubscribersTableProps {
  subscribers: Subscriber[]
}

type SortKey = 'email' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

// ─── Helpers ─────────────────────────────────────────────────────────

function getStatus(s: Subscriber): 'active' | 'unconfirmed' | 'unsubscribed' {
  if (s.unsubscribed_at !== null) return 'unsubscribed'
  if (s.confirmed) return 'active'
  return 'unconfirmed'
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  unconfirmed: 'Unconfirmed',
  unsubscribed: 'Unsubscribed',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  unconfirmed: 'bg-amber-50 text-amber-700',
  unsubscribed: 'bg-red-50 text-red-600',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

export function SubscribersTable({ subscribers }: SubscribersTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
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
    let result = subscribers

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) => s.email.toLowerCase().includes(q))
    }

    if (statusFilter) {
      result = result.filter((s) => getStatus(s) === statusFilter)
    }

    return result.sort((a, b) => {
      let cmp: number
      if (sortKey === 'status') {
        cmp = getStatus(a).localeCompare(getStatus(b))
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [subscribers, search, statusFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function exportCsv() {
    const header = 'Email,Status,Confirmed At,Signed Up\n'
    const rows = filtered
      .map((s) => {
        const status = getStatus(s)
        const confirmedAt = s.confirmed_at ? new Date(s.confirmed_at).toISOString() : ''
        const createdAt = new Date(s.created_at).toISOString()
        return `${s.email},${status},${confirmedAt},${createdAt}`
      })
      .join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const thClass =
    'px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 cursor-pointer select-none hover:text-wood-900 transition-colors'

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-wood-800/10 bg-cream-50 py-2 pl-9 pr-3 font-body text-sm text-wood-900 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {['', 'active', 'unconfirmed', 'unsubscribed'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatusFilter(value)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
                statusFilter === value
                  ? 'bg-burgundy-700 text-cream-50'
                  : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
              )}
            >
              {value ? STATUS_LABELS[value] : 'All'}
            </button>
          ))}
        </div>

        {/* CSV export */}
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-wood-800/10 px-3 py-2 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100"
        >
          <DownloadIcon />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-wood-800/10">
        <table className="w-full">
          <thead className="border-b border-wood-800/10 bg-cream-100/50">
            <tr>
              <th className={thClass} onClick={() => toggleSort('email')}>
                Email
                <SortIcon active={sortKey === 'email'} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => toggleSort('status')}>
                Status
                <SortIcon active={sortKey === 'status'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden sm:table-cell')}
                onClick={() => toggleSort('created_at')}
              >
                Signed Up
                <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wood-800/5">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                >
                  {search || statusFilter
                    ? 'No subscribers match your filters'
                    : 'No subscribers yet.'}
                </td>
              </tr>
            ) : (
              paginated.map((subscriber) => {
                const status = getStatus(subscriber)
                return (
                  <tr key={subscriber.id} className="transition-colors hover:bg-cream-100/30">
                    <td className="px-4 py-3 font-body text-sm text-wood-900">
                      {subscriber.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_COLORS[status]
                        )}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 sm:table-cell">
                      {formatDate(subscriber.created_at)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="font-body text-sm text-wood-800/60">
            {filtered.length} subscriber{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg px-3 py-1.5 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100 disabled:opacity-40 disabled:pointer-events-none"
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
              className="rounded-lg px-3 py-1.5 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100 disabled:opacity-40 disabled:pointer-events-none"
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

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
