import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui'
import { AnnouncementsTable } from '@/components/features/AnnouncementsTable'

export const metadata: Metadata = {
  title: 'Announcements',
}

export default async function AnnouncementsPage() {
  const supabase = await createClient()

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, slug, priority, is_pinned, published_at, expires_at, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-wood-900">Announcements</h1>
          <p className="mt-1 font-body text-sm text-wood-800/60">
            Manage parish announcements, updates, and notifications.
          </p>
        </div>
        <Button href="/admin/announcements/new" size="sm">
          <span className="flex items-center gap-2">
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Announcement
          </span>
        </Button>
      </div>

      <AnnouncementsTable announcements={announcements ?? []} />
    </main>
  )
}
