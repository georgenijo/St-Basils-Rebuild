'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'

import { cn } from '@/lib/utils'
import { DeleteAnnouncementDialog } from '@/components/features/DeleteAnnouncementDialog'

interface Announcement {
  id: string
  title: string
  slug: string
  priority: number
  is_pinned: boolean
  published_at: string | null
  expires_at: string | null
  created_at: string
}

interface AnnouncementsTableProps {
  announcements: Announcement[]
}

type StatusFilter = 'all' | 'published' | 'draft' | 'expired'
type SortKey = 'title' | 'priority' | 'published_at' | 'created_at'
type SortDir = 'asc' | 'desc'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Normal',
  1: 'Low',
  5: 'Medium',
  10: 'High',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-cream-100 text-wood-800',
  1: 'bg-cream-100 text-wood-800',
  5: 'bg-gold-500/10 text-wood-900',
  10: 'bg-burgundy-100 text-burgundy-700',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatus(a: Announcement): 'published' | 'draft' | 'expired' {
  if (!a.published_at) return 'draft'
  if (a.expires_at && new Date(a.expires_at) < new Date()) return 'expired'
  return 'published'
}

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-cream-100 text-wood-800',
  expired: 'bg-red-50 text-red-600',
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

export function AnnouncementsTable({ announcements }: AnnouncementsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = announcements
    if (statusFilter !== 'all') {
      result = result.filter((a) => getStatus(a) === statusFilter)
    }
    return result.sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [announcements, sortKey, sortDir, statusFilter])

  const statusCounts = useMemo(() => {
    const counts = { all: announcements.length, published: 0, draft: 0, expired: 0 }
    for (const a of announcements) {
      counts[getStatus(a)]++
    }
    return counts
  }, [announcements])

  const thClass =
    'px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 cursor-pointer select-none hover:text-wood-900 transition-colors'

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'expired', label: 'Expired' },
  ]

  return (
    <div>
      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-body text-sm text-wood-800/60">Status:</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-burgundy-700 text-cream-50'
                : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
            )}
          >
            {f.label} ({statusCounts[f.value]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-wood-800/10">
        <table className="w-full">
          <thead className="border-b border-wood-800/10 bg-cream-100/50">
            <tr>
              <th className={thClass} onClick={() => toggleSort('title')}>
                Title
                <SortIcon active={sortKey === 'title'} dir={sortDir} />
              </th>
              <th className={cn(thClass, 'hidden sm:table-cell')}>Status</th>
              <th
                className={cn(thClass, 'hidden md:table-cell')}
                onClick={() => toggleSort('priority')}
              >
                Priority
                <SortIcon active={sortKey === 'priority'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden lg:table-cell')}
                onClick={() => toggleSort('published_at')}
              >
                Published
                <SortIcon active={sortKey === 'published_at'} dir={sortDir} />
              </th>
              <th
                className={cn(thClass, 'hidden lg:table-cell')}
                onClick={() => toggleSort('created_at')}
              >
                Created
                <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
              </th>
              <th className="px-4 py-3 text-right font-body text-xs font-medium uppercase tracking-wider text-wood-800/60">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wood-800/5">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                >
                  {statusFilter !== 'all'
                    ? `No ${statusFilter} announcements`
                    : 'No announcements yet. Create your first announcement!'}
                </td>
              </tr>
            ) : (
              filtered.map((announcement) => {
                const status = getStatus(announcement)
                return (
                  <tr key={announcement.id} className="transition-colors hover:bg-cream-100/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/announcements/${announcement.id}/edit`}
                          className="font-body text-sm font-medium text-wood-900 hover:text-burgundy-700"
                        >
                          {announcement.title}
                        </Link>
                        {announcement.is_pinned && (
                          <span
                            title="Pinned"
                            className="inline-flex items-center rounded-full bg-burgundy-100 px-1.5 py-0.5 text-[10px] font-medium text-burgundy-700"
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="mr-0.5"
                              aria-hidden="true"
                            >
                              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                            </svg>
                            Pinned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_BADGE[status]
                        )}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          PRIORITY_COLORS[announcement.priority] ?? 'bg-cream-100 text-wood-800'
                        )}
                      >
                        {PRIORITY_LABELS[announcement.priority] ?? `P${announcement.priority}`}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800 lg:table-cell">
                      {formatDate(announcement.published_at)}
                    </td>
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 lg:table-cell">
                      {formatDate(announcement.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/announcements/${announcement.id}/edit`}
                          className="rounded-lg px-2.5 py-1.5 font-body text-xs font-medium text-burgundy-700 transition-colors hover:bg-burgundy-100"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(announcement)}
                          className="rounded-lg px-2.5 py-1.5 font-body text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteAnnouncementDialog
          announcementId={deleteTarget.id}
          announcementTitle={deleteTarget.title}
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
