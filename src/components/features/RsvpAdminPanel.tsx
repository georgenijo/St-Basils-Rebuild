'use client'

import { useState } from 'react'

import { formatInChurchTimeZone } from '@/lib/event-time'
import { Card } from '@/components/ui'

interface Rsvp {
  id: string
  name: string
  headcount: number
  children_count: number | null
  dietary: string | null
  bringing: string | null
  notes: string | null
  family_id: string | null
  created_at: string
  families: { family_name: string } | null
}

interface RsvpAdminPanelProps {
  eventId: string
  eventSlug: string
  eventTitle: string
  eventStartAt: string
  eventLocation: string | null
  rsvps: Rsvp[]
}

function formatRsvpTime(iso: string): string {
  return formatInChurchTimeZone(iso, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function RsvpAdminPanel({
  eventSlug,
  eventTitle,
  eventStartAt,
  eventLocation,
  rsvps,
}: RsvpAdminPanelProps) {
  const [copied, setCopied] = useState(false)

  const familiesCount = rsvps.length
  const totalHeadcount = rsvps.reduce((sum, r) => sum + r.headcount, 0)
  const totalChildren = rsvps.reduce((sum, r) => sum + (r.children_count ?? 0), 0)

  const rsvpUrl = `stbasilsboston.org/rsvp/${eventSlug}`
  const fullRsvpUrl = `https://${rsvpUrl}`

  const eventDate = formatInChurchTimeZone(eventStartAt, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const eventTime = formatInChurchTimeZone(eventStartAt, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const whatsappParts = [eventTitle, `${eventDate} at ${eventTime}`]
  if (eventLocation) whatsappParts.push(eventLocation)
  whatsappParts.push('', `RSVP here: ${fullRsvpUrl}`)
  const whatsappMessage = whatsappParts.join('\n')
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`

  async function copyLink() {
    await navigator.clipboard.writeText(fullRsvpUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportCsv() {
    const headers = ['Name', 'People', 'Children', 'Dietary', 'Bringing', 'Notes', 'Family', 'Time']
    const rows = rsvps.map((r) => [
      r.name,
      r.headcount,
      r.children_count ?? '',
      r.dietary ?? '',
      r.bringing ?? '',
      r.notes ?? '',
      r.families?.family_name ?? '',
      r.created_at,
    ])

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          })
          .join(',')
      )
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rsvps-${eventSlug}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Families" value={familiesCount} />
        <SummaryCard label="Total People" value={totalHeadcount} />
        <SummaryCard label="Children" value={totalChildren} />
      </div>

      {/* Share Link */}
      <Card variant="outlined">
        <Card.Body className="space-y-4">
          <h3 className="font-heading text-lg font-semibold text-wood-900">Share RSVP Link</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-wood-800/10 bg-cream-100/50 px-3 py-2 font-mono text-sm text-wood-800">
              {rsvpUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-wood-800/20 px-3 py-2 font-body text-sm font-medium text-wood-800 transition-colors hover:bg-cream-100"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 font-body text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Share to WhatsApp
          </a>
        </Card.Body>
      </Card>

      {/* RSVP Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-wood-900">RSVPs</h3>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rsvps.length === 0}
            className="rounded-lg border border-wood-800/20 px-3 py-1.5 font-body text-xs font-medium text-wood-800 transition-colors hover:bg-cream-100 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-wood-800/10">
          <table className="w-full">
            <thead className="border-b border-wood-800/10 bg-cream-100/50">
              <tr>
                <th className="px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60">
                  People
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60">
                  Children
                </th>
                <th className="hidden px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 md:table-cell">
                  Dietary
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60">
                  Family
                </th>
                <th className="hidden px-4 py-3 text-left font-body text-xs font-medium uppercase tracking-wider text-wood-800/60 lg:table-cell">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-800/5">
              {rsvps.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center font-body text-sm text-wood-800/60"
                  >
                    No RSVPs yet. Share the link to get started!
                  </td>
                </tr>
              ) : (
                rsvps.map((rsvp) => (
                  <tr key={rsvp.id} className="transition-colors hover:bg-cream-100/30">
                    <td className="px-4 py-3 font-body text-sm font-medium text-wood-900">
                      {rsvp.name}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-wood-800">{rsvp.headcount}</td>
                    <td className="px-4 py-3 font-body text-sm text-wood-800">
                      {rsvp.children_count ?? '—'}
                    </td>
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800 md:table-cell">
                      {rsvp.dietary ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {rsvp.families ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          {rsvp.families.family_name}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-wood-800/60">
                          Unlinked
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 font-body text-sm text-wood-800/60 lg:table-cell">
                      {formatRsvpTime(rsvp.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="outlined">
      <Card.Body className="text-center">
        <p className="font-body text-sm text-wood-800/60">{label}</p>
        <p className="mt-1 font-heading text-3xl font-semibold text-wood-900">{value}</p>
      </Card.Body>
    </Card>
  )
}
