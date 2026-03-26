import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Dashboard',
}

// ─── Placeholder card data ──────────────────────────────────────────

const placeholderCards = [
  {
    title: 'Events',
    description: 'Create and manage parish events, liturgical services, and community gatherings.',
    icon: <CalendarIcon />,
    href: '/admin/events',
  },
  {
    title: 'Announcements',
    description: 'Publish announcements and updates for the congregation.',
    icon: <MegaphoneIcon />,
    href: '/admin/announcements',
  },
  {
    title: 'Subscribers',
    description: 'View and manage newsletter subscribers and mailing lists.',
    icon: <UsersIcon />,
    href: '/admin/subscribers',
  },
]

// ─── Page ───────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .single()

  const displayName = profile?.full_name || user!.email

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">
          Welcome, {displayName}
        </h1>
        <p className="mt-2 text-sm text-wood-800/60">
          Signed in as{' '}
          <span className="font-medium text-wood-800">{user!.email}</span>
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-burgundy-100 px-3 py-1 text-xs font-medium text-burgundy-700">
          <span className="h-1.5 w-1.5 rounded-full bg-burgundy-700" aria-hidden="true" />
          {profile?.role === 'admin' ? 'Administrator' : 'Member'}
        </span>
      </div>

      {/* Placeholder feature cards */}
      <section aria-label="Admin features">
        <h2 className="font-heading text-xl font-semibold text-wood-900">
          Manage
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {placeholderCards.map((card) => (
            <Link key={card.title} href={card.href}>
              <Card variant="outlined" className="p-6 transition-shadow hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-100 text-burgundy-700">
                  {card.icon}
                </div>
                <h3 className="font-heading text-lg font-semibold text-wood-900">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-wood-800/60">
                  {card.description}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

// ─── Icons ──────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
