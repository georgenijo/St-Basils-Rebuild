'use client'

import { useState } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

interface PinnedAnnouncement {
  id: string
  title: string
  slug: string
  priority: number
}

interface PinnedAnnouncementsBannerProps {
  announcements: PinnedAnnouncement[]
  className?: string
}

export function PinnedAnnouncementsBanner({
  announcements,
  className,
}: PinnedAnnouncementsBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || announcements.length === 0) return null

  return (
    <div
      className={cn('bg-burgundy-700 text-cream-50', className)}
      role="region"
      aria-label="Pinned announcements"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Bell icon */}
        <svg
          className="hidden h-5 w-5 shrink-0 sm:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Announcement content */}
        <div className="min-w-0 flex-1">
          {announcements.length === 1 ? (
            <Link
              href={`/announcements/${announcements[0].slug}`}
              className="text-sm font-medium text-cream-50 underline-offset-4 hover:underline"
            >
              {announcements[0].title}
            </Link>
          ) : (
            <p className="text-sm font-medium">
              {announcements.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && <span className="mx-1.5 text-cream-50/50" aria-hidden="true">&middot;</span>}
                  <Link
                    href={`/announcements/${a.slug}`}
                    className="text-cream-50 underline-offset-4 hover:underline"
                  >
                    {a.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cream-50/80 transition-colors hover:bg-cream-50/10 hover:text-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50/50"
          aria-label="Dismiss announcements banner"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
