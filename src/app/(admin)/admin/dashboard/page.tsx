import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Admin dashboard for St. Basil\'s Syriac Orthodox Church.',
}

const placeholderFeatures = [
  {
    title: 'Events',
    description: 'Create and manage church events, services, and community gatherings.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: 'Announcements',
    description: 'Post announcements and updates for the parish community.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.75.75 0 0 1-1.021-.268l-.011-.018a21.584 21.584 0 0 1-1.742-5.207m5.858-5.108a18.137 18.137 0 0 1 0 5.953m-5.858-5.108a21.75 21.75 0 0 0 5.858-5.108m0 0a3 3 0 1 1 4.243 4.243M14.198 7.747l4.243 4.243" />
      </svg>
    ),
  },
  {
    title: 'Subscribers',
    description: 'View and manage newsletter subscribers and email lists.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || null
  const email = user.email
  const role = user.user_metadata?.role || 'admin'

  return (
    <main className="px-4 py-10 font-body text-wood-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <section>
          <h1 className="font-heading text-3xl font-semibold text-wood-900 md:text-4xl">
            {displayName ? `Welcome, ${displayName}` : 'Welcome'}
          </h1>
          <p className="mt-2 text-wood-800/60">
            {email}
          </p>
          <span className="mt-3 inline-block rounded-full bg-burgundy-700/10 px-3 py-1 text-sm font-medium capitalize text-burgundy-700">
            {role}
          </span>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold text-wood-900">
            Manage
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {placeholderFeatures.map((feature) => (
              <Card key={feature.title} variant="outlined" className="transition-shadow hover:shadow-md">
                <Card.Body className="flex flex-col gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-burgundy-700/10 text-burgundy-700">
                    {feature.icon}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-wood-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-wood-800/60">
                    {feature.description}
                  </p>
                  <span className="mt-auto text-xs font-medium uppercase tracking-wide text-wood-800/40">
                    Coming soon
                  </span>
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
