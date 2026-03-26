'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'

import { formatInChurchTimeZone } from '@/lib/event-time'
import { cn } from '@/lib/utils'
import { DeleteEventDialog } from '@/components/features/DeleteEventDialog'

interface Event {
  id: string
  title: string
  slug: string
  start_at: string
  end_at: string | null
  category: string
  is_recurring: boolean
  created_at: string
}

interface EventsTableProps {
  events: Event[]
}

type SortKey = 'title' | 'start_at' | 'category' | 'created_at'
type SortDir = 'asc' | 'desc'

const CATEGORY_LABELS: Record<string, string> = {
  liturgical: 'Liturgical',
  community: 'Community',
  special: 'Special',
}

const CATEGORY_COLORS: Record<string, string> = {
  liturgical: 'bg-burgundy-100 text-burgundy-700',
  community: 'bg-cream-100 text-wood-800',
  special: 'bg-gold-500/10 text-wood-900',
}

function formatDate(iso: string): string {
  return formatInChurchTimeZone(iso, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
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

export function EventsTable({ events }: EventsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('start_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = events
    if (categoryFilter) {
      result = result.filter((e) => e.category === categoryFilter)
    }
    return result.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [events, sortKey, sortDir, categoryFilter])

  const thClass =
    'px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 cursor-pointer select-none hover:text-wood-900 transition-colors'

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-body text-sm text-wood-800/60">Filter:</span>
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={cn(
            'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
            !categoryFilter
              ? 'bg-burgundy-700 text-cream-50'
              : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
          )}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategoryFilter(value)}
            className={cn(
              'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
              categoryFilter === value
                ? 'bg-burgundy-700 text-cream-50'
                : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
            )}
          >
            {label}
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
              <th className={thClass} onClick={() => toggleSort('category')}>
                Category
                <SortIcon active={sortKey === 'category'} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => toggleSort('start_at')}>
                Date
                <SortIcon active={sortKey === 'start_at'} dir={sortDir} />
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
                  colSpan={5}
                  className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                >
                  {categoryFilter
                    ? 'No events in this category'
                    : 'No events yet. Create your first event!'}
                </td>
              </tr>
            ) : (
              filtered.map((event) => (
                <tr
                  key={event.id}
                  className="transition-colors hover:bg-cream-100/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/events/${event.id}/edit`}
                        className="font-body text-sm font-medium text-wood-900 hover:text-burgundy-700"
                      >
                        {event.title}
                      </Link>
                      {event.is_recurring && (
                        <span
                          title="Recurring event"
                          className="inline-flex items-center rounded-full bg-burgundy-100 px-1.5 py-0.5 text-[10px] font-medium text-burgundy-700"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-0.5"
                            aria-hidden="true"
                          >
                            <path d="M21 2v6h-6" />
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M3 22v-6h6" />
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                          </svg>
                          Recurring
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        CATEGORY_COLORS[event.category] ?? 'bg-cream-100 text-wood-800'
                      )}
                    >
                      {CATEGORY_LABELS[event.category] ?? event.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-wood-800">
                    {formatDate(event.start_at)}
                  </td>
                  <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 lg:table-cell">
                    {formatDate(event.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/events/${event.id}/edit`}
                        className="rounded-lg px-2.5 py-1.5 font-body text-xs font-medium text-burgundy-700 transition-colors hover:bg-burgundy-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(event)}
                        className="rounded-lg px-2.5 py-1.5 font-body text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteEventDialog
          eventId={deleteTarget.id}
          eventTitle={deleteTarget.title}
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
