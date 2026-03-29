'use client'

import { useState, useMemo } from 'react'

import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

interface User {
  id: string
  email: string | null
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UsersTableProps {
  users: User[]
  currentUserId: string
  selectedUserId?: string | null
  onRowClick?: (user: User) => void
}

type SortKey = 'name' | 'role' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'
type FilterValue = '' | 'admin' | 'member' | 'deactivated'

const PAGE_SIZE = 20

// ─── Helpers ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-amber-50 text-amber-800',
  member: 'bg-indigo-50 text-indigo-700',
}

const STATUS_COLORS = {
  active: 'bg-emerald-50 text-emerald-700',
  deactivated: 'bg-red-50 text-red-700',
}

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'member', label: 'Members' },
  { value: 'deactivated', label: 'Deactivated' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getName(u: User): string {
  return u.full_name || u.email || 'Unknown'
}

function matchesFilter(u: User, filter: FilterValue): boolean {
  switch (filter) {
    case 'admin':
      return u.role === 'admin'
    case 'member':
      return u.role === 'member' && u.is_active
    case 'deactivated':
      return !u.is_active
    default:
      return true
  }
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

export function UsersTable({ users, currentUserId, selectedUserId, onRowClick }: UsersTableProps) {
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
    let result = users

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      )
    }

    if (filter) {
      result = result.filter((u) => matchesFilter(u, filter))
    }

    return [...result].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'name':
          cmp = getName(a).localeCompare(getName(b))
          break
        case 'role':
          cmp = a.role.localeCompare(b.role)
          break
        case 'status': {
          const sa = a.is_active ? 'active' : 'deactivated'
          const sb = b.is_active ? 'active' : 'deactivated'
          cmp = sa.localeCompare(sb)
          break
        }
        default:
          cmp = String(a[sortKey]).localeCompare(String(b[sortKey]))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [users, search, filter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
            placeholder="Search by name or email..."
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
              <th className={thClass} {...sortableThProps('name')}>
                User
                <SortIcon active={sortKey === 'name'} dir={sortDir} />
              </th>
              <th className={cn(thClass, 'hidden sm:table-cell')} {...sortableThProps('role')}>
                Role
                <SortIcon active={sortKey === 'role'} dir={sortDir} />
              </th>
              <th className={cn(thClass, 'hidden sm:table-cell')} {...sortableThProps('status')}>
                Status
                <SortIcon active={sortKey === 'status'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden sm:table-cell')}
                {...sortableThProps('created_at')}
              >
                Joined
                <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wood-800/5">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                >
                  {search || filter ? 'No users match your filters.' : 'No users yet.'}
                </td>
              </tr>
            ) : (
              paginated.map((user) => {
                const status = user.is_active ? 'active' : 'deactivated'
                const isSelected = user.id === selectedUserId

                return (
                  <tr
                    key={user.id}
                    onClick={() => onRowClick?.(user)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-burgundy-700/[0.04]',
                      !user.is_active ? 'opacity-60' : 'hover:bg-cream-100/30'
                    )}
                  >
                    {/* User (name + email) */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-body text-sm font-medium text-burgundy-700">
                          {user.full_name || '—'}
                        </span>
                        <span className="font-body text-xs text-wood-800/50">
                          {user.email || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          ROLE_COLORS[user.role] ?? 'bg-gray-50 text-gray-700'
                        )}
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_COLORS[status]
                        )}
                      >
                        {status === 'active' ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    {/* Joined date */}
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 sm:table-cell">
                      {formatDate(user.created_at)}
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
            {filtered.length} user{filtered.length !== 1 ? 's' : ''}
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
