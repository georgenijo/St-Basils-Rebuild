import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'First Time Visiting?',
  description:
    "Planning your first visit to St. Basil's Syriac Orthodox Church in Boston? Find service times, directions, parking information, and what to expect on Sunday morning.",
  openGraph: {
    title: "First Time Visiting? | St. Basil's Syriac Orthodox Church",
    description:
      "Planning your first visit? Find service times, directions, and what to expect at St. Basil's in Boston.",
  },
}

export default function FirstTimePage() {
  return (
    <main className="min-h-screen px-4 py-22 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">First Time Visiting?</h1>
      <p className="mt-4">First time visitor page placeholder.</p>
    </main>
  )
}
