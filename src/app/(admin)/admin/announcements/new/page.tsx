import type { Metadata } from 'next'
import Link from 'next/link'

import { AnnouncementForm } from '@/components/features/AnnouncementForm'

export const metadata: Metadata = {
  title: 'New Announcement',
}

export default function NewAnnouncementPage() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/admin/announcements"
          className="inline-flex items-center gap-1 font-body text-sm text-wood-800/60 transition-colors hover:text-burgundy-700"
        >
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
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Announcements
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-wood-900">New Announcement</h1>
      </div>

      <div className="max-w-2xl">
        <AnnouncementForm />
      </div>
    </main>
  )
}
