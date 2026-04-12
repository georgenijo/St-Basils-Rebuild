import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Member Portal',
  description: "Your St. Basil's parish member portal.",
}

export default function MemberOverviewPage() {
  return (
    <div className="p-8">
      <h1 className="font-heading text-2xl font-semibold text-wood-900">
        Welcome to your Parish Portal
      </h1>
      <p className="mt-2 text-sm text-wood-800/60">Your member dashboard is coming soon.</p>
    </div>
  )
}
